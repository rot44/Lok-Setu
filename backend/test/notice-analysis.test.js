import assert from "node:assert";
import test from "node:test";
import mongoose from "mongoose";
import { UserAnalyzedDocument } from "../src/models/userAnalyzedDocument.model.js";
import {
    executeDocumentAnalysis,
} from "../src/controllers/analysis.controller.js";
import {
    noticeAnalysisService,
} from "../src/services/noticeAnalysis.service.js";
import {
    EXACT_MISSING_INFO_SENTENCE,
    CIVIC_DISCLAIMER,
    resolveCitations,
} from "../src/services/civicAnalysis.service.js";
import { ApiError } from "../src/utils/apiError.js";

// Helper to create a minimal valid PDF buffer in-memory
const createSamplePdfBuffer = (text = "Government Gazette Notification 2026") => {
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

// Helper to create mock response object
const createMockRes = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.body = payload;
        return this;
    },
});

const next = (err) => {
    if (err) throw err;
};

// Mock official evidence chunk with officialPortalUrl
const mockOfficialEvidence = [
    {
        chunkId: "chunk_statutory_01",
        documentId: new mongoose.Types.ObjectId().toString(),
        title: "Delhi Municipal Corporation Act 1957",
        issuingAuthority: "Municipal Corporation of Delhi",
        jurisdictionLevel: "municipal",
        applicableState: "Delhi",
        sectionHeading: "Section 343 - Demolition or stoppage of buildings",
        clauseNumber: "Clause 343(1)",
        officialPortalUrl: "https://mcdonline.nic.in/act-1957",
        sourceText: "No order of demolition shall be made unless the person has been given by means of a notice served in such manner as the Commissioner may think fit, a reasonable opportunity of showing cause with a minimum 15 days notice window.",
    },
];

// Mock Gemini structured output
const mockStructuredNoticeAnalysis = {
    summary: "This is a Municipal Corporation show-cause notice regarding unauthorized construction on your property, giving 15 days to respond.",
    noticeFacts: [
        "Notice issued by Municipal Corporation of Delhi, Building Department.",
        "Ref: File No. MCD/2026/BLD/4412 dated 24th October 2026.",
        "Alleges unauthorized construction on second floor without sanction plan.",
    ],
    datesAndDeadlines: [
        "15 days from receipt of notice to file written response.",
        "Personal hearing scheduled on 12th November 2026 at 11:00 AM.",
    ],
    actionItems: [
        "Submit approved sanction plan or proof of property registration.",
        "Appear before the Zonal Engineer (Building) on the appointed date.",
    ],
    penalties: [
        "Demolition of unauthorized portions and sealing of the property under Section 343.",
    ],
    keyRights: [
        "Right to a 15-day reasonable opportunity of showing cause before any demolition order.",
        "Right to appeal before the Appellate Tribunal for MCD within 30 days of any final order.",
    ],
    citizenImpact: "Risk of property sealing if reply is not submitted within 15 days.",
    businessImpact: "Not applicable for residential property.",
    missingInformation: [
        "The notice does not clearly specify the exact compoundable fee schedule.",
    ],
    referencedChunkIds: ["chunk_statutory_01"],
    insufficientEvidence: false,
};

test("Lok-Setu Citizen Notice Analysis & Rights Extraction Suite", async (t) => {
    const userId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();

    await t.test("1. Successful digital PDF extraction and analysis", async () => {
        const doc = {
            _id: new mongoose.Types.ObjectId(),
            fileName: "mcd_show_cause_notice.pdf",
            fileType: "pdf",
            user: userId,
        };

        const mockClient = {
            models: {
                generateContent: async () => ({
                    text: JSON.stringify(mockStructuredNoticeAnalysis),
                }),
            },
        };

        // Notice text > 50 chars so it does not trigger scanned detection
        const validPdfBuffer = createSamplePdfBuffer(
            "Municipal Corporation of Delhi Notice Under Section 343. You are hereby directed to show cause within 15 days regarding property construction."
        );

        const result = await noticeAnalysisService.analyzeNoticeDocument({
            doc,
            buffer: validPdfBuffer,
            language: "en",
            options: {
                evidenceList: mockOfficialEvidence,
                geminiClient: mockClient,
            },
        });

        assert.strictEqual(result.status, "analyzed");
        assert.ok(result.analysis);
        assert.strictEqual(result.analysis.language, "en");
        assert.ok(result.analysis.summary.includes("show-cause"));
        assert.strictEqual(result.analysis.noticeFacts.length, 3);
        assert.strictEqual(result.analysis.datesAndDeadlines.length, 2);
        assert.strictEqual(result.analysis.keyRights.length, 2);
        assert.strictEqual(result.analysis.citations.length, 1);
        assert.strictEqual(result.analysis.citations[0].chunkId, "chunk_statutory_01");
        assert.strictEqual(result.analysis.citations[0].title, "Delhi Municipal Corporation Act 1957");
        assert.strictEqual(result.analysis.citations[0].sourceUrl, "https://mcdonline.nic.in/act-1957");
    });

    await t.test("2. Successful text-document extraction and analysis", async () => {
        const doc = {
            _id: new mongoose.Types.ObjectId(),
            fileName: "property_tax_notice.txt",
            fileType: "text",
            user: userId,
        };

        const mockClient = {
            models: {
                generateContent: async () => ({
                    text: JSON.stringify({
                        ...mockStructuredNoticeAnalysis,
                        summary: "Property tax revision notice requesting payment of assessed dues.",
                    }),
                }),
            },
        };

        const textBuffer = Buffer.from(
            "Notice: Property Tax Demand for Year 2025-2026. Assessed dues: Rs. 14,500. Payment due by 30th November 2026.",
            "utf8"
        );

        const result = await noticeAnalysisService.analyzeNoticeDocument({
            doc,
            buffer: textBuffer,
            language: "en",
            options: {
                evidenceList: mockOfficialEvidence,
                geminiClient: mockClient,
            },
        });

        assert.strictEqual(result.status, "analyzed");
        assert.ok(result.analysis.summary.includes("Property tax"));
        assert.strictEqual(result.rawExtractedText.includes("Property Tax Demand"), true);
    });

    await t.test("3. Invalid document ID format triggers 400 ApiError", async () => {
        const req = {
            params: { id: "invalid-mongo-id" },
            body: {},
            user: { _id: userId },
            userProfile: null,
        };
        const res = createMockRes();

        await assert.rejects(
            async () => {
                await executeDocumentAnalysis(req, res, next);
            },
            (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes("Invalid document ID")
        );
    });

    await t.test("4. Unauthorized document access triggers 403 ApiError", async () => {
        const docId = new mongoose.Types.ObjectId();

        const origFindById = UserAnalyzedDocument.findById;
        UserAnalyzedDocument.findById = (id) => ({
            _id: id,
            user: userId,
            status: "uploaded",
        });

        const req = {
            params: { id: docId.toString() },
            body: {},
            user: { _id: otherUserId }, // Different user
            userProfile: null,
        };
        const res = createMockRes();

        try {
            await assert.rejects(
                async () => {
                    await executeDocumentAnalysis(req, res, next);
                },
                (err) => err instanceof ApiError && err.statusCode === 403 && err.message.includes("Access denied")
            );
        } finally {
            UserAnalyzedDocument.findById = origFindById;
        }
    });

    await t.test("5. Missing uploaded file in storage triggers 404 ApiError", async () => {
        const docId = new mongoose.Types.ObjectId();

        const origFindById = UserAnalyzedDocument.findById;
        const origFindOneAndUpdate = UserAnalyzedDocument.findOneAndUpdate;

        UserAnalyzedDocument.findById = (id) => ({
            _id: id,
            user: userId,
            status: "uploaded",
            s3Key: null,
            fileName: "notice.pdf",
        });

        UserAnalyzedDocument.findOneAndUpdate = () => ({
            _id: docId,
            user: userId,
            status: "processing",
        });

        const req = {
            params: { id: docId.toString() },
            body: {},
            user: { _id: userId },
            userProfile: null,
            fileBuffer: null,
        };
        const res = createMockRes();

        try {
            await assert.rejects(
                async () => {
                    await executeDocumentAnalysis(req, res, next);
                },
                (err) => err instanceof ApiError && err.statusCode === 404
            );
        } finally {
            UserAnalyzedDocument.findById = origFindById;
            UserAnalyzedDocument.findOneAndUpdate = origFindOneAndUpdate;
        }
    });

    await t.test("6. Empty or unusable extraction triggers 400 ApiError", async () => {
        const doc = {
            _id: new mongoose.Types.ObjectId(),
            fileName: "empty_notice.txt",
            fileType: "text",
            user: userId,
        };

        const emptyBuffer = Buffer.from("   \n\t   ", "utf8");

        await assert.rejects(
            async () => {
                await noticeAnalysisService.analyzeNoticeDocument({
                    doc,
                    buffer: emptyBuffer,
                });
            },
            (err) => err instanceof ApiError && err.statusCode === 400
        );
    });

    await t.test("7. Scanned PDF or image correctly identifies OCR required", async () => {
        const imageDoc = {
            _id: new mongoose.Types.ObjectId(),
            fileName: "challan_photo.jpg",
            fileType: "image",
            user: userId,
        };

        const imgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

        const result = await noticeAnalysisService.analyzeNoticeDocument({
            doc: imageDoc,
            buffer: imgBuffer,
        });

        assert.strictEqual(result.status, "requires_ocr");
        assert.strictEqual(result.requiresOcr, true);
        assert.ok(result.message.includes("OCR"));
        assert.ok(result.message.includes("not configured"));
    });

    await t.test("8. Unsupported binary file format is rejected cleanly", async () => {
        const doc = {
            _id: new mongoose.Types.ObjectId(),
            fileName: "corrupt_notice.docx",
            fileType: "docx",
            user: userId,
        };

        const binaryBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);

        await assert.rejects(
            async () => {
                await noticeAnalysisService.analyzeNoticeDocument({
                    doc,
                    buffer: binaryBuffer,
                });
            },
            (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes("DOCX")
        );
    });

    await t.test("9. Gemini analysis failure updates document status to failed", async () => {
        const docId = new mongoose.Types.ObjectId();
        let updatedStatus = null;

        const origFindById = UserAnalyzedDocument.findById;
        const origFindOneAndUpdate = UserAnalyzedDocument.findOneAndUpdate;
        const origFindByIdAndUpdate = UserAnalyzedDocument.findByIdAndUpdate;

        UserAnalyzedDocument.findById = (id) => ({
            _id: id,
            user: userId,
            fileName: "notice.txt",
            fileType: "text",
            status: "uploaded",
            s3Key: "test/key",
            save: async () => {},
        });

        UserAnalyzedDocument.findOneAndUpdate = () => ({
            _id: docId,
            user: userId,
            status: "processing",
        });

        UserAnalyzedDocument.findByIdAndUpdate = (id, update) => {
            updatedStatus = update.$set?.status;
            return { _id: id };
        };

        const failingClient = {
            models: {
                generateContent: async () => {
                    throw new Error("Gemini quota exceeded or model unavailable.");
                },
            },
        };

        const req = {
            params: { id: docId.toString() },
            body: {},
            user: { _id: userId },
            userProfile: null,
            fileBuffer: Buffer.from("Valid legal notice content here with more than twenty characters.", "utf8"),
            analysisOptions: {
                geminiClient: failingClient,
            },
        };
        const res = createMockRes();

        try {
            await assert.rejects(
                async () => {
                    await executeDocumentAnalysis(req, res, next);
                },
                (err) => err.message.includes("Gemini quota")
            );
            assert.strictEqual(updatedStatus, "failed");
        } finally {
            UserAnalyzedDocument.findById = origFindById;
            UserAnalyzedDocument.findOneAndUpdate = origFindOneAndUpdate;
            UserAnalyzedDocument.findByIdAndUpdate = origFindByIdAndUpdate;
        }
    });

    await t.test("10. Persistence of structured results upon successful analysis", async () => {
        const docId = new mongoose.Types.ObjectId();
        let savedDoc = null;

        const mockDoc = {
            _id: docId,
            user: userId,
            fileName: "notice.txt",
            fileType: "text",
            status: "uploaded",
            primaryExplanation: null,
            rawExtractedText: null,
            save: async function () {
                savedDoc = this;
            },
        };

        const origFindById = UserAnalyzedDocument.findById;
        const origFindOneAndUpdate = UserAnalyzedDocument.findOneAndUpdate;

        UserAnalyzedDocument.findById = () => mockDoc;
        UserAnalyzedDocument.findOneAndUpdate = () => mockDoc;

        const mockClient = {
            models: {
                generateContent: async () => ({
                    text: JSON.stringify(mockStructuredNoticeAnalysis),
                }),
            },
        };

        const req = {
            params: { id: docId.toString() },
            body: { language: "en" },
            user: { _id: userId },
            userProfile: null,
            fileBuffer: Buffer.from("Municipal Notice regarding property demolition under Section 343.", "utf8"),
            analysisOptions: {
                geminiClient: mockClient,
                evidenceList: mockOfficialEvidence,
            },
        };
        const res = createMockRes();

        try {
            await executeDocumentAnalysis(req, res, next);
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.success, true);
            assert.strictEqual(savedDoc.status, "analyzed");
            assert.ok(savedDoc.primaryExplanation);
            assert.strictEqual(savedDoc.primaryExplanation.noticeFacts.length, 3);
            assert.strictEqual(savedDoc.primaryExplanation.citations.length, 1);
            assert.ok(savedDoc.rawExtractedText);
        } finally {
            UserAnalyzedDocument.findById = origFindById;
            UserAnalyzedDocument.findOneAndUpdate = origFindOneAndUpdate;
        }
    });

    await t.test("11. Repeated execution returns cached analysis idempotently", async () => {
        const docId = new mongoose.Types.ObjectId();

        const cachedDoc = {
            _id: docId,
            user: userId,
            fileName: "notice.txt",
            status: "analyzed",
            fileUrl: "https://s3.aws.com/notice.txt",
            primaryExplanation: {
                summary: "Cached analysis summary.",
                noticeFacts: ["Fact 1"],
            },
        };

        const origFindById = UserAnalyzedDocument.findById;
        UserAnalyzedDocument.findById = () => cachedDoc;

        const req = {
            params: { id: docId.toString() },
            body: {},
            user: { _id: userId },
            userProfile: null,
        };
        const res = createMockRes();

        try {
            await executeDocumentAnalysis(req, res, next);
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body.data.isCached, true);
            assert.strictEqual(res.body.data.analysis.summary, "Cached analysis summary.");
        } finally {
            UserAnalyzedDocument.findById = origFindById;
        }
    });

    await t.test("12. Concurrent execution request receives 409 ApiError", async () => {
        const docId = new mongoose.Types.ObjectId();

        const processingDoc = {
            _id: docId,
            user: userId,
            status: "processing",
        };

        const origFindById = UserAnalyzedDocument.findById;
        const origFindOneAndUpdate = UserAnalyzedDocument.findOneAndUpdate;

        UserAnalyzedDocument.findById = () => processingDoc;
        UserAnalyzedDocument.findOneAndUpdate = () => null;

        const req = {
            params: { id: docId.toString() },
            body: {},
            user: { _id: userId },
            userProfile: null,
        };
        const res = createMockRes();

        try {
            await assert.rejects(
                async () => {
                    await executeDocumentAnalysis(req, res, next);
                },
                (err) => err instanceof ApiError && err.statusCode === 409 && err.message.includes("already in progress")
            );
        } finally {
            UserAnalyzedDocument.findById = origFindById;
            UserAnalyzedDocument.findOneAndUpdate = origFindOneAndUpdate;
        }
    });

    await t.test("13. Citation resolution against verified official evidence", () => {
        const referencedChunkIds = ["chunk_statutory_01"];
        const resolved = resolveCitations(referencedChunkIds, mockOfficialEvidence);

        assert.strictEqual(resolved.length, 1);
        assert.strictEqual(resolved[0].chunkId, "chunk_statutory_01");
        assert.strictEqual(resolved[0].title, "Delhi Municipal Corporation Act 1957");
        assert.strictEqual(resolved[0].issuingAuthority, "Municipal Corporation of Delhi");
        assert.strictEqual(resolved[0].clauseNumber, "Clause 343(1)");
        assert.strictEqual(resolved[0].sourceUrl, "https://mcdonline.nic.in/act-1957");
    });

    await t.test("14. Unknown or fabricated citation IDs are safely dropped", () => {
        const referencedChunkIds = ["chunk_statutory_01", "fabricated_chunk_fake_99", "another_fake"];
        const resolved = resolveCitations(referencedChunkIds, mockOfficialEvidence);

        assert.strictEqual(resolved.length, 1);
        assert.strictEqual(resolved[0].chunkId, "chunk_statutory_01");
    });

    await t.test("15. Unsupported language code triggers 400 ApiError", async () => {
        const docId = new mongoose.Types.ObjectId();

        const origFindById = UserAnalyzedDocument.findById;
        UserAnalyzedDocument.findById = (id) => ({
            _id: id,
            user: userId,
            status: "uploaded",
        });

        const req = {
            params: { id: docId.toString() },
            body: { language: "klingon" },
            user: { _id: userId },
            userProfile: null,
        };
        const res = createMockRes();

        try {
            await assert.rejects(
                async () => {
                    await executeDocumentAnalysis(req, res, next);
                },
                (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes("Unsupported language")
            );
        } finally {
            UserAnalyzedDocument.findById = origFindById;
        }
    });

    await t.test("16. Insufficient evidence populates exact missing-information sentence without inventing rights", async () => {
        const doc = {
            _id: new mongoose.Types.ObjectId(),
            fileName: "vague_notice.txt",
            fileType: "text",
            user: userId,
        };

        const mockClient = {
            models: {
                generateContent: async () => ({
                    text: JSON.stringify({
                        summary: "The notice requests attendance but provides no details on violations or penalties.",
                        noticeFacts: ["Meeting requested on unknown date."],
                        datesAndDeadlines: [],
                        actionItems: [],
                        penalties: [],
                        keyRights: [],
                        citizenImpact: EXACT_MISSING_INFO_SENTENCE,
                        businessImpact: "Not specified.",
                        missingInformation: ["No hearing date specified", "No issuing officer mentioned"],
                        referencedChunkIds: [],
                        insufficientEvidence: true,
                    }),
                }),
            },
        };

        const textBuffer = Buffer.from(
            "Notice: You are requested to visit room 104 regarding your property file. No further details provided.",
            "utf8"
        );

        const result = await noticeAnalysisService.analyzeNoticeDocument({
            doc,
            buffer: textBuffer,
            language: "en",
            options: {
                evidenceList: [],
                geminiClient: mockClient,
            },
        });

        assert.strictEqual(result.status, "analyzed");
        assert.deepStrictEqual(result.analysis.penalties, [EXACT_MISSING_INFO_SENTENCE]);
        assert.deepStrictEqual(result.analysis.keyRights, [EXACT_MISSING_INFO_SENTENCE]);
        assert.deepStrictEqual(result.analysis.datesAndDeadlines, [EXACT_MISSING_INFO_SENTENCE]);
        assert.strictEqual(result.analysis.citations.length, 0);
        assert.strictEqual(result.analysis.disclaimer, CIVIC_DISCLAIMER);
    });
});
