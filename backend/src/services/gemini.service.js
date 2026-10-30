import { GoogleGenAI } from "@google/genai";
import { config, isAiConfigured } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

/**
 * Standard Grounding and Civic Safety System Instruction.
 * Strictly enforced across all Gemini model calls in Lok-Setu.
 */
export const CIVIC_GROUNDING_INSTRUCTION = `
You are the AI engine of Lok-Setu, an accessible civic information platform for Indian citizens and businesses.

CRITICAL GROUNDING & SAFETY RULES:
1. Ground every claim strictly in the provided government sources or citizen-uploaded documents.
2. NEVER fabricate, hallucinate, or extrapolate government policies, scheme names, eligibility conditions, funding amounts, deadlines, penalties, or legal rights.
3. If the provided source context does not clearly state or specify the required information, you MUST use this exact sentence verbatim:
   "This document does not clearly specify this information."
4. When explaining or answering, explicitly and clearly distinguish between:
   - Stated in source: Factual information quoted or directly extracted from the official text.
   - AI interpretation: Simplified vernacular explanation or guidance.
5. Preserve accurate legal terminology where necessary (e.g. section numbers, statutory bodies) and explain it in plain, accessible language.
6. For eligibility evaluations, always use non-authoritative phrasing such as "You may be eligible" and include a disclaimer that this is informational guidance, not an authoritative legal determination.
7. Never include sensitive personal identifiable information (PII) or credentials in output.
`.trim();

// Singleton instance cache
let geminiClientInstance = null;

/**
 * Returns the initialized GoogleGenAI client singleton.
 * Throws a clean 503 ApiError if GEMINI_API_KEY is not configured.
 */
export const getGeminiClient = () => {
    if (!isAiConfigured()) {
        throw new ApiError(
            503,
            "Gemini AI service is not configured. Please set GEMINI_API_KEY in your backend .env file."
        );
    }

    if (!geminiClientInstance) {
        geminiClientInstance = new GoogleGenAI({
            apiKey: config.ai.geminiApiKey,
            httpOptions: {
                timeout: config.ai.timeoutMs,
            },
        });
    }

    return geminiClientInstance;
};

/**
 * Helper to safely sanitize and format errors from GoogleGenAI API calls.
 * Ensures API keys or internal stack traces are never exposed to callers.
 */
const handleGeminiError = (error, operationName = "AI generation") => {
    const rawMessage = error?.message || "";

    // Mask any accidental API key exposure in error string
    const sanitizedMessage = rawMessage.replace(/key=[A-Za-z0-9_-]+/gi, "key=***");

    if (sanitizedMessage.includes("API_KEY_INVALID") || sanitizedMessage.includes("401")) {
        return new ApiError(401, "Invalid Gemini API credentials. Please verify GEMINI_API_KEY.");
    }
    if (sanitizedMessage.includes("RESOURCE_EXHAUSTED") || sanitizedMessage.includes("429")) {
        return new ApiError(
            429,
            "Gemini API rate limit exceeded or quota exhausted. Please try again shortly."
        );
    }
    if (sanitizedMessage.includes("DEADLINE_EXCEEDED") || sanitizedMessage.includes("timeout")) {
        return new ApiError(504, `Gemini request timed out during ${operationName}.`);
    }

    return new ApiError(500, `Gemini AI service error during ${operationName}: ${sanitizedMessage}`);
};

/**
 * Generates grounded text content with the primary configured Gemini model.
 *
 * @param {Object} options
 * @param {string} options.prompt - User or task prompt
 * @param {string} [options.systemInstruction] - Additional or overriding system instructions
 * @param {string} [options.model] - Specific model override (defaults to config.ai.model)
 * @param {number} [options.temperature] - Generation temperature (default: 0.2 for strict grounding)
 * @param {number} [options.maxOutputTokens] - Token limit
 * @param {Object} [options.clientOverride] - Optional client override for testing
 * @returns {Promise<string>} Generated text
 */
export const generateGroundedText = async ({
    prompt,
    systemInstruction,
    model = config.ai.model,
    temperature = 0.2,
    maxOutputTokens = 4096,
    clientOverride = null,
}) => {
    const client = clientOverride || getGeminiClient();

    try {
        const combinedSystemInstruction = systemInstruction
            ? `${CIVIC_GROUNDING_INSTRUCTION}\n\n${systemInstruction}`
            : CIVIC_GROUNDING_INSTRUCTION;

        const response = await client.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction: combinedSystemInstruction,
                temperature,
                maxOutputTokens,
            },
        });

        const text = response?.text;
        if (!text) {
            throw new ApiError(500, "Gemini returned an empty response.");
        }

        return text;
    } catch (error) {
        throw handleGeminiError(error, "grounded text generation");
    }
};

/**
 * Generates structured JSON output validated against an expected response schema.
 *
 * @param {Object} options
 * @param {string} options.prompt - Task prompt
 * @param {Object} [options.responseSchema] - Optional JSON Schema definition
 * @param {string} [options.systemInstruction] - Additional system instructions
 * @param {string} [options.model] - Model name override
 * @param {Object} [options.clientOverride] - Optional client override for testing
 * @returns {Promise<Object>} Parsed JSON response
 */
export const generateStructuredJson = async ({
    prompt,
    responseSchema,
    systemInstruction,
    model = config.ai.model,
    clientOverride = null,
}) => {
    const client = clientOverride || getGeminiClient();

    try {
        const combinedSystemInstruction = systemInstruction
            ? `${CIVIC_GROUNDING_INSTRUCTION}\n\n${systemInstruction}\nYou MUST output valid JSON matching the specified structure.`
            : `${CIVIC_GROUNDING_INSTRUCTION}\nYou MUST output valid JSON matching the specified structure.`;

        const requestConfig = {
            systemInstruction: combinedSystemInstruction,
            temperature: 0.1, // Low temperature for high deterministic accuracy
            responseMimeType: "application/json",
        };

        if (responseSchema) {
            requestConfig.responseSchema = responseSchema;
        }

        const response = await client.models.generateContent({
            model,
            contents: prompt,
            config: requestConfig,
        });

        const rawText = response?.text;
        if (!rawText) {
            throw new ApiError(500, "Gemini returned empty structured content.");
        }

        try {
            return JSON.parse(rawText);
        } catch (_parseError) {
            throw new ApiError(500, "Gemini output could not be parsed as valid JSON.");
        }
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw handleGeminiError(error, "structured JSON generation");
    }
};

/**
 * Generates dense vector embeddings using text-embedding-004.
 *
 * @param {Object} options
 * @param {string} options.text - Input text to embed
 * @param {string} [options.model] - Embedding model (defaults to config.ai.embeddingModel)
 * @param {Object} [options.clientOverride] - Optional client override for testing
 * @returns {Promise<number[]>} Array of floating-point embedding coordinates
 */
export const generateEmbedding = async ({
    text,
    model = config.ai.embeddingModel,
    clientOverride = null,
}) => {
    const client = clientOverride || getGeminiClient();

    if (!text || typeof text !== "string" || !text.trim()) {
        throw new ApiError(400, "Valid non-empty text string is required for embedding generation.");
    }

    try {
        const response = await client.models.embedContent({
            model,
            contents: text.trim(),
        });

        const embeddingValues =
            response?.embedding?.values ||
            response?.embeddings?.[0]?.values;

        if (!embeddingValues || !Array.isArray(embeddingValues)) {
            throw new ApiError(500, "Failed to retrieve embedding vector from Gemini response.");
        }

        return embeddingValues;
    } catch (error) {
        throw handleGeminiError(error, "embedding generation");
    }
};

export { isAiConfigured };
