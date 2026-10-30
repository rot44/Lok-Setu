/**
 * Atlas Vector Search Index Configuration for Lok-Setu
 *
 * Collection: `documentchunks`
 * Index Name: `vector_index`
 * Similarity: `cosine`
 * Path: `embedding.values`
 *
 * NOTE: This index definition must be created in MongoDB Atlas Search UI or via
 * the MongoDB Atlas CLI / Admin API on the cluster hosting `lokSetu.documentchunks`.
 */

export const ATLAS_VECTOR_SEARCH_INDEX_NAME = "vector_index";

export const ATLAS_VECTOR_INDEX_DEFINITION = {
    name: ATLAS_VECTOR_SEARCH_INDEX_NAME,
    type: "vectorSearch",
    definition: {
        fields: [
            {
                type: "vector",
                path: "embedding.values",
                numDimensions: 768, // Matches gemini-embedding-001 (with 768 projection) or text-embedding-004
                similarity: "cosine",
            },
            {
                type: "filter",
                path: "metadata.jurisdictionLevel",
            },
            {
                type: "filter",
                path: "metadata.applicableState",
            },
            {
                type: "filter",
                path: "metadata.documentType",
            },
            {
                type: "filter",
                path: "indexingStatus",
            },
            {
                type: "filter",
                path: "documentId",
            },
        ],
    },
};

/**
 * Returns Atlas vector search aggregation stage definition.
 *
 * @param {Object} params
 * @param {number[]} params.queryVector - 768-dimensional query vector
 * @param {number} [params.limit=10] - Number of candidate documents to return
 * @param {number} [params.numCandidates=50] - Search candidate pool
 * @param {Object} [params.filter] - Optional metadata filter conditions
 * @returns {Object} MongoDB $vectorSearch aggregation stage
 */
export const buildAtlasVectorSearchStage = ({
    queryVector,
    limit = 10,
    numCandidates = 50,
    filter,
}) => {
    const stage = {
        $vectorSearch: {
            index: ATLAS_VECTOR_SEARCH_INDEX_NAME,
            path: "embedding.values",
            queryVector,
            numCandidates: Math.max(numCandidates, limit * 3),
            limit,
        },
    };

    if (filter && Object.keys(filter).length > 0) {
        stage.$vectorSearch.filter = filter;
    }

    return stage;
};
