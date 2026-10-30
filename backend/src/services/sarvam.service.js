import { config, isSarvamConfigured } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

const SARVAM_TRANSLATE_URL = "https://api.sarvam.ai/translate";
const SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech";

/**
 * Mapping from Lok-Setu 2-letter ISO language codes to Sarvam BCP-47 codes.
 */
export const SARVAM_LANGUAGE_MAP = {
    en: "en-IN",
    hi: "hi-IN",
    gu: "gu-IN",
    mr: "mr-IN",
    kn: "kn-IN",
    ta: "ta-IN",
    te: "te-IN",
    bn: "bn-IN",
};

/**
 * Reverse mapping from BCP-47 to Lok-Setu 2-letter codes.
 */
export const BCP47_TO_LANG = {
    "en-in": "en",
    "hi-in": "hi",
    "gu-in": "gu",
    "mr-in": "mr",
    "kn-in": "kn",
    "ta-in": "ta",
    "te-in": "te",
    "bn-in": "bn",
};

/**
 * Human-readable language names.
 */
export const SARVAM_LANGUAGE_NAMES = {
    en: "English",
    hi: "Hindi (हिन्दी)",
    gu: "Gujarati (ગુજરાતી)",
    mr: "Marathi (मराठी)",
    kn: "Kannada (ಕನ್ನಡ)",
    ta: "Tamil (தமிழ்)",
    te: "Telugu (తెలుగు)",
    bn: "Bengali (বাংলা)",
};

/**
 * Normalizes any language code (e.g. "hi", "hi-IN", "HI") to Sarvam BCP-47 ("hi-IN").
 * Throws 400 ApiError if language is unsupported.
 *
 * @param {string} langCode
 * @returns {string} BCP-47 language tag (e.g. "hi-IN")
 */
export const toSarvamBcp47 = (langCode) => {
    if (!langCode || typeof langCode !== "string") {
        throw new ApiError(400, "Language code is required.");
    }

    const trimmed = langCode.trim().toLowerCase();

    // Already 2-letter
    if (SARVAM_LANGUAGE_MAP[trimmed]) {
        return SARVAM_LANGUAGE_MAP[trimmed];
    }

    // Already BCP-47
    if (BCP47_TO_LANG[trimmed]) {
        const twoLetter = BCP47_TO_LANG[trimmed];
        return SARVAM_LANGUAGE_MAP[twoLetter];
    }

    const supportedKeys = Object.keys(SARVAM_LANGUAGE_MAP).join(", ");
    throw new ApiError(
        400,
        `Language '${langCode}' is not supported by Sarvam pipeline. Supported languages are: ${supportedKeys}`
    );
};

/**
 * Normalizes BCP-47 or 2-letter code back to 2-letter code (e.g. "hi-IN" -> "hi").
 *
 * @param {string} langCode
 * @returns {string} 2-letter ISO code
 */
export const toTwoLetterLang = (langCode) => {
    if (!langCode || typeof langCode !== "string") return "hi";
    const trimmed = langCode.trim().toLowerCase();
    if (SARVAM_LANGUAGE_MAP[trimmed]) return trimmed;
    if (BCP47_TO_LANG[trimmed]) return BCP47_TO_LANG[trimmed];
    return "hi";
};

/**
 * Splits text safely along sentence boundaries and character limits.
 * Handles English, Indic punctuation ('।'), questions, exclamation marks, and newlines.
 *
 * @param {string} text
 * @param {number} [maxChars=2000]
 * @returns {string[]} Chunks each <= maxChars
 */
export const chunkTextForSarvam = (text, maxChars = 2000) => {
    if (!text || typeof text !== "string") return [];
    const trimmed = text.trim();
    if (trimmed.length <= maxChars) return [trimmed];

    // Split by sentence boundaries (Hindi Purna Viram '।', periods, newlines, exclamations, question marks)
    const sentenceRegex = /([^।\n.!?]+[।\n.!?]+|\S+)/g;
    const rawTokens = trimmed.match(sentenceRegex) || [trimmed];

    const chunks = [];
    let currentChunk = "";

    for (const rawToken of rawTokens) {
        const token = rawToken.trim();
        if (!token) continue;

        if (token.length > maxChars) {
            // A single run without punctuation exceeds maxChars; split by words
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
            }
            const words = token.split(/\s+/);
            let subChunk = "";
            for (const word of words) {
                if ((subChunk + " " + word).trim().length > maxChars) {
                    if (subChunk) chunks.push(subChunk.trim());
                    subChunk = word;
                } else {
                    subChunk = subChunk ? `${subChunk} ${word}` : word;
                }
            }
            if (subChunk) chunks.push(subChunk.trim());
            continue;
        }

        if ((currentChunk + " " + token).trim().length > maxChars) {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = token;
        } else {
            currentChunk = currentChunk ? `${currentChunk} ${token}` : token;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
};

/**
 * Concatenates multiple WAV buffers into a single valid WAV file.
 * Preserves the 44-byte standard RIFF header from the first buffer and updates total sizes.
 *
 * @param {Buffer[]} wavBuffers
 * @returns {Buffer}
 */
export const concatWavBuffers = (wavBuffers) => {
    if (!Array.isArray(wavBuffers) || wavBuffers.length === 0) {
        return Buffer.alloc(0);
    }
    if (wavBuffers.length === 1) {
        return wavBuffers[0];
    }

    const first = wavBuffers[0];
    const isWav =
        first.length >= 44 &&
        first.toString("ascii", 0, 4) === "RIFF" &&
        first.toString("ascii", 8, 12) === "WAVE";

    if (!isWav) {
        // Fallback: simple byte concatenation
        return Buffer.concat(wavBuffers);
    }

    // Collect PCM data blocks (skipping 44-byte header of each)
    const dataChunks = wavBuffers.map((b) => (b.length > 44 ? b.subarray(44) : Buffer.alloc(0)));
    const combinedData = Buffer.concat(dataChunks);

    // Create a new 44-byte header from the first buffer
    const header = Buffer.from(first.subarray(0, 44));
    // Update RIFF chunk size (file size - 8)
    header.writeUInt32LE(36 + combinedData.length, 4);
    // Update Subchunk2Size (data size)
    header.writeUInt32LE(combinedData.length, 40);

    return Buffer.concat([header, combinedData]);
};

/**
 * Helper to calculate estimated audio duration in seconds from 16-bit 24kHz mono WAV PCM.
 *
 * @param {Buffer} audioBuffer
 * @param {number} [sampleRate=24000]
 * @returns {number}
 */
export const calculateWavDuration = (audioBuffer, sampleRate = 24000) => {
    if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length <= 44) return 1;
    const pcmBytes = audioBuffer.length - 44;
    const bytesPerSecond = sampleRate * 2; // 16-bit mono = 2 bytes per sample
    const seconds = pcmBytes / bytesPerSecond;
    return Math.max(1, Math.round(seconds * 10) / 10);
};

/**
 * Service class implementing Sarvam AI translation and text-to-speech pipelines.
 */
export class SarvamService {
    constructor(options = {}) {
        this.apiKey = options.apiKey || config.sarvam.apiKey;
        this.translationModel = options.translationModel || config.sarvam.translationModel;
        this.ttsModel = options.ttsModel || config.sarvam.ttsModel;
        this.defaultSpeaker = options.defaultSpeaker || config.sarvam.defaultSpeaker;
        this.timeoutMs = options.timeoutMs || config.sarvam.timeoutMs;
        this.maxRetries = options.maxRetries || config.sarvam.maxRetries;
        this.fetchFn = options.fetchFn || globalThis.fetch;
    }

    /**
     * Translates text into target Indian language using Sarvam Translate API.
     *
     * @param {string} text - Input plain text to translate
     * @param {string} targetLang - Target language (e.g. "hi", "gu", "mr", "hi-IN")
     * @param {string} [sourceLang="auto"] - Source language (default: "auto" or "en-IN")
     * @param {object} [options={}] - Override options (fetchFn, model, etc.)
     * @returns {Promise<{ translatedText: string, sourceLanguage: string, targetLanguage: string }>}
     */
    async translateText(text, targetLang, sourceLang = "auto", options = {}) {
        if (!text || typeof text !== "string" || !text.trim()) {
            return {
                translatedText: "",
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
            };
        }

        const targetBcp47 = toSarvamBcp47(targetLang);
        let sourceBcp47 = "auto";
        if (sourceLang && sourceLang !== "auto") {
            try {
                sourceBcp47 = toSarvamBcp47(sourceLang);
            } catch {
                sourceBcp47 = "auto";
            }
        }

        // If source matches target, return original text directly without API cost
        if (sourceBcp47 !== "auto" && sourceBcp47 === targetBcp47) {
            return {
                translatedText: text.trim(),
                sourceLanguage: sourceBcp47,
                targetLanguage: targetBcp47,
            };
        }

        const activeApiKey = options.apiKey || this.apiKey;
        if (!activeApiKey) {
            throw new ApiError(
                503,
                "Sarvam AI service is not configured. Please set SARVAM_API_KEY in environment variables."
            );
        }

        const model = options.model || this.translationModel;
        const fetchFn = options.fetchFn || this.fetchFn;
        const chunks = chunkTextForSarvam(text, 1900);
        const translatedChunks = [];

        for (const chunk of chunks) {
            const body = {
                input: chunk,
                target_language_code: targetBcp47,
                model: model,
            };
            if (sourceBcp47 !== "auto") {
                body.source_language_code = sourceBcp47;
            }

            let response;
            let attempt = 0;
            const maxAttempts = options.maxRetries || this.maxRetries;

            while (attempt < maxAttempts) {
                attempt++;
                try {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

                    response = await fetchFn(SARVAM_TRANSLATE_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "api-subscription-key": activeApiKey,
                        },
                        body: JSON.stringify(body),
                        signal: controller.signal,
                    });

                    clearTimeout(timer);

                    if (response.ok) {
                        const data = await response.json();
                        translatedChunks.push(data.translated_text || chunk);
                        break;
                    }

                    const errText = await response.text();
                    if (response.status >= 500 && attempt < maxAttempts) {
                        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
                        continue;
                    }
                    throw new ApiError(
                        response.status || 502,
                        `Sarvam translation failed (${response.status}): ${errText}`
                    );
                } catch (err) {
                    if (err instanceof ApiError) throw err;
                    if (attempt >= maxAttempts) {
                        throw new ApiError(502, `Sarvam translation request error: ${err.message}`);
                    }
                    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
                }
            }
        }

        return {
            translatedText: translatedChunks.join(" "),
            sourceLanguage: sourceBcp47,
            targetLanguage: targetBcp47,
        };
    }

    /**
     * Synthesizes audio speech WAV buffer from text using Sarvam Bulbul TTS API.
     *
     * @param {string} text - Text to synthesize into natural speech
     * @param {string} targetLang - Target Indian language (e.g. "hi", "mr", "ta")
     * @param {object} [options={}] - Options { speaker, model, fetchFn, sampleRate }
     * @returns {Promise<{ audioBuffer: Buffer, durationSeconds: number, mimeType: string, speaker: string, model: string, targetLanguage: string }>}
     */
    async synthesizeSpeech(text, targetLang, options = {}) {
        if (!text || typeof text !== "string" || !text.trim()) {
            throw new ApiError(400, "Text is required for speech synthesis.");
        }

        const targetBcp47 = toSarvamBcp47(targetLang);
        const activeApiKey = options.apiKey || this.apiKey;
        if (!activeApiKey) {
            throw new ApiError(
                503,
                "Sarvam AI service is not configured. Please set SARVAM_API_KEY in environment variables."
            );
        }

        const speaker = options.speaker || this.defaultSpeaker;
        const model = options.model || this.ttsModel;
        const sampleRate = options.sampleRate || 24000;
        const fetchFn = options.fetchFn || this.fetchFn;

        // Sarvam TTS supports up to 2500 characters per call
        const chunks = chunkTextForSarvam(text, 2400);
        const audioBuffers = [];

        for (const chunk of chunks) {
            const body = {
                text: chunk,
                target_language_code: targetBcp47,
                speaker: speaker,
                model: model,
                output_audio_codec: "wav",
                speech_sample_rate: sampleRate,
            };

            let response;
            let attempt = 0;
            const maxAttempts = options.maxRetries || this.maxRetries;

            while (attempt < maxAttempts) {
                attempt++;
                try {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

                    response = await fetchFn(SARVAM_TTS_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "api-subscription-key": activeApiKey,
                        },
                        body: JSON.stringify(body),
                        signal: controller.signal,
                    });

                    clearTimeout(timer);

                    if (response.ok) {
                        const data = await response.json();
                        const base64Audio = data.audios && data.audios[0];
                        if (!base64Audio) {
                            throw new ApiError(502, "Sarvam TTS returned an empty audio array.");
                        }
                        const buffer = Buffer.from(base64Audio, "base64");
                        audioBuffers.push(buffer);
                        break;
                    }

                    const errText = await response.text();
                    if (response.status >= 500 && attempt < maxAttempts) {
                        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
                        continue;
                    }
                    throw new ApiError(
                        response.status || 502,
                        `Sarvam TTS failed (${response.status}): ${errText}`
                    );
                } catch (err) {
                    if (err instanceof ApiError) throw err;
                    if (attempt >= maxAttempts) {
                        throw new ApiError(502, `Sarvam TTS request error: ${err.message}`);
                    }
                    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
                }
            }
        }

        const mergedBuffer = concatWavBuffers(audioBuffers);
        const durationSeconds = calculateWavDuration(mergedBuffer, sampleRate);

        return {
            audioBuffer: mergedBuffer,
            durationSeconds,
            mimeType: "audio/wav",
            speaker,
            model,
            targetLanguage: targetBcp47,
        };
    }
}

export const sarvamService = new SarvamService();
