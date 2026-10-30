import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import { Document } from "../models/document.model.js";
import { indexingService } from "./indexing.service.js";
import { ApiError } from "../utils/apiError.js";
import { DOCUMENT_TYPES, JURISDICTION_LEVELS } from "../constants.js";
import { PDFParse } from "pdf-parse";

/**
 * Checks whether an IP address belongs to private, loopback, link-local,
 * cloud metadata, or reserved ranges.
 *
 * @param {string} ip - IPv4 or IPv6 address
 * @returns {boolean} True if the address is private or restricted
 */
export const isPrivateOrInternalIp = (ip) => {
    if (!ip || typeof ip !== "string") {
        return true;
    }

    const trimmedIp = ip.trim();

    // Check IPv4
    if (net.isIPv4(trimmedIp)) {
        const parts = trimmedIp.split(".").map(Number);
        if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
            return true;
        }

        const [b0, b1] = parts;

        // Loopback: 127.0.0.0/8
        if (b0 === 127) return true;

        // Current network: 0.0.0.0/8
        if (b0 === 0) return true;

        // RFC 1918 Private ranges:
        // 10.0.0.0/8
        if (b0 === 10) return true;
        // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
        if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
        // 192.168.0.0/16
        if (b0 === 192 && b1 === 168) return true;

        // Link-local & Cloud Metadata: 169.254.0.0/16 (e.g. 169.254.169.254)
        if (b0 === 169 && b1 === 254) return true;

        // Shared address space (CGNAT): 100.64.0.0/10 (100.64.0.0 - 100.127.255.255)
        if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

        // IETF protocol assignments & documentation:
        // 192.0.0.0/24, 192.0.2.0/24 (TEST-NET-1)
        if (b0 === 192 && b1 === 0) return true;
        // 198.51.100.0/24 (TEST-NET-2)
        if (b0 === 198 && b1 === 51) return true;
        // 203.0.113.0/24 (TEST-NET-3)
        if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;
        // Benchmarking: 198.18.0.0/15
        if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

        // Multicast: 224.0.0.0/4
        if (b0 >= 224 && b0 <= 239) return true;

        // Reserved / Future: 240.0.0.0/4
        if (b0 >= 240) return true;

        return false;
    }

    // Check IPv6
    if (net.isIPv6(trimmedIp)) {
        const lower = trimmedIp.toLowerCase();

        // Loopback: ::1
        if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;

        // Unspecified: ::
        if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;

        // IPv4-mapped IPv6: ::ffff:x.x.x.x
        if (lower.startsWith("::ffff:")) {
            const ipv4Part = lower.replace("::ffff:", "");
            return isPrivateOrInternalIp(ipv4Part);
        }

        // Unique local address (ULA): fc00::/7 (fc00... or fd00...)
        if (lower.startsWith("fc") || lower.startsWith("fd")) return true;

        // Link-local: fe80::/10 (fe80... to febf...)
        if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
            return true;
        }

        // Documentation: 2001:db8::/32
        if (lower.startsWith("2001:db8:") || lower.startsWith("2001:0db8:")) return true;

        return false;
    }

    return true;
};

/**
 * Validates the safety of a source URL to prevent SSRF.
 * Checks protocol, hostnames, and resolves DNS to inspect target IP addresses.
 *
 * @param {string} urlString
 * @param {Object} [options]
 * @param {Function} [options.dnsResolver] - Optional DNS resolver override for unit testing
 * @returns {Promise<{ valid: boolean, parsedUrl: URL, resolvedIps: string[] }>}
 */
export const validateUrlSafety = async (urlString, options = {}) => {
    if (!urlString || typeof urlString !== "string") {
        throw new ApiError(400, "URL is required and must be a valid string.");
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(urlString.trim());
    } catch (_e) {
        throw new ApiError(400, "Malformed URL format.");
    }

    // 1. Enforce HTTP and HTTPS protocols only
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new ApiError(
            400,
            `Unsupported protocol: '${parsedUrl.protocol}'. Only 'http:' and 'https:' are permitted.`
        );
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // 2. Reject obvious loopback and metadata hostnames
    if (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal") ||
        hostname === "metadata.google.internal" ||
        hostname === "instance-data"
    ) {
        throw new ApiError(400, `Access to local/internal hostname '${hostname}' is prohibited.`);
    }

    // 3. Resolve DNS to check IP addresses
    let resolvedIps = [];

    // If hostname is already a raw IP literal
    if (net.isIP(hostname)) {
        if (isPrivateOrInternalIp(hostname)) {
            throw new ApiError(400, `Access to private or restricted IP address '${hostname}' is prohibited.`);
        }
        resolvedIps.push(hostname);
    } else {
        const lookupFn = options.dnsResolver || dns.lookup;
        try {
            const records = await lookupFn(hostname, { all: true });
            if (!records || records.length === 0) {
                throw new ApiError(400, `DNS resolution failed for hostname '${hostname}'.`);
            }

            resolvedIps = records.map((r) => r.address || r);
        } catch (dnsErr) {
            if (dnsErr instanceof ApiError) throw dnsErr;
            throw new ApiError(400, `DNS resolution failed for host '${hostname}': ${dnsErr.message}`);
        }

        // Validate each resolved IP address
        for (const resolvedIp of resolvedIps) {
            if (isPrivateOrInternalIp(resolvedIp)) {
                throw new ApiError(
                    400,
                    `Host '${hostname}' resolved to private or internal IP address '${resolvedIp}', access prohibited.`
                );
            }
        }
    }

    return {
        valid: true,
        parsedUrl,
        resolvedIps,
    };
};

/**
 * Sanitizes URLs for logging by stripping query parameter tokens/keys.
 */
export const sanitizeUrlForLogging = (urlString) => {
    try {
        const url = new URL(urlString);
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch (_e) {
        return "[INVALID_URL]";
    }
};

/**
 * Safely fetches a document over HTTP/HTTPS with redirect validation,
 * timeouts, and maximum response size caps to prevent SSRF and resource exhaustion.
 *
 * @param {string} urlString
 * @param {Object} [options]
 * @param {number} [options.maxRedirects=3]
 * @param {number} [options.maxSizeBytes=15728640] - Default 15 MB
 * @param {number} [options.timeoutMs=10000] - Default 10 seconds
 * @param {Function} [options.fetcher] - Custom fetch override (useful for testing)
 * @param {Function} [options.dnsResolver] - Custom DNS resolver override
 * @returns {Promise<{ buffer: Buffer, contentType: string, finalUrl: string }>}
 */
export const safeFetchDocument = async (urlString, options = {}) => {
    const maxRedirects = options.maxRedirects ?? 3;
    const maxSizeBytes = options.maxSizeBytes ?? 15 * 1024 * 1024;
    const timeoutMs = options.timeoutMs ?? 10000;
    const fetchFn = options.fetcher || fetch;

    let currentUrl = urlString;
    let redirectCount = 0;

    while (redirectCount <= maxRedirects) {
        // Validate URL safety at every hop (initial request and all redirect locations)
        await validateUrlSafety(currentUrl, { dnsResolver: options.dnsResolver });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        let response;
        try {
            response = await fetchFn(currentUrl, {
                method: "GET",
                redirect: "manual", // Handle redirects explicitly to revalidate target
                signal: controller.signal,
                headers: {
                    "User-Agent": "LokSetu-PolicyIngester/1.0 (+https://loksetu.gov.in)",
                    Accept: "application/pdf, text/html, text/plain;q=0.9, */*;q=0.5",
                },
            });
        } catch (fetchErr) {
            if (fetchErr.name === "AbortError" || fetchErr.message?.includes("aborted")) {
                throw new ApiError(408, `Document fetch timed out after ${timeoutMs}ms.`);
            }
            throw new ApiError(500, `Failed to fetch document: ${fetchErr.message}`);
        } finally {
            clearTimeout(timer);
        }

        // Handle redirects
        if ([301, 302, 303, 307, 308].includes(response.status)) {
            const locationHeader = response.headers.get("location");
            if (!locationHeader) {
                throw new ApiError(400, `Received HTTP ${response.status} redirect without Location header.`);
            }

            redirectCount++;
            if (redirectCount > maxRedirects) {
                throw new ApiError(400, `Maximum redirect limit of ${maxRedirects} exceeded.`);
            }

            // Resolve relative redirects safely against current URL
            currentUrl = new URL(locationHeader, currentUrl).toString();
            continue;
        }

        if (!response.ok) {
            throw new ApiError(
                response.status >= 500 ? 502 : 400,
                `Document source returned HTTP ${response.status} (${response.statusText}).`
            );
        }

        // Check Content-Length header if reported
        const reportedLength = Number(response.headers.get("content-length"));
        if (!isNaN(reportedLength) && reportedLength > maxSizeBytes) {
            throw new ApiError(
                413,
                `Document size (${(reportedLength / (1024 * 1024)).toFixed(1)}MB) exceeds maximum permitted limit (${(maxSizeBytes / (1024 * 1024)).toFixed(1)}MB).`
            );
        }

        const rawData = await response.arrayBuffer();
        const buffer = Buffer.isBuffer(rawData)
            ? rawData
            : Buffer.from(rawData.buffer || rawData, rawData.byteOffset || 0, rawData.byteLength || rawData.length);

        if (buffer.length > maxSizeBytes) {
            throw new ApiError(
                413,
                `Downloaded document size exceeds maximum allowed limit of ${maxSizeBytes} bytes.`
            );
        }

        const contentType = response.headers.get("content-type") || "";

        return {
            buffer,
            contentType,
            finalUrl: currentUrl,
        };
    }

    throw new ApiError(400, `Maximum redirect limit of ${maxRedirects} exceeded.`);
};

/**
 * Normalizes extracted document text without changing legal or semantic meaning:
 * - Unifies line breaks (\r\n -> \n)
 * - Strips zero-width and control characters
 * - Normalizes non-breaking spaces
 * - Collapses redundant consecutive blank lines
 * - Preserves structural paragraphs, headings, and clause numbers
 *
 * @param {string} text
 * @returns {string} Normalized text
 */
export const normalizeExtractedText = (text) => {
    if (!text || typeof text !== "string") {
        return "";
    }

    return (
        text
            // 1. Unify line breaks
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            // 2. Remove zero-width characters and unusual control codes
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
            // 3. Normalize non-breaking spaces to standard space
            .replace(/\u00A0/g, " ")
            // 4. Collapse consecutive spaces/tabs on a single line
            .replace(/[ \t]+/g, " ")
            // 5. Remove spaces at line boundaries
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n[ \t]+/g, "\n")
            // 6. Collapse 3+ consecutive newlines to 2 (paragraph break)
            .replace(/\n{3,}/g, "\n\n")
            .trim()
    );
};

/**
 * Strips HTML tags and entities, converting structural block tags into newlines.
 *
 * @param {string} htmlContent
 * @returns {string} Plain text representation
 */
export const extractHtmlText = (htmlContent) => {
    if (!htmlContent || typeof htmlContent !== "string") {
        return "";
    }

    return (
        htmlContent
            // Strip scripts and styles completely
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
            .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
            // Convert block elements and line breaks to newlines
            .replace(/<\/(div|p|h[1-6]|li|tr|article|section|header|footer)>/gi, "\n\n")
            .replace(/<(br|hr)\s*\/?>/gi, "\n")
            // Strip all remaining tags
            .replace(/<[^>]+>/g, " ")
            // Decode common HTML entities
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&mdash;/g, "—")
            .replace(/&ndash;/g, "–")
    );
};

/**
 * Detects format and extracts clean textual content from a raw document buffer.
 *
 * @param {Buffer} buffer
 * @param {string} [contentType=""]
 * @param {Object} [options]
 * @returns {Promise<{ text: string, format: string, requiresOcr: boolean, pageCount?: number }>}
 */
export const extractDocumentContent = async (buffer, contentType = "", options = {}) => {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new ApiError(400, "Empty document: buffer contains zero bytes.");
    }

    const lowerMime = contentType.toLowerCase();
    const isPdfMagic =
        buffer.length >= 4 &&
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46; // %PDF

    // ── 1. PDF Extraction ─────────────────────────────────────────────────────
    if (isPdfMagic || lowerMime.includes("application/pdf")) {
        if (!isPdfMagic) {
            throw new ApiError(400, "Malformed PDF: File header lacks valid %PDF signature.");
        }

        let parser;
        try {
            parser = new PDFParse({ data: buffer });
            const textResult = await parser.getText();
            const rawText = textResult?.text || "";
            const pageCount = textResult?.total || 1;

            const normalized = normalizeExtractedText(rawText);

            // Scanned PDF detection: if the document contains pages but extracted text is negligible
            const isScannedOrEmpty = normalized.length < 50;

            return {
                text: isScannedOrEmpty ? "" : normalized,
                format: "pdf",
                requiresOcr: isScannedOrEmpty,
                pageCount,
            };
        } catch (pdfErr) {
            throw new ApiError(400, `Failed to parse PDF document: ${pdfErr.message}`);
        } finally {
            if (parser && typeof parser.destroy === "function") {
                await parser.destroy().catch(() => {});
            }
        }
    }

    // ── 2. HTML Extraction ────────────────────────────────────────────────────
    const sampleText = buffer.slice(0, 1024).toString("utf8").trim().toLowerCase();
    const isHtml =
        lowerMime.includes("text/html") ||
        sampleText.startsWith("<!doctype html") ||
        sampleText.startsWith("<html") ||
        /<(p|div|head|body|title)\b/i.test(sampleText);

    if (isHtml) {
        const rawHtml = buffer.toString("utf8");
        const converted = extractHtmlText(rawHtml);
        const normalized = normalizeExtractedText(converted);

        if (!normalized) {
            throw new ApiError(400, "HTML document contains no extractable textual content.");
        }

        return {
            text: normalized,
            format: "html",
            requiresOcr: false,
        };
    }

    // ── 3. Plain Text Extraction ──────────────────────────────────────────────
    // Check if buffer contains non-text binary null bytes
    const checkLength = Math.min(buffer.length, 1024);
    for (let i = 0; i < checkLength; i++) {
        if (buffer[i] === 0x00) {
            throw new ApiError(400, "Unsupported binary file format: binary data cannot be processed as text.");
        }
    }

    const rawText = buffer.toString("utf8");
    const normalized = normalizeExtractedText(rawText);

    if (!normalized) {
        throw new ApiError(400, "Plain text document contains no extractable content.");
    }

    return {
        text: normalized,
        format: "text",
        requiresOcr: false,
    };
};

/**
 * Computes deterministic SHA-256 content hash of normalized document text.
 *
 * @param {string} text
 * @returns {string} 64-character hex hash
 */
export const computeContentHash = (text) => {
    return crypto.createHash("sha256").update(text, "utf8").digest("hex");
};

/**
 * Reusable Official Policy Document Ingestion Service.
 * Validates sources, fetches and extracts text, maintains document records,
 * and orchestrates chunking and vector indexing.
 */
export const ingestionService = {
    /**
     * Registers and ingests an official policy document from an external URL or direct text.
     *
     * @param {Object} input
     * @param {string} [input.sourceUrl] - Official policy publication URL
     * @param {string} [input.rawText] - Direct raw policy text (if already extracted)
     * @param {string} input.title - Official document title
     * @param {string} input.issuingAuthority - Ministry, Department, or Municipal body
     * @param {string} input.jurisdictionLevel - "central", "state", or "municipal"
     * @param {string} [input.applicableState="ALL"] - Applicable Indian state or "ALL"
     * @param {string} [input.applicableDistrict="ALL"] - Applicable district or "ALL"
     * @param {string} input.documentType - Document type enum (e.g. "welfare_policy")
     * @param {string} [input.language="en"] - Primary document language
     * @param {Date|string} [input.publicationDate] - Gazette / Circular date
     * @param {Date|string} [input.effectiveDate] - Date policy becomes active
     * @param {Date|string} [input.applicationDeadline] - Application deadline if applicable
     * @param {string[]} [input.tags] - Categorization tags
     * @param {import("mongoose").Types.ObjectId|string} [input.uploadedBy] - User ID of administrator/official
     * @param {Object} [options]
     * @param {Function} [options.fetcher] - Custom fetcher for testing
     * @param {Function} [options.dnsResolver] - Custom DNS resolver for testing
     * @param {Function} [options.embeddingGenerator] - Custom embedding generator for indexing
     * @returns {Promise<Object>} Ingestion outcome
     */
    registerAndIngestOfficialDocument: async (input, options = {}) => {
        // ── 1. Validate Input Payload ─────────────────────────────────────────
        if (!input || typeof input !== "object") {
            throw new ApiError(400, "Ingestion payload is required.");
        }

        const title = input.title?.trim();
        if (!title) {
            throw new ApiError(400, "Official document title is required.");
        }

        const issuingAuthority = input.issuingAuthority?.trim();
        if (!issuingAuthority) {
            throw new ApiError(400, "Issuing authority is required.");
        }

        const jurisdictionLevel = input.jurisdictionLevel?.trim().toLowerCase();
        if (!jurisdictionLevel || !Object.values(JURISDICTION_LEVELS).includes(jurisdictionLevel)) {
            throw new ApiError(
                400,
                `Invalid jurisdiction level: '${input.jurisdictionLevel}'. Must be one of: ${Object.values(JURISDICTION_LEVELS).join(", ")}.`
            );
        }

        const documentType = input.documentType?.trim().toLowerCase();
        if (!documentType || !Object.values(DOCUMENT_TYPES).includes(documentType)) {
            throw new ApiError(
                400,
                `Invalid document type: '${input.documentType}'. Must be one of: ${Object.values(DOCUMENT_TYPES).join(", ")}.`
            );
        }

        const applicableState = input.applicableState?.trim() || "ALL";
        const applicableDistrict = input.applicableDistrict?.trim() || "ALL";
        const language = input.language?.trim().toLowerCase() || "en";
        const sourceUrl = input.sourceUrl?.trim() || input.officialSourceUrl?.trim() || "";

        if (!sourceUrl && !input.rawText) {
            throw new ApiError(400, "Either 'sourceUrl' or 'rawText' must be provided for document ingestion.");
        }

        // ── 2. Fetch and Extract Document ─────────────────────────────────────
        let extractedText = "";
        let requiresOcr = false;
        let detectedFormat = "text";

        if (sourceUrl) {
            const { buffer, contentType, finalUrl } = await safeFetchDocument(sourceUrl, {
                fetcher: options.fetcher,
                dnsResolver: options.dnsResolver,
            });

            const extraction = await extractDocumentContent(buffer, contentType);
            extractedText = extraction.text;
            requiresOcr = extraction.requiresOcr;
            detectedFormat = extraction.format;
        } else {
            extractedText = normalizeExtractedText(input.rawText);
            detectedFormat = "text";
        }

        // ── 3. Handle Scanned / OCR-Required Documents ────────────────────────
        if (requiresOcr) {
            // Document lacks digital text layer; register document record with requires_ocr status
            const ocrDoc = await Document.findOneAndUpdate(
                { officialSourceUrl: sourceUrl },
                {
                    title,
                    documentType,
                    jurisdictionLevel,
                    applicableState,
                    applicableDistrict,
                    issuingAuthority,
                    officialSourceUrl: sourceUrl,
                    officialPortalUrl: input.officialPortalUrl || sourceUrl,
                    rawExtractedText: "[PENDING_OCR] Document requires optical character recognition.",
                    ingestionStatus: "requires_ocr",
                    indexingStatus: "unindexed",
                    ingestionError: "Document is a scanned PDF or lacks an extractable text layer. OCR is required.",
                    language,
                    retrievedAt: new Date(),
                    uploadedBy: input.uploadedBy,
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            return {
                success: false,
                requiresOcr: true,
                ingestionStatus: "requires_ocr",
                documentId: String(ocrDoc._id),
                message: "Document registered but requires OCR before it can be indexed into vector search.",
                document: ocrDoc,
            };
        }

        if (!extractedText || !extractedText.trim()) {
            throw new ApiError(400, "Document extraction produced empty text.");
        }

        const contentHash = computeContentHash(extractedText);

        // ── 4. Idempotency Check & Document Record Upsert ─────────────────────
        let existingDoc = null;
        if (sourceUrl) {
            existingDoc = await Document.findOne({ officialSourceUrl: sourceUrl });
        }
        if (!existingDoc) {
            existingDoc = await Document.findOne({ title, issuingAuthority });
        }

        // Case A: Unchanged content already successfully indexed
        if (
            existingDoc &&
            existingDoc.contentHash === contentHash &&
            existingDoc.indexingStatus === "indexed" &&
            existingDoc.ingestionStatus === "indexed"
        ) {
            return {
                success: true,
                isDuplicate: true,
                updated: false,
                documentId: String(existingDoc._id),
                contentHash,
                indexedChunkCount: existingDoc.indexedChunkCount,
                message: "Document is identical to existing version and already indexed.",
                document: existingDoc,
            };
        }

        // Case B & C: Update or create document record
        const docData = {
            title,
            documentType,
            jurisdictionLevel,
            applicableState,
            applicableDistrict,
            issuingAuthority,
            officialSourceUrl: sourceUrl || existingDoc?.officialSourceUrl || "",
            officialPortalUrl: input.officialPortalUrl || sourceUrl || existingDoc?.officialPortalUrl || "",
            originalPdfUrl: detectedFormat === "pdf" ? (sourceUrl || existingDoc?.originalPdfUrl || "") : "",
            rawExtractedText: extractedText,
            contentHash,
            language,
            retrievedAt: new Date(),
            notificationDate: input.publicationDate || input.notificationDate || existingDoc?.notificationDate || new Date(),
            effectiveDate: input.effectiveDate || existingDoc?.effectiveDate || null,
            applicationDeadline: input.applicationDeadline || existingDoc?.applicationDeadline || null,
            tags: Array.isArray(input.tags) ? input.tags : (existingDoc?.tags || []),
            uploadedBy: input.uploadedBy || existingDoc?.uploadedBy,
            ingestionStatus: "processing",
            ingestionError: null,
            metadataProvenance: {
                officialSource: new Map([
                    ["sourceUrl", sourceUrl || ""],
                    ["format", detectedFormat],
                ]),
                adminSupplied: new Map([
                    ["jurisdictionLevel", jurisdictionLevel],
                    ["applicableState", applicableState],
                    ["documentType", documentType],
                ]),
                systemInferred: new Map([
                    ["language", language],
                    ["characterCount", String(extractedText.length)],
                ]),
            },
        };

        let targetDoc;
        const isUpdate = Boolean(existingDoc);

        if (existingDoc) {
            Object.assign(existingDoc, docData);
            targetDoc = await existingDoc.save();
        } else {
            targetDoc = await Document.create(docData);
        }

        // ── 5. Indexing Integration ───────────────────────────────────────────
        try {
            const indexer = options.indexer || indexingService.indexDocument;
            const indexResult = await indexer(targetDoc, {
                embeddingGenerator: options.embeddingGenerator,
            });

            // Mark document as successfully indexed
            targetDoc.ingestionStatus = "indexed";
            targetDoc.indexingStatus = "indexed";
            targetDoc.indexedChunkCount = indexResult.chunkCount;
            targetDoc.lastIndexedAt = new Date();
            targetDoc.ingestionError = null;
            await targetDoc.save();

            return {
                success: true,
                isDuplicate: false,
                updated: isUpdate,
                documentId: String(targetDoc._id),
                contentHash,
                chunkCount: indexResult.chunkCount,
                ingestionStatus: "indexed",
                indexingStatus: "indexed",
                message: isUpdate
                    ? "Official policy document updated and re-indexed successfully."
                    : "Official policy document ingested and indexed successfully.",
                document: targetDoc,
            };
        } catch (indexingErr) {
            // Ensure document marks failed ingestion state
            const sanitizedError = indexingErr.message?.replace(/key=[A-Za-z0-9_-]+/gi, "key=***") || "Indexing failed";
            targetDoc.ingestionStatus = "failed";
            targetDoc.indexingStatus = "failed";
            targetDoc.ingestionError = sanitizedError;
            await targetDoc.save();

            throw new ApiError(500, `Document ingestion succeeded but indexing failed: ${sanitizedError}`);
        }
    },
};
