import assert from "node:assert";
import test from "node:test";
import mongoose from "mongoose";
import {
    computeCosineSimilarity,
    buildRetrievalFilter,
    computeReciprocalRankFusion,
    assembleEvidenceItem,
    retrieveSemanticEvidence,
    retrieveKeywordEvidence,
    retrieveEvidence,
} from "../src/services/retrieval.service.js";
import { validateEmbeddingVector } from "../src/services/embedding.service.js";
import { buildAtlasVectorSearchStage, ATLAS_VECTOR_SEARCH_INDEX_NAME } from "../src/config/vectorIndex.js";
import { ApiError } from "../src/utils/apiError.js";

test("Lok-Setu Hybrid Retrieval & Evidence Assembly Suite", async (t) => {
    // ─── 1. Vector Math & Cosine Similarity Tests ─────────────────────────────
    await t.test("computeCosineSimilarity calculates exact cosine metrics", () => {
        // Identical vectors -> 1.0
        const vecA = [1, 2, 3, 4];
        const vecB = [1, 2, 3, 4];
        assert.ok(Math.abs(computeCosineSimilarity(vecA, vecB) - 1.0) < 1e-6);

        // Orthogonal vectors -> 0.0
        const orthoA = [1, 0, 0];
        const orthoB = [0, 1, 0];
        assert.equal(computeCosineSimilarity(orthoA, orthoB), 0);

        // Opposite vectors -> -1.0
        const oppA = [1, 0];
        const oppB = [-1, 0];
        assert.ok(Math.abs(computeCosineSimilarity(oppA, oppB) - (-1.0)) < 1e-6);

        // Scaled vectors with same direction -> 1.0
        const scaleA = [2, 4, 6];
        const scaleB = [1, 2, 3];
        assert.ok(Math.abs(computeCosineSimilarity(scaleA, scaleB) - 1.0) < 1e-6);
    });

    await t.test("computeCosineSimilarity handles invalid, empty, or mismatched vectors safely", () => {
        assert.equal(computeCosineSimilarity([], []), 0);
        assert.equal(computeCosineSimilarity([1, 2], [1, 2, 3]), 0);
        assert.equal(computeCosineSimilarity(null, [1, 2]), 0);
        assert.equal(computeCosineSimilarity([1, 2], undefined), 0);
        assert.equal(computeCosineSimilarity([0, 0, 0], [0, 0, 0]), 0);
        assert.equal(computeCosineSimilarity([NaN, 2], [1, 2]), 0);
    });

    // ─── 2. Metadata Filter Normalization Tests ───────────────────────────────
    await t.test("buildRetrievalFilter enforces indexed status and normalizes filters", () => {
        const rawFilters = {
            jurisdictionLevel: " CENTRAL ",
            applicableState: "Uttar Pradesh",
            documentType: "WELFARE_POLICY ",
            issuingAuthority: " Ministry of Agriculture ",
            documentId: "507f1f77bcf86cd799439011",
        };

        const filter = buildRetrievalFilter(rawFilters);

        assert.equal(filter.indexingStatus, "indexed");
        assert.equal(filter["metadata.jurisdictionLevel"], "central");
        assert.equal(filter["metadata.applicableState"], "Uttar Pradesh");
        assert.equal(filter["metadata.documentType"], "welfare_policy");
        assert.equal(filter["metadata.issuingAuthority"], "Ministry of Agriculture");
        assert.ok(filter.documentId instanceof mongoose.Types.ObjectId);
    });

    await t.test("buildRetrievalFilter handles state arrays and empty values safely", () => {
        // Array of states -> $in
        const stateArrayFilter = buildRetrievalFilter({
            applicableState: ["Uttar Pradesh", "Bihar"],
        });
        assert.deepEqual(stateArrayFilter["metadata.applicableState"], {
            $in: ["Uttar Pradesh", "Bihar"],
        });

        // Single item state array -> string
        const singleStateFilter = buildRetrievalFilter({
            applicableState: ["Uttar Pradesh"],
        });
        assert.equal(singleStateFilter["metadata.applicableState"], "Uttar Pradesh");

        // Empty filter object -> still enforces indexingStatus: indexed
        const emptyFilter = buildRetrievalFilter({});
        assert.deepEqual(emptyFilter, { indexingStatus: "indexed" });
        assert.deepEqual(buildRetrievalFilter(null), { indexingStatus: "indexed" });
    });

    // ─── 3. Reciprocal Rank Fusion (RRF) & Tie-Breaking Tests ─────────────────
    await t.test("computeReciprocalRankFusion calculates exact RRF scores and deduplicates", () => {
        const semanticResults = [
            { chunkId: "chunk_1", score: 0.95 },
            { chunkId: "chunk_2", score: 0.85 },
            { chunkId: "chunk_3", score: 0.75 },
        ];

        const keywordResults = [
            { chunkId: "chunk_2", score: 4.5 },
            { chunkId: "chunk_4", score: 3.2 },
            { chunkId: "chunk_1", score: 2.1 },
        ];

        const k = 60;
        const fused = computeReciprocalRankFusion({
            semanticResults,
            keywordResults,
            k,
            limit: 5,
        });

        // chunk_1: semantic rank 1, keyword rank 3
        // expected RRF = 1/(60+1) + 1/(60+3) = (1/61) + (1/63) ≈ 0.0163934 + 0.0158730 = 0.032266
        // chunk_2: semantic rank 2, keyword rank 1
        // expected RRF = 1/(60+2) + 1/(60+1) = (1/62) + (1/61) ≈ 0.0161290 + 0.0163934 = 0.032522
        assert.equal(fused[0].chunkId, "chunk_2", "chunk_2 should rank #1 due to higher combined RRF score");
        assert.equal(fused[1].chunkId, "chunk_1", "chunk_1 should rank #2");

        // Verify deduplication
        assert.equal(fused.filter((f) => f.chunkId === "chunk_1").length, 1);
        assert.equal(fused.filter((f) => f.chunkId === "chunk_2").length, 1);

        // Verify provenance preservation
        const entry1 = fused.find((f) => f.chunkId === "chunk_1");
        assert.equal(entry1.semanticRank, 1);
        assert.equal(entry1.keywordRank, 3);
        assert.equal(entry1.semanticScore, 0.95);
        assert.equal(entry1.keywordScore, 2.1);
        assert.deepEqual(entry1.retrievalMethods.sort(), ["keyword", "semantic"].sort());
    });

    await t.test("computeReciprocalRankFusion performs deterministic tie-breaking", () => {
        // Two chunks with identical RRF score and identical semantic score, but different chunkId
        const semanticResults = [
            { chunkId: "chunk_Z", score: 0.9 },
            { chunkId: "chunk_A", score: 0.9 },
        ];

        const fused = computeReciprocalRankFusion({
            semanticResults,
            keywordResults: [],
            k: 60,
            limit: 2,
        });

        assert.equal(fused.length, 2);
        // Rank 1 has higher RRF than Rank 2
        assert.equal(fused[0].chunkId, "chunk_Z");
        assert.equal(fused[1].chunkId, "chunk_A");

        // Explicit identical RRF and semantic score test
        const tiedEntryA = { chunkId: "chunk_B", score: 0.8 };
        const tiedEntryB = { chunkId: "chunk_A", score: 0.8 };
        // Both in separate runs to test localeCompare tie-breaker
        const tieBreakerResults = computeReciprocalRankFusion({
            semanticResults: [tiedEntryA],
            keywordResults: [tiedEntryB],
            k: 60,
        });
        // Both have RRF score = 1/(60+1)
        assert.ok(Math.abs(tieBreakerResults[0].rrfScore - tieBreakerResults[1].rrfScore) < 1e-9);
        // Tie-breaker: semanticScore (chunk_B has 0.8, chunk_A has null -> chunk_B wins)
        assert.equal(tieBreakerResults[0].chunkId, "chunk_B");
    });

    // ─── 4. Evidence Assembly & Provenance Preservation ───────────────────────
    await t.test("assembleEvidenceItem maps source text and offsets without mutation", () => {
        const rawChunk = {
            chunkId: "doc_pmkisan_chunk_0",
            documentId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            content: "Farmers with cultivable landholding up to 2 hectares are eligible for Rs. 6000 annual support.",
            evidence: {
                startOffset: 120,
                endOffset: 215,
                sectionHeading: "ELIGIBILITY CRITERIA",
                clauseNumber: "Clause 3(a)",
            },
            metadata: {
                title: "PM-KISAN Operational Guidelines",
                issuingAuthority: "Ministry of Agriculture & Farmers Welfare",
                jurisdictionLevel: "central",
                applicableState: "ALL",
                applicableDistrict: "ALL",
                documentType: "welfare_policy",
                officialPortalUrl: "https://pmkisan.gov.in",
                originalPdfUrl: "https://s3.amazonaws.com/pmkisan.pdf",
            },
        };

        const retrievalMeta = {
            mode: "hybrid",
            retrievalMethods: ["semantic", "keyword"],
            rrfScore: 0.0325,
            semanticScore: 0.92,
            keywordScore: 4.8,
            semanticRank: 1,
            keywordRank: 2,
            retrievedVia: "atlas+text_index",
        };

        const item = assembleEvidenceItem(rawChunk, retrievalMeta);

        // Exact source text preserved without summaries or rewriting
        assert.equal(item.sourceText, rawChunk.content);
        assert.equal(item.startOffset, 120);
        assert.equal(item.endOffset, 215);
        assert.equal(item.sectionHeading, "ELIGIBILITY CRITERIA");
        assert.equal(item.clauseNumber, "Clause 3(a)");
        assert.equal(item.title, "PM-KISAN Operational Guidelines");
        assert.equal(item.issuingAuthority, "Ministry of Agriculture & Farmers Welfare");

        // Provenance & retrieval meta separated
        assert.equal(item.retrieval.mode, "hybrid");
        assert.equal(item.retrieval.rrfScore, 0.0325);
        assert.equal(item.retrieval.semanticScore, 0.92);
        assert.equal(item.retrieval.keywordScore, 4.8);
        assert.equal(item.retrieval.retrievedVia, "atlas+text_index");
    });

    // ─── 5. Semantic Vector Retrieval & Local Fallback ────────────────────────
    await t.test("retrieveSemanticEvidence falls back to in-memory cosine when Atlas throws", async () => {
        const queryVector = new Array(768).fill(0.1);
        // Normalize queryVector
        const norm = Math.sqrt(queryVector.reduce((acc, v) => acc + v * v, 0));
        for (let i = 0; i < 768; i++) queryVector[i] /= norm;

        // Mock chunks in MongoDB
        const mockTargetVector = [...queryVector]; // identical -> similarity 1.0
        const mockOtherVector = new Array(768).fill(-0.1); // opposite -> similarity -1.0

        const mockChunks = [
            {
                chunkId: "chunk_perfect_match",
                documentId: "doc_1",
                content: "Small and marginal farmers eligible for assistance.",
                evidence: { startOffset: 0, endOffset: 50 },
                metadata: { title: "PM Kisan", jurisdictionLevel: "central" },
                indexingStatus: "indexed",
                embedding: { values: mockTargetVector },
            },
            {
                chunkId: "chunk_opposite",
                documentId: "doc_2",
                content: "Commercial export duties on non-basmati rice.",
                evidence: { startOffset: 0, endOffset: 45 },
                metadata: { title: "Trade Policy", jurisdictionLevel: "central" },
                indexingStatus: "indexed",
                embedding: { values: mockOtherVector },
            },
        ];

        // Mock Model where aggregate throws MongoServerError (simulating standalone Mongo without Atlas Search)
        const mockModel = {
            aggregate: async () => {
                const err = new Error("Unrecognized pipeline stage name: '$vectorSearch'");
                err.name = "MongoServerError";
                throw err;
            },
            find: (filter) => ({
                select: () => ({
                    lean: async () => mockChunks,
                }),
            }),
        };

        const results = await retrieveSemanticEvidence({
            queryVector,
            filter: { indexingStatus: "indexed" },
            limit: 2,
            useLocalFallback: true,
            model: mockModel,
        });

        assert.ok(Array.isArray(results));
        assert.equal(results.length, 2);
        assert.equal(results[0].chunkId, "chunk_perfect_match");
        assert.ok(Math.abs(results[0].score - 1.0) < 1e-4, "Top chunk should have similarity ≈ 1.0");
        assert.equal(results[0].retrievedVia, "local_fallback");
    });

    await t.test("retrieveSemanticEvidence fails cleanly when Atlas is unavailable and fallback disabled", async () => {
        const queryVector = new Array(768).fill(0.1);
        const mockModel = {
            aggregate: async () => {
                throw new Error("Atlas Search index not active");
            },
        };

        await assert.rejects(
            async () => {
                await retrieveSemanticEvidence({
                    queryVector,
                    limit: 5,
                    useLocalFallback: false,
                    model: mockModel,
                });
            },
            (err) => err instanceof ApiError && err.statusCode === 503
        );
    });

    // ─── 6. Keyword Retrieval & Edge Cases ────────────────────────────────────
    await t.test("retrieveKeywordEvidence handles empty, whitespace, and stopword-only queries", async () => {
        assert.deepEqual(await retrieveKeywordEvidence({ query: "" }), []);
        assert.deepEqual(await retrieveKeywordEvidence({ query: "    \t  \n" }), []);
        assert.deepEqual(await retrieveKeywordEvidence({ query: null }), []);
        assert.deepEqual(await retrieveKeywordEvidence({ query: undefined }), []);
    });

    await t.test("retrieveKeywordEvidence queries text index and returns scored results", async () => {
        const mockResults = [
            {
                chunkId: "chunk_text_1",
                content: "Subsidies for drip irrigation equipment.",
                evidence: { startOffset: 0, endOffset: 40 },
                metadata: { title: "Micro Irrigation Scheme" },
                score: 2.75,
            },
        ];

        const mockModel = {
            find: (_filter, _projection) => ({
                sort: () => ({
                    limit: () => ({
                        lean: async () => mockResults,
                    }),
                }),
            }),
        };

        const results = await retrieveKeywordEvidence({
            query: "drip irrigation subsidy",
            limit: 5,
            model: mockModel,
        });

        assert.equal(results.length, 1);
        assert.equal(results[0].chunkId, "chunk_text_1");
        assert.equal(results[0].score, 2.75);
        assert.equal(results[0].retrievedVia, "text_index");
    });

    // ─── 7. Full retrieveEvidence End-to-End Orchestration ────────────────────
    await t.test("retrieveEvidence handles empty queries gracefully without error", async () => {
        const resultEmpty = await retrieveEvidence("");
        const resultWhitespace = await retrieveEvidence("   \n\t   ");
        assert.deepEqual(resultEmpty, []);
        assert.deepEqual(resultWhitespace, []);
    });

    await t.test("retrieveEvidence in keyword mode does not require Gemini or query vector", async () => {
        const mockChunks = [
            {
                chunkId: "chunk_k_1",
                content: "Solar water pump subsidy under PM Kusum scheme.",
                evidence: { startOffset: 10, endOffset: 60, sectionHeading: "SOLAR PUMPS" },
                metadata: { title: "PM Kusum Scheme", jurisdictionLevel: "central" },
                score: 3.5,
            },
        ];

        const mockModel = {
            find: () => ({
                sort: () => ({
                    limit: () => ({
                        lean: async () => mockChunks,
                    }),
                }),
            }),
        };

        const evidence = await retrieveEvidence("PM Kusum solar pump", {
            mode: "keyword",
            limit: 1,
            documentChunkModel: mockModel,
        });

        assert.equal(evidence.length, 1);
        assert.equal(evidence[0].chunkId, "chunk_k_1");
        assert.equal(evidence[0].retrieval.mode, "keyword");
        assert.equal(evidence[0].retrieval.keywordScore, 3.5);
        assert.equal(evidence[0].sourceText, "Solar water pump subsidy under PM Kusum scheme.");
    });

    await t.test("retrieveEvidence in hybrid mode merges semantic and keyword streams with RRF", async () => {
        const mockVector = new Array(768).fill(0.05);

        const mockSemanticChunks = [
            {
                chunkId: "chunk_common",
                content: "Common scheme document text.",
                evidence: { startOffset: 0, endOffset: 30, sectionHeading: "CRITERIA" },
                metadata: { title: "Welfare Scheme" },
                score: 0.88,
                retrievedVia: "local_fallback",
            },
            {
                chunkId: "chunk_semantic_only",
                content: "Semantic text details.",
                evidence: { startOffset: 30, endOffset: 60 },
                metadata: { title: "Welfare Scheme" },
                score: 0.82,
                retrievedVia: "local_fallback",
            },
        ];

        const mockKeywordChunks = [
            {
                chunkId: "chunk_common",
                content: "Common scheme document text.",
                evidence: { startOffset: 0, endOffset: 30, sectionHeading: "CRITERIA" },
                metadata: { title: "Welfare Scheme" },
                score: 4.0,
                retrievedVia: "text_index",
            },
            {
                chunkId: "chunk_keyword_only",
                content: "Keyword text details.",
                evidence: { startOffset: 60, endOffset: 90 },
                metadata: { title: "Welfare Scheme" },
                score: 2.5,
                retrievedVia: "text_index",
            },
        ];

        const mockModel = {
            aggregate: async () => {
                throw new Error("Atlas unavailable");
            },
            find: (filter) => {
                if (filter.$text) {
                    return {
                        sort: () => ({
                            limit: () => ({
                                lean: async () => mockKeywordChunks,
                            }),
                        }),
                    };
                }
                return {
                    select: () => ({
                        lean: async () => [
                            {
                                ...mockSemanticChunks[0],
                                embedding: { values: mockVector },
                            },
                            {
                                ...mockSemanticChunks[1],
                                embedding: { values: mockVector },
                            },
                        ],
                    }),
                };
            },
        };

        const evidence = await retrieveEvidence("welfare benefits", {
            mode: "hybrid",
            limit: 3,
            embeddingGenerator: async () => mockVector,
            documentChunkModel: mockModel,
        });

        assert.ok(Array.isArray(evidence));
        assert.equal(evidence.length, 3);
        // chunk_common appeared in both streams -> should be #1
        assert.equal(evidence[0].chunkId, "chunk_common");
        assert.equal(evidence[0].retrieval.mode, "hybrid");
        assert.ok(evidence[0].retrieval.retrievalMethods.includes("semantic"));
        assert.ok(evidence[0].retrieval.retrievalMethods.includes("keyword"));
        assert.ok(evidence[0].retrieval.rrfScore > 0);
    });

    // ─── 8. Query Security & Privacy Test ────────────────────────────────────
    await t.test("retrieveEvidence does not leak or log citizen queries", async () => {
        const sensitiveQuery = "My Aadhaar is 1234-5678-9012 and income is Rs 1,00,000";
        let loggedSensitive = false;

        const originalLog = console.log;
        const originalInfo = console.info;
        const originalWarn = console.warn;
        const originalError = console.error;

        const checkSensitive = (...args) => {
            const joined = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
            if (joined.includes("1234-5678-9012") || joined.includes("Aadhaar")) {
                loggedSensitive = true;
            }
        };

        console.log = checkSensitive;
        console.info = checkSensitive;
        console.warn = checkSensitive;
        console.error = checkSensitive;

        try {
            const mockModel = {
                find: () => ({
                    sort: () => ({
                        limit: () => ({
                            lean: async () => [],
                        }),
                    }),
                }),
            };

            await retrieveEvidence(sensitiveQuery, {
                mode: "keyword",
                documentChunkModel: mockModel,
            });
        } finally {
            console.log = originalLog;
            console.info = originalInfo;
            console.warn = originalWarn;
            console.error = originalError;
        }

        assert.equal(loggedSensitive, false, "Sensitive citizen query must never be logged to console");
    });
});
