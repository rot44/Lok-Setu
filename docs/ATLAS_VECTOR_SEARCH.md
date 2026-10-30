# Lok-Setu: MongoDB Atlas Vector Search & Hybrid Retrieval Configuration

This document specifies the Search Index configuration, query pipeline, and local fallback behavior for Lok-Setu's Hybrid Retrieval and Evidence Assembly system.

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
      "path": "metadata.issuingAuthority"
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

## 3. How to Verify Atlas Index Status

1. **Atlas Web Console:**
   - In Atlas -> **Atlas Search**, locate `vector_index` on `lokSetu.documentchunks`.
   - Verify that status is **Active** (and initial sync is complete).
2. **Programmatic Verification:**
   - When executing `retrieveEvidence(query, { mode: "semantic" })`, if Atlas Vector Search is active, the returned evidence items will report `retrieval.retrievedVia: "atlas"`.
   - If the index is missing or building, or if running against local MongoDB, the retrieval layer automatically falls back to local in-memory cosine similarity and reports `retrieval.retrievedVia: "local_fallback"`.

---

## 4. Hybrid Retrieval Architecture (Commit 6)

### 4.1 Two-Stream Retrieval
1. **Semantic Vector Retrieval:**
   - Queries `embedding.values` using `$vectorSearch` with cosine similarity.
   - Enforces `indexingStatus: "indexed"` and applies regional/type metadata filters.
   - Returns candidates with vector similarity scores.
2. **Keyword Text Retrieval:**
   - Queries the compound text index on `{ content: "text", "metadata.title": "text" }`.
   - Handles stopword-only queries and empty terms safely without throwing.
   - Returns candidates with MongoDB `textScore`.

### 4.2 Reciprocal Rank Fusion (RRF)
Semantic and keyword results are combined using the standard RRF formula:

$$\text{RRF score} = \sum_{m \in \{\text{semantic}, \text{keyword}\}} \frac{1}{k + \text{rank}_m}$$

- Default smoothing constant: $k = 60$.
- Rank is 1-based ($\text{rank} = 1$ for top result).
- If a chunk appears in only one stream, the missing term is $0$.
- Preserves raw vector similarity and text scores for debugging.
- **Deterministic Tie-Breaking:**
  1. $\text{RRF score}$ descending
  2. $\text{Semantic score}$ descending
  3. $\text{Keyword score}$ descending
  4. $\text{chunkId}$ string ascending (alphabetical order)

### 4.3 Metadata Filtering
The following filters are normalized consistently across Atlas and local queries:
- `jurisdictionLevel`: `"central"`, `"state"`, or `"municipal"`
- `applicableState`: `"ALL"` or specific Indian state (supports arrays with `$in`)
- `documentType`: e.g. `"welfare_policy"`, `"government_notification"`
- `issuingAuthority`: exact issuing department / ministry
- `documentId`: target document ID / ObjectId

---

## 5. Local Development & Standalone Fallback Notice

- **Local Standalone MongoDB:** Standard local MongoDB instances (such as local Community Server or Docker) do not natively run the Atlas Search engine (`$vectorSearch`).
- **Local Fallback:** In local environments without Atlas Search, `retrieval.service.js` automatically calculates exact in-memory cosine similarity:
  $$\text{cosineSimilarity}(A, B) = \frac{A \cdot B}{\|A\| \times \|B\|}$$
- **Verification Guarantee:** In accordance with Lok-Setu engineering standards, the application does not assume or falsely assert that Atlas Vector Search is operational without verifying cluster connectivity. Unconfigured Atlas environments smoothly transition to local calculation without losing evidence provenance.
