# Lok-Setu: Official Policy Document Ingestion Architecture

This document describes the design, security controls, document format processing, and operational lifecycle of Lok-Setu's Official Policy Document Ingestion service.

---

## 1. Overview

Lok-Setu maintains an authoritative civic knowledge base of Indian government schemes, policies, gazettes, circulars, and municipal notices. The **Official Policy Document Ingestion** pipeline allows administrators and authorized officials to register and ingest verified policy documents into the knowledge base.

Ingestion performs:
1. **Source Validation:** Enforces strict Server-Side Request Forgery (SSRF) protections.
2. **Safe Fetching:** Downloads external source documents with size, redirect, and timeout limits.
3. **Format Extraction:** Parses PDF, HTML, and Plain text into clean, normalized text.
4. **Idempotency & Content Hashing:** Computes deterministic SHA-256 hashes to prevent redundant processing.
5. **Document State Tracking:** Updates the `Document` collection with full provenance.
6. **Vector & Keyword Indexing:** Automatically triggers chunking and dense vector embedding generation via `indexingService`.

---

## 2. API Endpoints

### 2.1 Ingest Document
- **Route:** `POST /api/v1/documents/ingest`
- **Access:** Private (`admin` and `official` roles only; ordinary citizens are denied access with `403 Forbidden`)
- **Headers:** `Authorization: Bearer <token>` or HTTP-only auth cookie

#### Request Payload
```json
{
  "sourceUrl": "https://pib.gov.in/PressReleasePage.aspx?PRID=1987654",
  "title": "Pradhan Mantri Kisan Samman Nidhi Operational Guidelines 2026",
  "issuingAuthority": "Ministry of Agriculture & Farmers Welfare",
  "jurisdictionLevel": "central",
  "applicableState": "ALL",
  "applicableDistrict": "ALL",
  "documentType": "welfare_policy",
  "language": "en",
  "publicationDate": "2026-01-15T00:00:00.000Z",
  "effectiveDate": "2026-02-01T00:00:00.000Z",
  "tags": ["agriculture", "farmer_welfare", "dbt", "kisan"]
}
```

*Alternatively, direct text can be submitted using the `rawText` field instead of `sourceUrl`.*

#### Response (201 Created)
```json
{
  "statusCode": 201,
  "data": {
    "success": true,
    "isDuplicate": false,
    "updated": false,
    "documentId": "664fa7123456789abcdef012",
    "contentHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "chunkCount": 14,
    "ingestionStatus": "indexed",
    "indexingStatus": "indexed",
    "message": "Official policy document ingested and indexed successfully."
  },
  "message": "Official policy document ingested and indexed successfully.",
  "success": true
}
```

---

## 3. Server-Side Request Forgery (SSRF) Protection

When fetching documents from external government portals, `ingestion.service.js` enforces multi-layer network security controls:

1. **Protocol Restriction:**
   - Only `http:` and `https:` protocols are accepted. Protocols like `file:`, `ftp:`, `gopher:`, `data:`, and `javascript:` are rejected immediately.
2. **Loopback & Private Address Blocking:**
   - `127.0.0.0/8`, `::1` (Loopback)
   - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 Private)
   - `169.254.0.0/16` (Link-local)
   - `100.64.0.0/10` (Carrier-grade NAT)
   - `fc00::/7`, `fe80::/10` (IPv6 ULA & Link-local)
   - Reserved and multicast subnets (`224.0.0.0/4`, `240.0.0.0/4`)
3. **Cloud Instance Metadata Protection:**
   - Explicitly rejects `169.254.169.254` (AWS, GCP, Azure metadata service).
   - Explicitly rejects internal hostnames: `metadata.google.internal`, `instance-data`, `localhost`, `*.internal`, `*.local`.
4. **DNS Resolution Verification:**
   - Resolves target hostnames via DNS (`dns.promises.lookup`) and validates *every* resolved IP address before making the HTTP connection.
5. **Redirect Destination Re-validation:**
   - HTTP redirects (301, 302, 303, 307, 308) are handled manually (`redirect: "manual"`).
   - Every redirect target URL is passed back through DNS resolution and IP verification to prevent redirect-based SSRF into internal VPCs.
   - Redirect limit: strictly capped at `3` hops.
6. **Resource Limits & Timeouts:**
   - Request timeout: 10 seconds via `AbortController`.
   - Maximum response size: 15 MB. Requests exceeding this limit or declaring a large `Content-Length` are aborted immediately.
7. **Credential Protection:**
   - No application cookies, authorization tokens, or secrets are forwarded to external hosts.
   - Query parameters with tokens/keys are redacted in diagnostics via `sanitizeUrlForLogging`.

---

## 4. Supported Document Formats

| Format | MIME Types | Detection | Parser / Engine |
| :--- | :--- | :--- | :--- |
| **PDF** | `application/pdf` | Magic bytes `%PDF` (`0x25 0x50 0x44 0x46`) | `pdf-parse` (PDF.js modern ESM) |
| **HTML** | `text/html` | HTML tags, doctype declaration | Structural tag-to-newline converter & entity decoder |
| **Plain Text** | `text/plain` | Valid UTF-8 text, zero binary null bytes | UTF-8 decoder & text normalizer |

### 4.1 Scanned PDF & OCR Limitations
- Scanned PDFs (raster images saved inside a PDF envelope) contain pages but no digital font text layer.
- `ingestion.service.js` inspects extracted text length. If a multi-page document yields fewer than 50 total characters, it is flagged as:
  ```json
  {
    "ingestionStatus": "requires_ocr",
    "indexingStatus": "unindexed"
  }
  ```
- **Zero Fabrication Guarantee:** Lok-Setu does not synthesize or guess missing text. In accordance with architectural boundaries, documents requiring OCR are recorded for future optical recognition rather than pretending ingestion succeeded.

---

## 5. Idempotency & Document Updates

- **Stable Content Hash:** Extracted normalized text is hashed using SHA-256 (`crypto.createHash("sha256")`).
- **Duplicate Ingestion:**
  - If a document with matching `officialSourceUrl` (or `title` + `issuingAuthority`) already exists with the same `contentHash` and status `indexed`, the service returns `isDuplicate: true, updated: false` without triggering redundant chunking or Gemini embedding API calls.
- **Document Revisions / Controlled Updates:**
  - If the source document content has changed (`existingDoc.contentHash !== newContentHash`):
  - Updates the `Document` record with the new text and hash.
  - Triggers `indexingService.indexDocument(doc)`, which cleanly deletes all previous `DocumentChunk` records for that document and inserts the new chunks.
  - Ensures no stale chunks remain retrievable in semantic or keyword search.

---

## 6. Ingestion & Indexing States

| Ingestion Status (`ingestionStatus`) | Indexing Status (`indexingStatus`) | Meaning |
| :--- | :--- | :--- |
| `pending` | `unindexed` | Source registered; download/extraction queued |
| `fetching` | `unindexed` | Downloading remote source file |
| `extracting` | `unindexed` | Extracting text from PDF/HTML |
| `processing` | `indexing` | Chunking text and generating Gemini embeddings |
| `indexed` | `indexed` | Successfully extracted, chunked, and searchable in hybrid retrieval |
| `requires_ocr` | `unindexed` | Scanned document lacking digital text layer |
| `failed` | `failed` | Download, extraction, or embedding generation failed (recoverable) |

---

## 7. Metadata Provenance

The `Document` model cleanly distinguishes metadata origin to prevent unverified assumptions:
- `metadataProvenance.officialSource`: Extracted directly from official headers or document text.
- `metadataProvenance.adminSupplied`: Verified attributes explicitly provided by the authorized official.
- `metadataProvenance.systemInferred`: System-inferred properties (e.g. detected language, character count).

---

## 8. Running Ingestion Tests

To run the complete test suite including ingestion, retrieval, chunking, and configuration:

```bash
cd backend
npm test
```

To run only the ingestion test suite:

```bash
cd backend
node --test test/ingestion.test.js
```
