import mongoose from "mongoose";
import { DocumentChunk } from "../models/documentChunk.model.js";
import {
    generateEmbeddingWithRetry,
    validateEmbeddingVector,
} from "./embedding.service.js";
import { isAiConfigured } from "./gemini.service.js";
import { buildAtlasVectorSearchStage } from "../config/vectorIndex.js";
import { config } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

/**
 * Calculates exact cosine similarity between two numerical vectors.
 *
 * formula: (A · B) / (||A|| * ||B||)
 *
 * @param {number[]} vectorA
 * @param {number[]} vectorB
 * @returns {number} Cosine similarity in range [-1, 1], or 0 for invalid inputs
 */
export const computeCosineSimilarity = (vectorA, vectorB) => {
    if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
        return 0;
    }
    if (vectorA.length === 0 || vectorA.length !== vectorB.length) {
        return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
        const a = vectorA[i];
        const b = vectorB[i];

        if (typeof a !== "number" || typeof b !== "number" || isNaN(a) || isNaN(b)) {
            return 0;
        }

        dotProduct += a * b;
        normA += a * a;
        normB += b * b;
    }

    if (normA <= 0 || normB <= 0) {
        return 0;
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return isFinite(similarity) ? similarity : 0;
};

/**
 * Normalizes metadata filters for DocumentChunk queries.
 * Enforces `indexingStatus: "indexed"` to exclude pending, failed, or draft chunks.
 *
 * @param {Object} [filters={}]
 * @param {string} [filters.jurisdictionLevel] - e.g. "central", "state", "municipal"
 * @param {string|string[]} [filters.applicableState] - e.g. "ALL", "Uttar Pradesh"
 * @param {string} [filters.documentType] - e.g. "welfare_policy", "circular"
 * @param {string} [filters.issuingAuthority] - e.g. "Ministry of Agriculture"
 * @param {string|mongoose.Types.ObjectId} [filters.documentId] - Specific document ID
 * @returns {Object} Normalized MongoDB query / Atlas filter object
 */
export const buildRetrievalFilter = (filters = {}) => {
    const normalized = {
        indexingStatus: "indexed",
    };

    if (!filters || typeof filters !== "object") {
        return normalized;
    }

    if (filters.jurisdictionLevel && typeof filters.jurisdictionLevel === "string" && filters.jurisdictionLevel.trim()) {
        normalized["metadata.jurisdictionLevel"] = filters.jurisdictionLevel.trim().toLowerCase();
    }

    if (filters.applicableState) {
        if (Array.isArray(filters.applicableState)) {
            const states = filters.applicableState
                .map((s) => String(s).trim())
                .filter(Boolean);
            if (states.length === 1) {
                normalized["metadata.applicableState"] = states[0];
            } else if (states.length > 1) {
                normalized["metadata.applicableState"] = { $in: states };
            }
        } else if (typeof filters.applicableState === "string" && filters.applicableState.trim()) {
            normalized["metadata.applicableState"] = filters.applicableState.trim();
        }
    }

    if (filters.documentType && typeof filters.documentType === "string" && filters.documentType.trim()) {
        normalized["metadata.documentType"] = filters.documentType.trim().toLowerCase();
    }

    if (filters.issuingAuthority && typeof filters.issuingAuthority === "string" && filters.issuingAuthority.trim()) {
        normalized["metadata.issuingAuthority"] = filters.issuingAuthority.trim();
    }

    if (filters.documentId) {
        const docIdStr = String(filters.documentId).trim();
        if (docIdStr) {
            if (mongoose.Types.ObjectId.isValid(docIdStr)) {
                normalized.documentId = new mongoose.Types.ObjectId(docIdStr);
            } else {
                normalized.documentId = docIdStr;
            }
        }
    }

    return normalized;
};

/**
 * Retrieves semantic candidates using MongoDB Atlas Vector Search, with automatic
 * local cosine similarity fallback when Atlas Vector Search is not available.
 *
 * @param {Object} params
 * @param {number[]} params.queryVector - 768-dimensional query vector
 * @param {Object} [params.filter={}] - Normalized filter object
 * @param {number} [params.limit=10] - Number of candidate chunks to return
 * @param {number} [params.numCandidates=50] - Atlas Search candidate pool size
 * @param {boolean} [params.useLocalFallback=true] - Whether to fall back to in-memory cosine
 * @param {import("mongoose").Model} [params.model=DocumentChunk] - Model override
 * @returns {Promise<Array<Object>>} Retrieved chunks with similarity scores
 */
export const retrieveSemanticEvidence = async ({
    queryVector,
    filter = {},
    limit = 10,
    numCandidates = 50,
    useLocalFallback = true,
    model = DocumentChunk,
}) => {
    validateEmbeddingVector(queryVector, 768);

    const safeLimit = Math.max(1, Number(limit) || 10);
    const safeCandidates = Math.max(safeLimit * 3, Number(numCandidates) || 50);

    // Try MongoDB Atlas Vector Search pipeline stage
    try {
        const pipeline = [
            buildAtlasVectorSearchStage({
                queryVector,
                limit: safeLimit,
                numCandidates: safeCandidates,
                filter,
            }),
            {
                $project: {
                    chunkId: 1,
                    documentId: 1,
                    chunkIndex: 1,
                    totalChunks: 1,
                    content: 1,
                    evidence: 1,
                    metadata: 1,
                    indexingStatus: 1,
                    score: { $meta: "vectorSearchScore" },
                },
            },
        ];

        const atlasResults = await model.aggregate(pipeline);

        if (Array.isArray(atlasResults)) {
            return atlasResults.map((doc) => ({
                ...doc,
                retrievedVia: "atlas",
            }));
        }
    } catch (atlasError) {
        if (!useLocalFallback) {
            throw new ApiError(
                503,
                `MongoDB Atlas Vector Search is unavailable: ${atlasError.message}`
            );
        }

        // Informational diagnostic: Atlas unavailable, executing genuine local cosine similarity fallback
        // Note: No sensitive query or user data is logged.
    }

    // Local Fallback: Retrieve filtered chunks and calculate cosine similarity in memory
    const candidates = await model
        .find(filter)
        .select("chunkId documentId chunkIndex totalChunks content evidence metadata indexingStatus embedding.values")
        .lean();

    if (!Array.isArray(candidates) || candidates.length === 0) {
        return [];
    }

    const scoredCandidates = [];

    for (const chunk of candidates) {
        const candidateVector = chunk.embedding?.values;
        if (!Array.isArray(candidateVector) || candidateVector.length !== queryVector.length) {
            continue;
        }

        const similarity = computeCosineSimilarity(queryVector, candidateVector);
        if (typeof similarity === "number" && !isNaN(similarity)) {
            const { embedding: _ignored, ...cleanChunk } = chunk;
            scoredCandidates.push({
                ...cleanChunk,
                score: similarity,
                retrievedVia: "local_fallback",
            });
        }
    }

    // Sort descending by similarity score; deterministic tie-breaking on chunkId
    scoredCandidates.sort((a, b) => {
        if (Math.abs(b.score - a.score) > 1e-9) {
            return b.score - a.score;
        }
        return String(a.chunkId).localeCompare(String(b.chunkId));
    });

    return scoredCandidates.slice(0, safeLimit);
};

/**
 * Retrieves keyword candidate chunks using MongoDB text index.
 * Handles stopword-only queries and empty terms safely.
 *
 * @param {Object} params
 * @param {string} params.query - Citizen search query
 * @param {Object} [params.filter={}] - Normalized filter object
 * @param {number} [params.limit=10] - Max keyword chunks to return
 * @param {import("mongoose").Model} [params.model=DocumentChunk] - Model override
 * @returns {Promise<Array<Object>>} Chunks with MongoDB textScore
 */
export const retrieveKeywordEvidence = async ({
    query,
    filter = {},
    limit = 10,
    model = DocumentChunk,
}) => {
    if (!query || typeof query !== "string" || !query.trim()) {
        return [];
    }

    const safeLimit = Math.max(1, Number(limit) || 10);

    try {
        const textFilter = {
            $text: { $search: query.trim() },
            ...filter,
        };

        const results = await model
            .find(
                textFilter,
                {
                    chunkId: 1,
                    documentId: 1,
                    chunkIndex: 1,
                    totalChunks: 1,
                    content: 1,
                    evidence: 1,
                    metadata: 1,
                    indexingStatus: 1,
                    score: { $meta: "textScore" },
                }
            )
            .sort({ score: { $meta: "textScore" }, chunkId: 1 })
            .limit(safeLimit)
            .lean();

        if (!Array.isArray(results)) {
            return [];
        }

        return results.map((doc) => ({
            ...doc,
            score: typeof doc.score === "number" ? doc.score : 1.0,
            retrievedVia: "text_index",
        }));
    } catch (_error) {
        // Graceful handling for stopword-only queries or text index exceptions
        return [];
    }
};

/**
 * Combines semantic and keyword retrieval results using Reciprocal Rank Fusion (RRF).
 *
 * Formula: RRF score = Σ 1 / (k + rank)
 *
 * @param {Object} params
 * @param {Array<Object>} [params.semanticResults=[]]
 * @param {Array<Object>} [params.keywordResults=[]]
 * @param {number} [params.k=60] - RRF smoothing parameter
 * @param {number} [params.limit=10] - Number of fused results
 * @returns {Array<Object>} Deduplicated, ranked results with merged provenance
 */
export const computeReciprocalRankFusion = ({
    semanticResults = [],
    keywordResults = [],
    k = 60,
    limit = 10,
}) => {
    const safeK = Math.max(1, Number(k) || 60);
    const safeLimit = Math.max(1, Number(limit) || 10);

    const chunkMap = new Map();

    // 1. Process semantic results (1-based rank)
    for (let i = 0; i < semanticResults.length; i++) {
        const item = semanticResults[i];
        const chunkId = item.chunkId || String(item._id || "");
        if (!chunkId) continue;

        const rank = i + 1;
        const semanticRrfTerm = 1 / (safeK + rank);

        chunkMap.set(chunkId, {
            item,
            chunkId,
            semanticRank: rank,
            keywordRank: null,
            semanticScore: typeof item.score === "number" ? item.score : null,
            keywordScore: null,
            rrfScore: semanticRrfTerm,
            retrievalMethods: ["semantic"],
            retrievedVia: item.retrievedVia || "semantic",
        });
    }

    // 2. Process keyword results (1-based rank)
    for (let i = 0; i < keywordResults.length; i++) {
        const item = keywordResults[i];
        const chunkId = item.chunkId || String(item._id || "");
        if (!chunkId) continue;

        const rank = i + 1;
        const keywordRrfTerm = 1 / (safeK + rank);

        if (chunkMap.has(chunkId)) {
            const entry = chunkMap.get(chunkId);
            entry.keywordRank = rank;
            entry.keywordScore = typeof item.score === "number" ? item.score : null;
            entry.rrfScore += keywordRrfTerm;

            if (!entry.retrievalMethods.includes("keyword")) {
                entry.retrievalMethods.push("keyword");
            }
            if (item.retrievedVia && !entry.retrievedVia.includes(item.retrievedVia)) {
                entry.retrievedVia = `${entry.retrievedVia}+${item.retrievedVia}`;
            }
        } else {
            chunkMap.set(chunkId, {
                item,
                chunkId,
                semanticRank: null,
                keywordRank: rank,
                semanticScore: null,
                keywordScore: typeof item.score === "number" ? item.score : null,
                rrfScore: keywordRrfTerm,
                retrievalMethods: ["keyword"],
                retrievedVia: item.retrievedVia || "keyword",
            });
        }
    }

    // 3. Sort deterministically
    const mergedList = Array.from(chunkMap.values());

    mergedList.sort((a, b) => {
        // Priority 1: RRF score descending
        if (Math.abs(b.rrfScore - a.rrfScore) > 1e-9) {
            return b.rrfScore - a.rrfScore;
        }

        // Priority 2: Semantic score descending (nulls last)
        const sA = a.semanticScore !== null ? a.semanticScore : -Infinity;
        const sB = b.semanticScore !== null ? b.semanticScore : -Infinity;
        if (Math.abs(sB - sA) > 1e-9) {
            return sB - sA;
        }

        // Priority 3: Keyword score descending (nulls last)
        const kA = a.keywordScore !== null ? a.keywordScore : -Infinity;
        const kB = b.keywordScore !== null ? b.keywordScore : -Infinity;
        if (Math.abs(kB - kA) > 1e-9) {
            return kB - kA;
        }

        // Priority 4: ChunkId ascending for deterministic tie-breaking
        return String(a.chunkId).localeCompare(String(b.chunkId));
    });

    return mergedList.slice(0, safeLimit);
};

/**
 * Assembles a standardized, provenance-preserving evidence item.
 * Preserves source text without rewriting, summarizing, or fabrication.
 *
 * @param {Object} rawItem - Raw chunk document
 * @param {Object} retrievalMetadata - Retrieval provenance metadata
 * @returns {Object} Structured evidence item
 */
export const assembleEvidenceItem = (rawItem, retrievalMetadata = {}) => {
    return {
        chunkId: rawItem?.chunkId || "",
        documentId: rawItem?.documentId?.toString?.() || String(rawItem?.documentId || ""),
        title: rawItem?.metadata?.title || "",
        issuingAuthority: rawItem?.metadata?.issuingAuthority || "",
        jurisdictionLevel: rawItem?.metadata?.jurisdictionLevel || "",
        applicableState: rawItem?.metadata?.applicableState || "ALL",
        applicableDistrict: rawItem?.metadata?.applicableDistrict || "ALL",
        documentType: rawItem?.metadata?.documentType || "",
        officialPortalUrl: rawItem?.metadata?.officialPortalUrl || "",
        originalPdfUrl: rawItem?.metadata?.originalPdfUrl || "",
        sectionHeading: rawItem?.evidence?.sectionHeading || "",
        clauseNumber: rawItem?.evidence?.clauseNumber || "",
        startOffset: typeof rawItem?.evidence?.startOffset === "number" ? rawItem.evidence.startOffset : 0,
        endOffset: typeof rawItem?.evidence?.endOffset === "number" ? rawItem.evidence.endOffset : 0,
        sourceText: rawItem?.content || "",
        retrieval: {
            mode: retrievalMetadata.mode || "unknown",
            retrievalMethods: retrievalMetadata.retrievalMethods || [],
            rrfScore: typeof retrievalMetadata.rrfScore === "number" ? retrievalMetadata.rrfScore : null,
            semanticScore: typeof retrievalMetadata.semanticScore === "number" ? retrievalMetadata.semanticScore : null,
            keywordScore: typeof retrievalMetadata.keywordScore === "number" ? retrievalMetadata.keywordScore : null,
            semanticRank: typeof retrievalMetadata.semanticRank === "number" ? retrievalMetadata.semanticRank : null,
            keywordRank: typeof retrievalMetadata.keywordRank === "number" ? retrievalMetadata.keywordRank : null,
            retrievedVia: retrievalMetadata.retrievedVia || "unknown",
        },
    };
};

/**
 * Main Hybrid Retrieval entry point for Lok-Setu.
 * Retrieves, ranks, and assembles verified evidence chunks from indexed government schemes and policies.
 *
 * @param {string} query - Citizen search or question query
 * @param {Object} [options={}] - Retrieval options
 * @param {"hybrid"|"semantic"|"keyword"} [options.mode="hybrid"] - Retrieval mode
 * @param {number} [options.limit=5] - Final number of evidence items to return
 * @param {number} [options.candidateLimit] - Candidate pool size for ranking (default: max(20, limit * 4))
 * @param {number} [options.numCandidates] - Atlas Vector Search candidate pool
 * @param {Object} [options.filters={}] - Optional metadata filters (jurisdictionLevel, applicableState, etc.)
 * @param {number} [options.rrfK=60] - RRF smoothing parameter
 * @param {boolean} [options.useLocalFallback=true] - Allow local cosine fallback if Atlas is unavailable
 * @param {Function} [options.embeddingGenerator] - Custom embedding generator (useful for testing)
 * @param {import("mongoose").Model} [options.documentChunkModel=DocumentChunk] - Model override
 * @returns {Promise<Array<Object>>} Array of assembled evidence items
 */
export const retrieveEvidence = async (query, options = {}) => {
    // 1. Guard against empty or whitespace-only queries
    if (!query || typeof query !== "string" || !query.trim()) {
        return [];
    }

    const trimmedQuery = query.trim();
    const mode = options.mode || "hybrid";
    const limit = Math.max(1, Number(options.limit) || 5);
    const candidateLimit = options.candidateLimit || Math.max(20, limit * 4);
    const numCandidates = options.numCandidates || Math.max(50, limit * 5);
    const rrfK = options.rrfK || 60;
    const useLocalFallback = options.useLocalFallback !== false;
    const model = options.documentChunkModel || DocumentChunk;

    const normalizedFilter = buildRetrievalFilter(options.filters);

    // 2. Validate embedding configuration if semantic retrieval is requested
    const requiresEmbedding = mode === "hybrid" || mode === "semantic";
    let queryVector = null;

    if (requiresEmbedding) {
        if (typeof options.embeddingGenerator === "function") {
            const generated = await options.embeddingGenerator(trimmedQuery);
            const vectorToValidate = Array.isArray(generated) ? generated : generated?.values;
            queryVector = validateEmbeddingVector(vectorToValidate, 768);
        } else {
            if (!isAiConfigured()) {
                throw new ApiError(
                    503,
                    "Gemini AI API key is not configured for vector embedding generation. Set GEMINI_API_KEY in environment or use mode='keyword'."
                );
            }

            const embeddingResult = await generateEmbeddingWithRetry({
                text: trimmedQuery,
                model: config.ai.embeddingModel,
            });

            queryVector = validateEmbeddingVector(embeddingResult.values, 768);
        }
    }

    // 3. Execute retrieval based on selected mode
    if (mode === "keyword") {
        const keywordCandidates = await retrieveKeywordEvidence({
            query: trimmedQuery,
            filter: normalizedFilter,
            limit,
            model,
        });

        return keywordCandidates.map((item, idx) =>
            assembleEvidenceItem(item, {
                mode: "keyword",
                retrievalMethods: ["keyword"],
                rrfScore: null,
                semanticScore: null,
                keywordScore: item.score,
                semanticRank: null,
                keywordRank: idx + 1,
                retrievedVia: item.retrievedVia,
            })
        );
    }

    if (mode === "semantic") {
        const semanticCandidates = await retrieveSemanticEvidence({
            queryVector,
            filter: normalizedFilter,
            limit,
            numCandidates,
            useLocalFallback,
            model,
        });

        return semanticCandidates.map((item, idx) =>
            assembleEvidenceItem(item, {
                mode: "semantic",
                retrievalMethods: ["semantic"],
                rrfScore: null,
                semanticScore: item.score,
                keywordScore: null,
                semanticRank: idx + 1,
                keywordRank: null,
                retrievedVia: item.retrievedVia,
            })
        );
    }

    // 4. Mode === "hybrid": parallel semantic and keyword execution followed by RRF fusion
    const [semanticCandidates, keywordCandidates] = await Promise.all([
        retrieveSemanticEvidence({
            queryVector,
            filter: normalizedFilter,
            limit: candidateLimit,
            numCandidates,
            useLocalFallback,
            model,
        }),
        retrieveKeywordEvidence({
            query: trimmedQuery,
            filter: normalizedFilter,
            limit: candidateLimit,
            model,
        }),
    ]);

    const fusedResults = computeReciprocalRankFusion({
        semanticResults: semanticCandidates,
        keywordResults: keywordCandidates,
        k: rrfK,
        limit,
    });

    return fusedResults.map((entry) =>
        assembleEvidenceItem(entry.item, {
            mode: "hybrid",
            retrievalMethods: entry.retrievalMethods,
            rrfScore: entry.rrfScore,
            semanticScore: entry.semanticScore,
            keywordScore: entry.keywordScore,
            semanticRank: entry.semanticRank,
            keywordRank: entry.keywordRank,
            retrievedVia: entry.retrievedVia,
        })
    );
};
