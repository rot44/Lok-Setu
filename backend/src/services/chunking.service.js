import crypto from "node:crypto";

/**
 * Standard default chunking parameters for Indian civic & policy documents
 */
export const DEFAULT_CHUNKING_CONFIG = {
    chunkSize: 800,        // Target maximum characters per chunk (~150-200 words)
    chunkOverlap: 150,     // Character overlap between contiguous chunks
    minChunkSize: 80,      // Minimum characters to justify an independent chunk
};

/**
 * Generates a SHA-256 hash of normalized text content.
 *
 * @param {string} text
 * @returns {string} 64-character hex hash
 */
export const computeContentHash = (text) => {
    return crypto
        .createHash("sha256")
        .update(typeof text === "string" ? text.trim() : "")
        .digest("hex");
};

/**
 * Generates a deterministic, reproducible chunk ID from document ID, index, and content hash.
 *
 * @param {string} documentId
 * @param {number} chunkIndex
 * @param {string} contentHash
 * @returns {string} Deterministic chunk identifier
 */
export const generateChunkId = (documentId, chunkIndex, contentHash) => {
    const docIdStr = String(documentId || "doc");
    const shortHash = (contentHash || "hash").slice(0, 10);
    return `doc_${docIdStr}_chunk_${chunkIndex}_${shortHash}`;
};

/**
 * Detects whether a line represents a meaningful civic/legal section heading.
 *
 * Matches:
 * - Markdown headings (# Heading, ## Heading)
 * - Numbered provisions (e.g. "1. Short Title and Commencement", "3. Eligibility Criteria")
 * - Statutory clauses (e.g. "Section 4.", "Clause 6(a)", "Article 21")
 * - Uppercase section markers (e.g. "ELIGIBILITY CRITERIA:", "HOW TO APPLY:")
 */
const detectHeading = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    // 1. Markdown headings (# Heading, ## Heading)
    if (/^#{1,4}\s+(.+)$/.test(trimmed)) {
        return trimmed.replace(/^#{1,4}\s+/, "");
    }

    // 2. Statutory provisions (Section 4, Clause 2, Rule 5, Article 19)
    if (/^(?:Section|Clause|Article|Rule|Chapter|Schedule|Part)\s+\d+[\.:]?/i.test(trimmed)) {
        return trimmed;
    }

    // 3. Numbered section titles (e.g. "1. Eligibility Conditions", "4. Financial Assistance")
    if (/^\d{1,2}[\.\)]\s+[A-Z][A-Za-z0-9\s&/\-–—]{2,}/.test(trimmed)) {
        return trimmed;
    }

    // 4. Uppercase headings ending with optional colon (e.g. "BENEFITS AND ENTITLEMENTS:")
    if (/^[A-Z0-9\s&/\-–—]{4,60}:?$/.test(trimmed) && trimmed.length >= 4) {
        return trimmed.replace(/:$/, "");
    }

    return null;
};

/**
 * Extracts clause or provision numbers (e.g. "1.", "Section 4", "(b)") if present.
 */
const detectClauseNumber = (line) => {
    const trimmed = line.trim();
    const statutoryMatch = trimmed.match(/^(?:Section|Clause|Article|Rule)\s+\d+(?:\([a-z0-9]+\))?/i);
    if (statutoryMatch) return statutoryMatch[0];

    const numberedMatch = trimmed.match(/^(\d{1,3}[\.\)])/);
    if (numberedMatch) return numberedMatch[1];

    const subclauseMatch = trimmed.match(/^(\([a-z0-9]+\))/i);
    if (subclauseMatch) return subclauseMatch[1];

    return "";
};

/**
 * Splits raw document text into semantic blocks while preserving clauses and headings.
 */
const splitIntoSemanticBlocks = (text) => {
    // Normalize newlines and remove null characters
    const normalized = text.replace(/\r\n/g, "\n").replace(/\0/g, "");

    // Split on paragraph boundaries (double newlines)
    const rawParagraphs = normalized.split(/\n{2,}/);
    const blocks = [];

    let currentOffset = 0;

    for (const paragraph of rawParagraphs) {
        const trimmed = paragraph.trim();
        if (!trimmed) {
            currentOffset += paragraph.length + 2;
            continue;
        }

        // Find actual start offset in normalized text
        const actualStart = normalized.indexOf(trimmed, currentOffset);
        const startOffset = actualStart !== -1 ? actualStart : currentOffset;
        const endOffset = startOffset + trimmed.length;
        currentOffset = endOffset;

        const heading = detectHeading(trimmed);
        const clause = detectClauseNumber(trimmed);

        blocks.push({
            text: trimmed,
            startOffset,
            endOffset,
            heading: heading || "",
            clause: clause || "",
        });
    }

    return { normalized, blocks };
};

/**
 * Robust document chunking service for Indian government schemes, gazettes, and policies.
 *
 * @param {Object} params
 * @param {string} params.text - Raw extracted document text
 * @param {string|Object} params.documentId - Source document ID
 * @param {Object} [params.metadata] - Useful document metadata to embed with chunks
 * @param {Object} [params.options] - Chunking configuration options
 * @param {number} [params.options.chunkSize=800] - Target maximum characters per chunk
 * @param {number} [params.options.chunkOverlap=150] - Character overlap between chunks
 * @param {number} [params.options.minChunkSize=80] - Minimum character threshold
 * @returns {Array<Object>} Deterministic, enriched document chunk specifications
 */
export const chunkDocumentText = ({
    text,
    documentId,
    metadata = {},
    options = {},
}) => {
    if (!text || typeof text !== "string" || !text.trim()) {
        return [];
    }

    const docIdStr = String(documentId?._id || documentId || "unassigned");
    const config = { ...DEFAULT_CHUNKING_CONFIG, ...options };

    const { normalized, blocks } = splitIntoSemanticBlocks(text);
    if (blocks.length === 0) {
        return [];
    }

    const chunks = [];
    let currentChunkText = "";
    let currentStartOffset = 0;
    let currentEndOffset = 0;
    let currentHeading = "";
    let currentClause = "";

    // Track heading state across blocks
    let activeHeading = "";

    const flushChunk = () => {
        const trimmedChunk = currentChunkText.trim();
        if (trimmedChunk.length >= config.minChunkSize || (chunks.length === 0 && trimmedChunk.length > 0)) {
            const contentHash = computeContentHash(trimmedChunk);
            const chunkIndex = chunks.length;
            const chunkId = generateChunkId(docIdStr, chunkIndex, contentHash);

            chunks.push({
                chunkId,
                documentId: docIdStr,
                chunkIndex,
                content: trimmedChunk,
                contentHash,
                evidence: {
                    startOffset: currentStartOffset,
                    endOffset: currentEndOffset,
                    sectionHeading: currentHeading || activeHeading || "",
                    clauseNumber: currentClause || "",
                },
                metadata: {
                    title: metadata.title || "",
                    documentType: metadata.documentType || "",
                    jurisdictionLevel: metadata.jurisdictionLevel || "",
                    applicableState: metadata.applicableState || "ALL",
                    applicableDistrict: metadata.applicableDistrict || "ALL",
                    issuingAuthority: metadata.issuingAuthority || "",
                    officialPortalUrl: metadata.officialPortalUrl || "",
                    originalPdfUrl: metadata.originalPdfUrl || "",
                    tags: Array.isArray(metadata.tags) ? [...metadata.tags] : [],
                },
            });
        }
    };

    for (const block of blocks) {
        if (block.heading) {
            activeHeading = block.heading;
        }

        // If a single block exceeds the max chunk size, break it into smaller sentence or word units
        if (block.text.length > config.chunkSize) {
            // First flush any pending accumulated text
            if (currentChunkText.trim()) {
                flushChunk();
                currentChunkText = "";
            }

            // Split large block by sentences, and break long sentences into word units
            const rawSentences = block.text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [block.text];
            const units = [];
            for (const s of rawSentences) {
                if (s.length <= config.chunkSize) {
                    units.push(s);
                } else {
                    const words = s.split(/\s+/);
                    let currentWordUnit = "";
                    for (const w of words) {
                        if ((currentWordUnit + " " + w).trim().length <= config.chunkSize) {
                            currentWordUnit += (currentWordUnit ? " " : "") + w;
                        } else {
                            if (currentWordUnit) units.push(currentWordUnit);
                            currentWordUnit = w;
                        }
                    }
                    if (currentWordUnit) units.push(currentWordUnit);
                }
            }

            let subChunkText = "";
            let subStartOffset = block.startOffset;

            for (const unit of units) {
                if (subChunkText.length + unit.length <= config.chunkSize) {
                    if (!subChunkText) subStartOffset = normalized.indexOf(unit, subStartOffset);
                    subChunkText += (subChunkText ? " " : "") + unit;
                } else {
                    if (subChunkText.trim()) {
                        currentChunkText = subChunkText;
                        currentStartOffset = subStartOffset;
                        currentEndOffset = subStartOffset + subChunkText.length;
                        currentHeading = activeHeading;
                        currentClause = block.clause;
                        flushChunk();
                    }
                    subChunkText = unit;
                    const idx = normalized.indexOf(unit, subStartOffset);
                    subStartOffset = idx !== -1 ? idx : subStartOffset;
                }
            }

            if (subChunkText.trim()) {
                currentChunkText = subChunkText;
                currentStartOffset = subStartOffset;
                currentEndOffset = subStartOffset + subChunkText.length;
                currentHeading = activeHeading;
                currentClause = block.clause;
                flushChunk();
                currentChunkText = "";
            }
            continue;
        }

        // Normal accumulation with overlap
        if (!currentChunkText) {
            currentChunkText = block.text;
            currentStartOffset = block.startOffset;
            currentEndOffset = block.endOffset;
            currentHeading = activeHeading;
            currentClause = block.clause;
        } else if (currentChunkText.length + block.text.length + 1 <= config.chunkSize) {
            currentChunkText += "\n\n" + block.text;
            currentEndOffset = block.endOffset;
            if (block.clause && !currentClause) {
                currentClause = block.clause;
            }
        } else {
            // Chunk threshold reached: flush current chunk
            flushChunk();

            // Compute overlap from end of current chunk
            let overlapText = "";
            if (config.chunkOverlap > 0 && currentChunkText.length > config.chunkOverlap) {
                const words = currentChunkText.split(/\s+/);
                let acc = "";
                for (let i = words.length - 1; i >= 0; i--) {
                    if ((words[i] + " " + acc).length <= config.chunkOverlap) {
                        acc = words[i] + (acc ? " " : "") + acc;
                    } else {
                        break;
                    }
                }
                overlapText = acc;
            }

            currentChunkText = overlapText ? `${overlapText}\n\n${block.text}` : block.text;
            currentStartOffset = block.startOffset;
            currentEndOffset = block.endOffset;
            currentHeading = activeHeading;
            currentClause = block.clause;
        }
    }

    // Flush final chunk
    if (currentChunkText.trim()) {
        flushChunk();
    }

    // Enrich chunks with totalChunks count
    const totalChunks = chunks.length;
    for (const chunk of chunks) {
        chunk.totalChunks = totalChunks;
    }

    return chunks;
};
