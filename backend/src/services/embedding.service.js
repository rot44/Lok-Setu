import { getGeminiClient, isAiConfigured } from "./gemini.service.js";
import { config } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

/**
 * Validates an embedding vector.
 * Rejects empty arrays, non-number items, NaN, Infinity, or zero-dimension vectors.
 *
 * @param {any} vector
 * @param {number} [expectedDimension]
 * @returns {number[]} Validated vector
 */
export const validateEmbeddingVector = (vector, expectedDimension) => {
    if (!Array.isArray(vector) || vector.length === 0) {
        throw new ApiError(500, "Invalid embedding vector: returned vector is empty or not an array.");
    }

    if (expectedDimension && vector.length !== expectedDimension) {
        throw new ApiError(
            500,
            `Embedding dimension mismatch: expected ${expectedDimension}, received ${vector.length}.`
        );
    }

    for (let i = 0; i < vector.length; i++) {
        const val = vector[i];
        if (typeof val !== "number" || isNaN(val) || !isFinite(val)) {
            throw new ApiError(
                500,
                `Invalid embedding vector: coordinate at index ${i} is not a valid finite number.`
            );
        }
    }

    return vector;
};

/**
 * Sleep helper for retry backoff.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Checks whether an error is transient and eligible for retry.
 */
const isTransientError = (error) => {
    const msg = error?.message || "";
    const status = error?.statusCode || error?.status || 0;

    return (
        status === 429 ||
        status === 503 ||
        status === 504 ||
        msg.includes("429") ||
        msg.includes("503") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.includes("DEADLINE_EXCEEDED") ||
        msg.includes("fetch failed") ||
        msg.includes("timeout") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ECONNRESET")
    );
};

/**
 * Normalizes model name for Gemini API.
 * Maps legacy `text-embedding-004` to `gemini-embedding-001` with 768 dimensions.
 */
const resolveEmbeddingModel = (requestedModel) => {
    const model = requestedModel || config.ai.embeddingModel || "gemini-embedding-001";
    if (model === "text-embedding-004") {
        return {
            modelName: "gemini-embedding-001",
            outputDimensionality: 768,
        };
    }
    return {
        modelName: model,
        outputDimensionality: undefined,
    };
};

/**
 * Generates an embedding for a single text with bounded retries.
 *
 * @param {Object} params
 * @param {string} params.text - Non-empty text string
 * @param {string} [params.model] - Model name override
 * @param {number} [params.maxRetries=3] - Maximum retry attempts
 * @returns {Promise<{ values: number[], model: string, dimensions: number }>}
 */
export const generateEmbeddingWithRetry = async ({
    text,
    model = config.ai.embeddingModel,
    maxRetries = config.ai.maxRetries || 3,
}) => {
    if (!text || typeof text !== "string" || !text.trim()) {
        throw new ApiError(400, "Text is required for embedding generation and cannot be empty.");
    }

    const { modelName, outputDimensionality } = resolveEmbeddingModel(model);
    const client = getGeminiClient();

    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
        try {
            const requestPayload = {
                model: modelName,
                contents: text.trim(),
            };

            if (outputDimensionality) {
                requestPayload.config = { outputDimensionality };
            }

            const response = await client.models.embedContent(requestPayload);
            const rawVector =
                response?.embedding?.values ||
                response?.embeddings?.[0]?.values;

            const validatedVector = validateEmbeddingVector(rawVector);

            return {
                values: validatedVector,
                model: modelName,
                dimensions: validatedVector.length,
            };
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries && isTransientError(error)) {
                attempt++;
                const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 200, 10000);
                await sleep(backoffMs);
                continue;
            }

            // Non-transient or retries exhausted
            break;
        }
    }

    const errorMsg = lastError?.message || "Unknown embedding failure";
    throw new ApiError(
        500,
        `Embedding generation failed after ${attempt} retries: ${errorMsg.replace(/key=[A-Za-z0-9_-]+/gi, "key=***")}`
    );
};

/**
 * Generates embeddings in batches for multiple texts with batching and bounded retries.
 *
 * @param {Object} params
 * @param {string[]} params.texts - Array of non-empty text strings
 * @param {string} [params.model] - Model name
 * @param {number} [params.batchSize=10] - Number of texts per batch
 * @param {number} [params.maxRetries=3] - Maximum retry attempts per batch
 * @returns {Promise<Array<{ values: number[], model: string, dimensions: number }>>}
 */
export const generateEmbeddingBatchWithRetry = async ({
    texts,
    model = config.ai.embeddingModel,
    batchSize = 10,
    maxRetries = config.ai.maxRetries || 3,
}) => {
    if (!Array.isArray(texts) || texts.length === 0) {
        return [];
    }

    // Validate that all items are non-empty strings
    for (let i = 0; i < texts.length; i++) {
        if (!texts[i] || typeof texts[i] !== "string" || !texts[i].trim()) {
            throw new ApiError(400, `Text at index ${i} is empty or not a valid string.`);
        }
    }

    const { modelName, outputDimensionality } = resolveEmbeddingModel(model);
    const client = getGeminiClient();

    const results = [];

    // Process in batches
    for (let i = 0; i < texts.length; i += batchSize) {
        const batchSlice = texts.slice(i, i + batchSize);
        let attempt = 0;
        let batchSuccess = false;

        while (attempt <= maxRetries && !batchSuccess) {
            try {
                const requestPayload = {
                    model: modelName,
                    contents: batchSlice.map((t) => t.trim()),
                };

                if (outputDimensionality) {
                    requestPayload.config = { outputDimensionality };
                }

                const response = await client.models.embedContent(requestPayload);

                const rawEmbeddings = response?.embeddings || [];
                if (!Array.isArray(rawEmbeddings) || rawEmbeddings.length !== batchSlice.length) {
                    throw new ApiError(
                        500,
                        `Batch embedding count mismatch: sent ${batchSlice.length}, received ${rawEmbeddings.length}.`
                    );
                }

                for (let j = 0; j < rawEmbeddings.length; j++) {
                    const vector = rawEmbeddings[j]?.values;
                    const validated = validateEmbeddingVector(vector);
                    results.push({
                        values: validated,
                        model: modelName,
                        dimensions: validated.length,
                    });
                }

                batchSuccess = true;
            } catch (error) {
                if (attempt < maxRetries && isTransientError(error)) {
                    attempt++;
                    const backoffMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 200, 10000);
                    await sleep(backoffMs);
                } else {
                    const errorMsg = error?.message || "Unknown error";
                    throw new ApiError(
                        500,
                        `Batch embedding failed for batch starting at index ${i}: ${errorMsg.replace(/key=[A-Za-z0-9_-]+/gi, "key=***")}`
                    );
                }
            }
        }
    }

    return results;
};
