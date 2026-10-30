import assert from "node:assert";
import test from "node:test";
import mongoose from "mongoose";
import {
    isPrivateOrInternalIp,
    validateUrlSafety,
    safeFetchDocument,
    normalizeExtractedText,
    extractHtmlText,
    extractDocumentContent,
    computeContentHash,
    sanitizeUrlForLogging,
    ingestionService,
} from "../src/services/ingestion.service.js";
import { Document } from "../src/models/document.model.js";
import { DocumentChunk } from "../src/models/documentChunk.model.js";
import { ApiError } from "../src/utils/apiError.js";

// Helper to create a minimal valid PDF buffer in-memory
const createSamplePdfBuffer = (text = "Government Gazette Notification 2026") => {
    // Escaped text for PDF string syntax
    const safeText = text.replace(/[()\\]/g, "\\$&");
    const streamContent = `BT /F1 12 Tf 50 700 Td (${safeText}) Tj ET`;
    const streamLength = Buffer.byteLength(streamContent);

    const pdfString = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000322 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
420
%%EOF`;

    return Buffer.from(pdfString, "utf8");
};

test("Lok-Setu Official Policy Document Ingestion Suite", async (t) => {
    // ─── 1. URL Safety & SSRF Protection Tests ────────────────────────────────
    await t.test("isPrivateOrInternalIp accurately classifies IP addresses", () => {
        // Block loopback
        assert.equal(isPrivateOrInternalIp("127.0.0.1"), true);
        assert.equal(isPrivateOrInternalIp("127.255.255.255"), true);
        assert.equal(isPrivateOrInternalIp("::1"), true);

        // Block RFC 1918 private IPv4
        assert.equal(isPrivateOrInternalIp("10.0.0.1"), true);
        assert.equal(isPrivateOrInternalIp("10.254.10.5"), true);
        assert.equal(isPrivateOrInternalIp("172.16.0.1"), true);
        assert.equal(isPrivateOrInternalIp("172.31.255.255"), true);
        assert.equal(isPrivateOrInternalIp("192.168.1.1"), true);
        assert.equal(isPrivateOrInternalIp("192.168.254.254"), true);

        // Block link-local & cloud metadata
        assert.equal(isPrivateOrInternalIp("169.254.169.254"), true);
        assert.equal(isPrivateOrInternalIp("169.254.1.1"), true);

        // Block CGNAT & reserved
        assert.equal(isPrivateOrInternalIp("100.64.0.1"), true);
        assert.equal(isPrivateOrInternalIp("0.0.0.0"), true);
        assert.equal(isPrivateOrInternalIp("240.0.0.1"), true);

        // Block IPv6 ULA & Link-local
        assert.equal(isPrivateOrInternalIp("fc00::1"), true);
        assert.equal(isPrivateOrInternalIp("fd12:3456:789a::1"), true);
        assert.equal(isPrivateOrInternalIp("fe80::1"), true);
        assert.equal(isPrivateOrInternalIp("::ffff:192.168.1.1"), true);

        // Allow public routable IP addresses
        assert.equal(isPrivateOrInternalIp("8.8.8.8"), false);
        assert.equal(isPrivateOrInternalIp("1.1.1.1"), false);
        assert.equal(isPrivateOrInternalIp("164.100.158.23"), false); // National Informatics Centre
        assert.equal(isPrivateOrInternalIp("2607:f8b0:4005:805::200e"), false);
    });

    await t.test("validateUrlSafety enforces protocol and blocks internal hostnames", async () => {
        // Rejects non-http(s) protocols
        await assert.rejects(
            async () => validateUrlSafety("ftp://pib.gov.in/doc.pdf"),
            (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes("Unsupported protocol")
        );
        await assert.rejects(
            async () => validateUrlSafety("file:///etc/passwd"),
            (err) => err instanceof ApiError && err.statusCode === 400
        );
        await assert.rejects(
            async () => validateUrlSafety("javascript:alert(1)"),
            (err) => err instanceof ApiError && err.statusCode === 400
        );

        // Rejects internal/localhost hostnames
        await assert.rejects(
            async () => validateUrlSafety("http://localhost:8000/policy"),
            (err) => err instanceof ApiError && err.statusCode === 400
        );
        await assert.rejects(
            async () => validateUrlSafety("http://metadata.google.internal/computeMetadata/v1"),
            (err) => err instanceof ApiError && err.statusCode === 400
        );
        await assert.rejects(
            async () => validateUrlSafety("http://169.254.169.254/latest/meta-data"),
            (err) => err instanceof ApiError && err.statusCode === 400
        );

        // Rejects hosts that resolve to private IPs via DNS
        const mockInternalDns = async () => [{ address: "192.168.1.55" }];
        await assert.rejects(
            async () => validateUrlSafety("https://internal-service.local/doc", { dnsResolver: mockInternalDns }),
            (err) => err instanceof ApiError && err.statusCode === 400
        );

        // Permits valid public government hostname with public IP
        const mockPublicDns = async () => [{ address: "164.100.158.23" }];
        const validResult = await validateUrlSafety("https://pib.gov.in/PressReleasePage.aspx?PRID=123", {
            dnsResolver: mockPublicDns,
        });
        assert.equal(validResult.valid, true);
        assert.equal(validResult.parsedUrl.hostname, "pib.gov.in");
    });

    await t.test("safeFetchDocument blocks redirects to internal network addresses", async () => {
        const mockPublicDns = async () => [{ address: "164.100.1.1" }];

        // Mock fetch that redirects to AWS/GCP metadata endpoint
        const mockRedirectToMetadata = async (url) => {
            if (url === "https://public-site.gov.in/doc.pdf") {
                return {
                    status: 302,
                    headers: new Map([["location", "http://169.254.169.254/latest/meta-data"]]),
                };
            }
            return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(10), headers: new Map() };
        };

        await assert.rejects(
            async () => {
                await safeFetchDocument("https://public-site.gov.in/doc.pdf", {
                    fetcher: mockRedirectToMetadata,
                    dnsResolver: mockPublicDns,
                });
            },
            (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes("prohibited")
        );
    });

    await t.test("safeFetchDocument enforces maximum redirect count and response size cap", async () => {
        const mockPublicDns = async () => [{ address: "164.100.1.1" }];

        // Loop redirect
        let redirectIndex = 0;
        const mockInfiniteRedirect = async () => {
            redirectIndex++;
            return {
                status: 302,
                headers: new Map([["location", `https://public-site.gov.in/hop-${redirectIndex}`]]),
            };
        };

        await assert.rejects(
            async () => {
                await safeFetchDocument("https://public-site.gov.in/start", {
                    maxRedirects: 2,
                    fetcher: mockInfiniteRedirect,
                    dnsResolver: mockPublicDns,
                });
            },
            (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes("redirect limit")
        );

        // Oversized document
        const mockOversizedFetch = async () => ({
            ok: true,
            status: 200,
            headers: new Map([["content-length", String(20 * 1024 * 1024)]]), // 20 MB
            arrayBuffer: async () => new ArrayBuffer(100),
        });

        await assert.rejects(
            async () => {
                await safeFetchDocument("https://public-site.gov.in/large.pdf", {
                    maxSizeBytes: 10 * 1024 * 1024,
                    fetcher: mockOversizedFetch,
                    dnsResolver: mockPublicDns,
                });
            },
            (err) => err instanceof ApiError && err.statusCode === 413
        );
    });

    await t.test("sanitizeUrlForLogging strips tokens and sensitive query parameters", () => {
        const sensitiveUrl = "https://source.gov.in/file.pdf?token=secret123&api_key=AIzaSyA&id=99";
        const clean = sanitizeUrlForLogging(sensitiveUrl);
        assert.equal(clean, "https://source.gov.in/file.pdf");
        assert.ok(!clean.includes("secret123"));
        assert.ok(!clean.includes("AIzaSyA"));
    });

    // ─── 2. Text Extraction & Format Handling Tests ───────────────────────────
    await t.test("normalizeExtractedText normalizes CRLF and removes control characters", () => {
        const raw = "Line 1\r\n\r\n\r\n\r\nLine 2\u00A0with non-breaking space and\u200Bzero width.\r\nLine 3";
        const normalized = normalizeExtractedText(raw);

        assert.ok(!normalized.includes("\r"));
        assert.ok(!normalized.includes("\u200B"));
        assert.ok(!normalized.includes("\n\n\n")); // max 2 newlines
        assert.ok(normalized.includes("Line 1\n\nLine 2 with non-breaking space andzero width.\nLine 3"));
    });

    await t.test("extractHtmlText strips script/styles and converts block tags to newlines", () => {
        const html = `
<!DOCTYPE html>
<html>
<head><style>body { color: red; }</style></head>
<body>
<script>alert("malicious");</script>
<h1>MINISTRY OF AGRICULTURE NOTIFICATION</h1>
<p>Eligible farmers having cultivable land up to 2 hectares &amp; Aadhaar seeded account.</p>
<div>Benefits will be credited via DBT directly.</div>
</body>
</html>`;

        const extracted = extractHtmlText(html);
        assert.ok(!extracted.includes("alert"));
        assert.ok(!extracted.includes("body { color: red; }"));
        assert.ok(extracted.includes("MINISTRY OF AGRICULTURE NOTIFICATION"));
        assert.ok(extracted.includes("2 hectares & Aadhaar seeded account"));
        assert.ok(extracted.includes("DBT directly"));
    });

    await t.test("extractDocumentContent handles valid PDF extraction", async () => {
        const sampleText = "MINISTRY OF JAL SHAKTI: HAR GHAR JAL GUIDELINES 2026. Coverage of rural tap water.";
        const pdfBuffer = createSamplePdfBuffer(sampleText);

        const outcome = await extractDocumentContent(pdfBuffer, "application/pdf");
        assert.equal(outcome.format, "pdf");
        assert.equal(outcome.requiresOcr, false);
        assert.ok(outcome.text.includes("HAR GHAR JAL GUIDELINES 2026"));
    });

    await t.test("extractDocumentContent flags scanned PDF without text as requiresOcr", async () => {
        // Create PDF with minimal or no text
        const emptyPdfBuffer = createSamplePdfBuffer("");
        const outcome = await extractDocumentContent(emptyPdfBuffer, "application/pdf");

        assert.equal(outcome.format, "pdf");
        assert.equal(outcome.requiresOcr, true);
        assert.equal(outcome.text, "");
    });

    await t.test("extractDocumentContent rejects binary non-text files and malformed PDFs", async () => {
        // Binary executable with null bytes
        const binaryBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
        await assert.rejects(
            async () => extractDocumentContent(binaryBuffer, "text/plain"),
            (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes("binary")
        );

        // Malformed PDF claiming to be PDF without %PDF header
        const fakePdf = Buffer.from("NOT_A_PDF_HEADER_CONTENT");
        await assert.rejects(
            async () => extractDocumentContent(fakePdf, "application/pdf"),
            (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes("header lacks")
        );
    });

    // ─── 3. Ingestion Lifecycle, Idempotency & Provenance Tests ────────────────
    await t.test("computeContentHash generates deterministic SHA-256 digests", () => {
        const text = "National Rural Livelihoods Mission Operational Framework";
        const hash1 = computeContentHash(text);
        const hash2 = computeContentHash(text);
        assert.equal(hash1, hash2);
        assert.equal(hash1.length, 64);
    });

    await t.test("registerAndIngestOfficialDocument validates required metadata strictly", async () => {
        await assert.rejects(
            async () => {
                await ingestionService.registerAndIngestOfficialDocument({
                    title: "",
                    issuingAuthority: "Ministry of Finance",
                    jurisdictionLevel: "central",
                    documentType: "welfare_policy",
                });
            },
            (err) => err instanceof ApiError && err.statusCode === 400
        );

        await assert.rejects(
            async () => {
                await ingestionService.registerAndIngestOfficialDocument({
                    title: "PM Scheme",
                    issuingAuthority: "Ministry",
                    jurisdictionLevel: "GLOBAL_INVALID",
                    documentType: "welfare_policy",
                });
            },
            (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes("jurisdiction")
        );
    });

    await t.test("registerAndIngestOfficialDocument creates record and indexes content idempotently", async () => {
        const docId = new mongoose.Types.ObjectId();
        const rawPolicyText =
            "PRADHAN MANTRI KISAN SAMMAN NIDHI GUIDELINES 2026.\n1. ELIGIBILITY: All small and marginal farmer families with cultivable land.";

        let capturedDocument = null;
        let mockChunkCount = 0;

        // Mock Document model methods
        const originalFindOne = Document.findOne;
        const originalCreate = Document.create;
        const originalFindByIdAndUpdate = Document.findByIdAndUpdate;

        const mockVector = new Array(768).fill(0.01);

        try {
            Document.findOne = async () => null; // Simulate new document
            Document.create = async (data) => {
                capturedDocument = {
                    ...data,
                    _id: docId,
                    save: async function () {
                        return this;
                    },
                };
                return capturedDocument;
            };

            const outcome = await ingestionService.registerAndIngestOfficialDocument(
                {
                    title: "PM Kisan Samman Nidhi Guidelines 2026",
                    issuingAuthority: "Ministry of Agriculture & Farmers Welfare",
                    jurisdictionLevel: "central",
                    applicableState: "ALL",
                    documentType: "welfare_policy",
                    rawText: rawPolicyText,
                },
                {
                    indexer: async () => ({
                        success: true,
                        chunkCount: 2,
                    }),
                    embeddingGenerator: async () => [
                        { values: mockVector, model: "gemini-embedding-001", dimensions: 768 },
                    ],
                }
            );

            assert.equal(outcome.success, true);
            assert.equal(outcome.isDuplicate, false);
            assert.equal(outcome.ingestionStatus, "indexed");
            assert.equal(outcome.indexingStatus, "indexed");
            assert.equal(outcome.contentHash, computeContentHash(rawPolicyText));
            assert.ok(outcome.chunkCount >= 1);

            // Verify provenance tracking
            assert.ok(capturedDocument.metadataProvenance.adminSupplied.has("jurisdictionLevel"));
            assert.ok(capturedDocument.metadataProvenance.systemInferred.has("characterCount"));
        } finally {
            Document.findOne = originalFindOne;
            Document.create = originalCreate;
            Document.findByIdAndUpdate = originalFindByIdAndUpdate;
        }
    });

    await t.test("registerAndIngestOfficialDocument detects duplicate unchanged content idempotently", async () => {
        const rawPolicyText = "STAND UP INDIA SCHEME GUIDELINES FOR MSME FINANCING.";
        const contentHash = computeContentHash(rawPolicyText);

        const existingDoc = {
            _id: new mongoose.Types.ObjectId(),
            title: "Stand Up India Guidelines",
            issuingAuthority: "Ministry of Finance",
            contentHash,
            ingestionStatus: "indexed",
            indexingStatus: "indexed",
            indexedChunkCount: 2,
        };

        const originalFindOne = Document.findOne;

        try {
            Document.findOne = async () => existingDoc;

            const outcome = await ingestionService.registerAndIngestOfficialDocument({
                title: "Stand Up India Guidelines",
                issuingAuthority: "Ministry of Finance",
                jurisdictionLevel: "central",
                documentType: "welfare_policy",
                rawText: rawPolicyText,
            });

            // Idempotent duplicate: no re-indexing required
            assert.equal(outcome.success, true);
            assert.equal(outcome.isDuplicate, true);
            assert.equal(outcome.updated, false);
            assert.equal(outcome.documentId, String(existingDoc._id));
            assert.equal(outcome.contentHash, contentHash);
        } finally {
            Document.findOne = originalFindOne;
        }
    });

    await t.test("registerAndIngestOfficialDocument handles scanned PDF requiring OCR cleanly", async () => {
        const emptyPdfBuffer = createSamplePdfBuffer("");
        const mockPublicDns = async () => [{ address: "164.100.1.1" }];
        const mockFetcher = async () => ({
            ok: true,
            status: 200,
            headers: new Map([["content-type", "application/pdf"]]),
            arrayBuffer: async () => emptyPdfBuffer,
        });

        const ocrDocId = new mongoose.Types.ObjectId();
        const originalFindOneAndUpdate = Document.findOneAndUpdate;

        try {
            Document.findOneAndUpdate = async (_filter, update) => ({
                _id: ocrDocId,
                ...update,
            });

            const outcome = await ingestionService.registerAndIngestOfficialDocument(
                {
                    sourceUrl: "https://pib.gov.in/scanned-circular.pdf",
                    title: "Scanned Municipal Order 2026",
                    issuingAuthority: "Municipal Corporation",
                    jurisdictionLevel: "municipal",
                    documentType: "municipal_law",
                },
                {
                    fetcher: mockFetcher,
                    dnsResolver: mockPublicDns,
                }
            );

            assert.equal(outcome.success, false);
            assert.equal(outcome.requiresOcr, true);
            assert.equal(outcome.ingestionStatus, "requires_ocr");
            assert.equal(outcome.documentId, String(ocrDocId));
        } finally {
            Document.findOneAndUpdate = originalFindOneAndUpdate;
        }
    });
});
