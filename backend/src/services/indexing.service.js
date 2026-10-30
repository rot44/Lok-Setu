import { Document } from "../models/document.model.js";
import { DocumentChunk } from "../models/documentChunk.model.js";
import { chunkDocumentText } from "./chunking.service.js";
import { generateEmbeddingBatchWithRetry } from "./embedding.service.js";
import { ApiError } from "../utils/apiError.js";

/**
 * Reusable Document Indexing Service for Lok-Setu.
 * Chunks documents, generates Gemini embeddings, and persists them idempotently.
 */
export const indexingService = {
    /**
     * Indexes a single document record.
     * Idempotent: cleanly removes any existing chunks for this document before persisting new chunks.
     *
     * @param {string|Object} docOrId - Document instance or MongoDB ObjectId string
     * @param {Object} [options]
     * @param {string} [options.model] - Embedding model override
     * @param {Function} [options.embeddingGenerator] - Custom embedding generator (useful for isolated unit tests)
     * @param {Object} [options.chunkingOptions] - Custom chunking parameters (chunkSize, overlap)
     * @returns {Promise<Object>} Indexing execution result
     */
    indexDocument: async (docOrId, options = {}) => {
        let doc = docOrId;
        if (!doc || typeof doc !== "object" || !doc.rawExtractedText) {
            const docId = docOrId?._id || docOrId;
            doc = await Document.findById(docId);
            if (!doc) {
                throw new ApiError(404, `Document ${docId} not found for indexing.`);
            }
        }

        const rawText = doc.rawExtractedText;
        if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
            await Document.findByIdAndUpdate(doc._id, {
                indexingStatus: "failed",
                indexingError: "Document contains empty or invalid raw extracted text.",
            });
            throw new ApiError(400, `Document ${doc._id} has no valid raw extracted text to index.`);
        }

        // Set status to indexing
        await Document.findByIdAndUpdate(doc._id, {
            indexingStatus: "indexing",
            indexingError: null,
        });

        try {
            // 1. Chunk document text
            const metadata = {
                title: doc.title || "",
                documentType: doc.documentType || "",
                jurisdictionLevel: doc.jurisdictionLevel || "",
                applicableState: doc.applicableState || "ALL",
                applicableDistrict: doc.applicableDistrict || "ALL",
                issuingAuthority: doc.issuingAuthority || "",
                officialPortalUrl: doc.officialPortalUrl || "",
                originalPdfUrl: doc.originalPdfUrl || "",
                tags: Array.isArray(doc.tags) ? doc.tags : [],
            };

            const chunks = chunkDocumentText({
                text: rawText,
                documentId: doc._id,
                metadata,
                options: options.chunkingOptions,
            });

            if (!chunks || chunks.length === 0) {
                throw new ApiError(400, "Text chunking produced zero valid chunks.");
            }

            // 2. Generate embeddings for all chunks in batch
            const chunkTexts = chunks.map((c) => c.content);
            const embeddingFn = options.embeddingGenerator || generateEmbeddingBatchWithRetry;

            const embeddings = await embeddingFn({
                texts: chunkTexts,
                model: options.model,
            });

            if (!embeddings || embeddings.length !== chunks.length) {
                throw new ApiError(
                    500,
                    `Embedding count mismatch: generated ${embeddings?.length} embeddings for ${chunks.length} chunks.`
                );
            }

            // 3. Assemble complete DocumentChunk records
            const chunkRecords = chunks.map((chunk, idx) => ({
                chunkId: chunk.chunkId,
                documentId: doc._id,
                chunkIndex: chunk.chunkIndex,
                totalChunks: chunk.totalChunks,
                content: chunk.content,
                contentHash: chunk.contentHash,
                evidence: chunk.evidence,
                metadata: chunk.metadata,
                embedding: {
                    values: embeddings[idx].values,
                    model: embeddings[idx].model || "gemini-embedding-001",
                    dimensions: embeddings[idx].dimensions || embeddings[idx].values.length,
                },
                indexingStatus: "indexed",
                indexingError: null,
            }));

            // 4. Idempotently write to MongoDB: delete any existing stale chunks, then insert new chunks
            await DocumentChunk.deleteMany({ documentId: doc._id });
            await DocumentChunk.insertMany(chunkRecords, { ordered: true });

            // 5. Update parent Document state
            await Document.findByIdAndUpdate(doc._id, {
                indexingStatus: "indexed",
                indexedChunkCount: chunkRecords.length,
                lastIndexedAt: new Date(),
                indexingError: null,
            });

            return {
                success: true,
                documentId: String(doc._id),
                chunkCount: chunkRecords.length,
                embeddingModel: chunkRecords[0].embedding.model,
                embeddingDimensions: chunkRecords[0].embedding.dimensions,
                chunks: chunkRecords,
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown indexing error";

            await Document.findByIdAndUpdate(doc._id, {
                indexingStatus: "failed",
                indexingError: errorMsg,
            });

            throw error;
        }
    },

    /**
     * Re-indexes an existing document by ID, replacing stale chunks.
     *
     * @param {string} documentId
     * @param {Object} [options]
     * @returns {Promise<Object>}
     */
    reindexDocument: async (documentId, options = {}) => {
        return indexingService.indexDocument(documentId, options);
    },

    /**
     * Cleans up all index chunks and marks document unindexed.
     *
     * @param {string} documentId
     * @returns {Promise<number>} Number of deleted chunks
     */
    deleteDocumentIndex: async (documentId) => {
        const result = await DocumentChunk.deleteMany({ documentId });
        await Document.findByIdAndUpdate(documentId, {
            indexingStatus: "unindexed",
            indexedChunkCount: 0,
            lastIndexedAt: null,
            indexingError: null,
        });
        return result.deletedCount || 0;
    },

    /**
     * Finds and indexes all documents that are unindexed or failed.
     *
     * @param {Object} [options]
     * @returns {Promise<Object>} Batch summary
     */
    indexAllPendingDocuments: async (options = {}) => {
        const pendingDocs = await Document.find({
            $or: [{ indexingStatus: "unindexed" }, { indexingStatus: "failed" }, { indexingStatus: null }],
        });

        const results = {
            totalFound: pendingDocs.length,
            indexedCount: 0,
            failedCount: 0,
            failures: [],
        };

        for (const doc of pendingDocs) {
            try {
                await indexingService.indexDocument(doc, options);
                results.indexedCount++;
            } catch (err) {
                results.failedCount++;
                results.failures.push({
                    documentId: doc._id,
                    title: doc.title,
                    error: err.message,
                });
            }
        }

        return results;
    },
};
