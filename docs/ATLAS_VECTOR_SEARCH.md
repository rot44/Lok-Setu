# Lok-Setu: MongoDB Atlas Vector Search Index Configuration

This document specifies the exact Search Index configuration required for semantic document retrieval on the `documentchunks` collection in MongoDB Atlas.

---

## 1. Overview

Lok-Setu uses dense vector embeddings generated via Google Gemini (`gemini-embedding-001` projected to 768 dimensions or `text-embedding-004`) to power semantic retrieval for citizen queries and document analysis.

- **Database:** `lokSetu`
- **Collection:** `documentchunks`
- **Search Index Name:** `vector_index`
- **Vector Path:** `embedding.values`
- **Vector Dimensions:** `768`
- **Similarity Metric:** `cosine`

---

## 2. Atlas Search Index JSON Definition

When configuring the Vector Search index in the MongoDB Atlas Console:

1. Navigate to your Atlas Cluster -> **Atlas Search**.
2. Click **Create Search Index** -> select **JSON Editor**.
3. Select database `lokSetu` and collection `documentchunks`.
4. Name the index `vector_index`.
5. Paste the following JSON definition:

```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding.values",
      "numDimensions": 768,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "metadata.jurisdictionLevel"
    },
    {
      "type": "filter",
      "path": "metadata.applicableState"
    },
    {
      "type": "filter",
      "path": "metadata.documentType"
    },
    {
      "type": "filter",
      "path": "indexingStatus"
    },
    {
      "type": "filter",
      "path": "documentId"
    }
  ]
}
```

6. Click **Next** and **Create Search Index**. The initial build takes approximately 1 to 3 minutes.

---

## 3. Local Development & Testing Notice

- **Local Standalone MongoDB:** Standard local MongoDB instances (such as a local Docker or standalone Community Server) do not natively run the proprietary Atlas Search `$vectorSearch` engine.
- **Local Fallback:** In local environments without Atlas Search, Lok-Setu's `DocumentChunk` model maintains full MongoDB text search indexes (`content: "text", "metadata.title": "text"`) and exact vector cosine calculations for development and integration verification.
- **Verification Guarantee:** In accordance with Lok-Setu engineering standards, the application does not assume or falsely assert that Atlas Vector Search is operational without verifying cluster connectivity.
