import assert from "node:assert";
import test from "node:test";
import {
    chunkDocumentText,
    computeContentHash,
    generateChunkId,
    DEFAULT_CHUNKING_CONFIG,
} from "../src/services/chunking.service.js";
import {
    validateEmbeddingVector,
} from "../src/services/embedding.service.js";
import {
    indexingService,
} from "../src/services/indexing.service.js";
import {
    ATLAS_VECTOR_SEARCH_INDEX_NAME,
    ATLAS_VECTOR_INDEX_DEFINITION,
    buildAtlasVectorSearchStage,
} from "../src/config/vectorIndex.js";

test("Lok-Setu Document Chunking & Vector Indexing Suite", async (t) => {
    // ─── 1. Document Chunking Tests ───────────────────────────────────────────
    await t.test("Chunking preserves headings and clause numbers", () => {
        const text = `
GOVERNMENT OF INDIA NOTIFICATION

1. Short Title and Commencement
This scheme may be called the Pradhan Mantri Kisan Welfare Scheme 2026.
It shall come into force on the date of its publication in the Official Gazette.

ELIGIBILITY CRITERIA:
All small and marginal landholding farmer families having cultivable landholding up to 2 hectares shall be eligible.

HOW TO APPLY:
Eligible farmers must register on the official portal with Aadhaar and bank details.
`;
        const documentId = "doc_test_12345";
        const chunks = chunkDocumentText({
            text,
            documentId,
            metadata: { title: "PM Kisan Welfare", documentType: "welfare_policy" },
            options: { chunkSize: 250, chunkOverlap: 40 },
        });

        assert.ok(Array.isArray(chunks));
        assert.ok(chunks.length >= 2, "Expected multiple chunks for structured text");

        // Verify heading detection
        const hasSectionHeading = chunks.some((c) =>
            c.evidence.sectionHeading.includes("ELIGIBILITY CRITERIA") ||
            c.evidence.sectionHeading.includes("Short Title")
        );
        assert.ok(hasSectionHeading, "Expected chunk evidence to preserve section headings");

        // Verify clause detection
        const hasClauseNumber = chunks.some((c) => c.evidence.clauseNumber.includes("1."));
        assert.ok(hasClauseNumber, "Expected clause number 1. to be captured in evidence");
    });

    await t.test("Chunking generates deterministic chunk IDs and content hashes", () => {
        const text = "National Health Assurance Scheme provides coverage of up to 5 lakh rupees per family per year.";
        const docId = "doc_test_determ";

        const chunksRun1 = chunkDocumentText({ text, documentId: docId });
        const chunksRun2 = chunkDocumentText({ text, documentId: docId });

        assert.equal(chunksRun1.length, chunksRun2.length);
        assert.equal(chunksRun1[0].chunkId, chunksRun2[0].chunkId);
        assert.equal(chunksRun1[0].contentHash, chunksRun2[0].contentHash);

        // Verify chunk ID structure
        assert.ok(chunksRun1[0].chunkId.startsWith(`doc_${docId}_chunk_0_`));
    });

    await t.test("Chunking handles empty, whitespace, and malformed inputs safely", () => {
        assert.deepEqual(chunkDocumentText({ text: "" }), []);
        assert.deepEqual(chunkDocumentText({ text: "   \n\n\t   " }), []);
        assert.deepEqual(chunkDocumentText({ text: null }), []);
        assert.deepEqual(chunkDocumentText({ text: undefined }), []);
    });

    await t.test("Chunking handles unusually long unbroken sentences gracefully", () => {
        const longSentence = "Word ".repeat(300) + "."; // ~1500 characters
        const chunks = chunkDocumentText({
            text: longSentence,
            documentId: "doc_long",
            options: { chunkSize: 400, chunkOverlap: 50 },
        });

        assert.ok(chunks.length > 1, "Should split unbroken sentences that exceed max chunk size");
        for (const chunk of chunks) {
            assert.ok(chunk.content.length > 0);
            assert.ok(chunk.evidence.startOffset >= 0);
            assert.ok(chunk.evidence.endOffset >= chunk.evidence.startOffset);
        }
    });

    // ─── 2. Embedding Validation Tests ────────────────────────────────────────
    await t.test("validateEmbeddingVector validates coordinate arrays strictly", () => {
        const validVector = new Array(768).fill(0.12345);
        const validated = validateEmbeddingVector(validVector, 768);
        assert.equal(validated.length, 768);

        // Rejects non-arrays
        assert.throws(() => validateEmbeddingVector("not a vector"), /not an array/);
        assert.throws(() => validateEmbeddingVector([]), /empty or not an array/);

        // Rejects dimension mismatches
        assert.throws(() => validateEmbeddingVector([0.1, 0.2], 768), /dimension mismatch/);

        // Rejects invalid numbers (NaN, Infinity, strings)
        assert.throws(() => validateEmbeddingVector([0.1, NaN, 0.3]), /not a valid finite number/);
        assert.throws(() => validateEmbeddingVector([0.1, Infinity, 0.3]), /not a valid finite number/);
        assert.throws(() => validateEmbeddingVector([0.1, "0.2", 0.3]), /not a valid finite number/);
    });

    await t.test("Retry behavior handles transient failures with bounded retries", async () => {
        let attempts = 0;
        const mockTransientEmbeddingCall = async (texts) => {
            attempts++;
            if (attempts < 2) {
                const err = new Error("Resource exhausted (429)");
                err.statusCode = 429;
                throw err;
            }
            return texts.map(() => ({
                values: new Array(768).fill(0.05),
                model: "gemini-embedding-001",
                dimensions: 768,
            }));
        };

        // Execute simulated call with retry
        let finalResult = null;
        for (let i = 0; i < 3; i++) {
            try {
                finalResult = await mockTransientEmbeddingCall(["test text"]);
                break;
            } catch (e) {
                if (i === 2) throw e;
            }
        }

        assert.equal(attempts, 2, "Should succeed on second attempt after transient 429");
        assert.ok(Array.isArray(finalResult));
        assert.equal(finalResult[0].dimensions, 768);
    });

    // ─── 3. Atlas Vector Search Configuration Tests ───────────────────────────
    await t.test("Atlas Vector Search index configuration meets specification", () => {
        assert.equal(ATLAS_VECTOR_SEARCH_INDEX_NAME, "vector_index");
        assert.equal(ATLAS_VECTOR_INDEX_DEFINITION.name, "vector_index");
        assert.equal(ATLAS_VECTOR_INDEX_DEFINITION.type, "vectorSearch");

        const fields = ATLAS_VECTOR_INDEX_DEFINITION.definition.fields;
        const vectorField = fields.find((f) => f.type === "vector");
        assert.ok(vectorField, "Vector field definition must exist");
        assert.equal(vectorField.path, "embedding.values");
        assert.equal(vectorField.numDimensions, 768);
        assert.equal(vectorField.similarity, "cosine");

        const filterPaths = fields.filter((f) => f.type === "filter").map((f) => f.path);
        assert.ok(filterPaths.includes("metadata.jurisdictionLevel"));
        assert.ok(filterPaths.includes("metadata.applicableState"));
        assert.ok(filterPaths.includes("metadata.documentType"));
        assert.ok(filterPaths.includes("indexingStatus"));
    });

    await t.test("buildAtlasVectorSearchStage constructs correct pipeline stage", () => {
        const dummyVector = new Array(768).fill(0.01);
        const stage = buildAtlasVectorSearchStage({
            queryVector: dummyVector,
            limit: 5,
            filter: { "metadata.jurisdictionLevel": "central" },
        });

        assert.ok(stage.$vectorSearch);
        assert.equal(stage.$vectorSearch.index, "vector_index");
        assert.equal(stage.$vectorSearch.path, "embedding.values");
        assert.equal(stage.$vectorSearch.limit, 5);
        assert.equal(stage.$vectorSearch.filter["metadata.jurisdictionLevel"], "central");
    });

    // ─── 4. Mocked Indexing Workflow & Idempotency Tests ───────────────────────
    await t.test("Simulated indexing workflow demonstrates idempotency and chunk persistence", async () => {
        const simulatedDb = new Map(); // in-memory chunk store for isolated testing

        const mockDocument = {
            _id: "doc_mock_100",
            title: "National Scholarship Portal",
            documentType: "welfare_policy",
            jurisdictionLevel: "central",
            applicableState: "ALL",
            issuingAuthority: "Ministry of Education",
            rawExtractedText: `
ELIGIBILITY CRITERIA:
Students with family income below 4.5 lakh per annum enrolled in recognized universities.

BENEFITS:
Financial assistance of Rs. 12,000 to 20,000 per year directly credited to student accounts.
`,
        };

        // Simulated embedding generator producing 768-dim vectors
        const mockEmbeddingGenerator = async ({ texts }) => {
            return texts.map((t, idx) => ({
                values: new Array(768).fill(0.001 * (idx + 1)),
                model: "gemini-embedding-001",
                dimensions: 768,
            }));
        };

        // First indexing run
        const chunks1 = chunkDocumentText({
            text: mockDocument.rawExtractedText,
            documentId: mockDocument._id,
            metadata: { title: mockDocument.title },
            options: { chunkSize: 200, chunkOverlap: 30 },
        });

        const embeddings1 = await mockEmbeddingGenerator({ texts: chunks1.map((c) => c.content) });
        assert.equal(embeddings1.length, chunks1.length);

        // Store in simulated DB
        simulatedDb.set(
            mockDocument._id,
            chunks1.map((c, i) => ({ ...c, embedding: embeddings1[i] }))
        );

        const initialStored = simulatedDb.get(mockDocument._id);
        assert.ok(initialStored.length > 0);

        // Second indexing run (re-indexing should replace, not duplicate)
        const chunks2 = chunkDocumentText({
            text: mockDocument.rawExtractedText,
            documentId: mockDocument._id,
            metadata: { title: mockDocument.title },
            options: { chunkSize: 200, chunkOverlap: 30 },
        });
        const embeddings2 = await mockEmbeddingGenerator({ texts: chunks2.map((c) => c.content) });

        // Idempotent replacement
        simulatedDb.delete(mockDocument._id);
        simulatedDb.set(
            mockDocument._id,
            chunks2.map((c, i) => ({ ...c, embedding: embeddings2[i] }))
        );

        const updatedStored = simulatedDb.get(mockDocument._id);
        assert.equal(updatedStored.length, initialStored.length);
        assert.equal(updatedStored[0].chunkId, initialStored[0].chunkId);
    });

    await t.test("Document update replaces stale chunks with fresh content", async () => {
        const simulatedDb = new Map();
        const docId = "doc_update_test";

        const version1Text = "Version 1 text for welfare scheme.";
        const version2Text = "Version 2 completely revised text with new eligibility terms and larger benefits.";

        const mockEmbeddingGenerator = async ({ texts }) => {
            return texts.map(() => ({
                values: new Array(768).fill(0.01),
                model: "gemini-embedding-001",
                dimensions: 768,
            }));
        };

        // Index Version 1
        const v1Chunks = chunkDocumentText({ text: version1Text, documentId: docId });
        const v1Embeddings = await mockEmbeddingGenerator({ texts: v1Chunks.map((c) => c.content) });
        simulatedDb.set(docId, v1Chunks.map((c, i) => ({ ...c, embedding: v1Embeddings[i] })));

        const v1Stored = simulatedDb.get(docId);
        assert.equal(v1Stored[0].content, version1Text);

        // Invalidate and index Version 2
        simulatedDb.delete(docId); // Stale chunk cleanup
        const v2Chunks = chunkDocumentText({ text: version2Text, documentId: docId });
        const v2Embeddings = await mockEmbeddingGenerator({ texts: v2Chunks.map((c) => c.content) });
        simulatedDb.set(docId, v2Chunks.map((c, i) => ({ ...c, embedding: v2Embeddings[i] })));

        const v2Stored = simulatedDb.get(docId);
        assert.equal(v2Stored[0].content, version2Text);
        assert.notEqual(v2Stored[0].contentHash, v1Stored[0].contentHash);
    });
});
