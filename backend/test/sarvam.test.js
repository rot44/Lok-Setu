import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
    sarvamService,
    SarvamService,
    SARVAM_LANGUAGE_MAP,
    toSarvamBcp47,
    toTwoLetterLang,
    chunkTextForSarvam,
    concatWavBuffers,
    calculateWavDuration,
} from "../src/services/sarvam.service.js";
import { getOrGenerateSchemeAudio, streamSchemeAudio } from "../src/controllers/explore.controller.js";
import { getOrGenerateNoticeAudio, streamNoticeAudio } from "../src/controllers/analysis.controller.js";
import { Document } from "../src/models/document.model.js";
import { Explainer } from "../src/models/explainer.model.js";
import { UserAnalyzedDocument } from "../src/models/userAnalyzedDocument.model.js";

/**
 * Helper to generate a minimal valid 44-byte PCM WAV header for testing
 */
const createDummyWavBuffer = (pcmDataLength = 48000) => {
    const buffer = Buffer.alloc(44 + pcmDataLength);
    // RIFF identifier
    buffer.write("RIFF", 0, "ascii");
    // File size - 8
    buffer.writeUInt32LE(36 + pcmDataLength, 4);
    // WAVE identifier
    buffer.write("WAVE", 8, "ascii");
    // fmt subchunk
    buffer.write("fmt ", 12, "ascii");
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
    buffer.writeUInt16LE(1, 22);  // NumChannels (1 mono)
    buffer.writeUInt32LE(24000, 24); // SampleRate (24000)
    buffer.writeUInt32LE(48000, 28); // ByteRate (24000 * 1 * 2)
    buffer.writeUInt16LE(2, 32);  // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample
    // data subchunk
    buffer.write("data", 36, "ascii");
    buffer.writeUInt32LE(pcmDataLength, 40);
    // Fill dummy audio bytes
    buffer.fill(0x55, 44);
    return buffer;
};

test("Lok-Setu Sarvam Multilingual & Voice Synthesis Suite", async (t) => {
    // ─── 1. Language Mapping & Validation ───────────────────────────────────
    await t.test("1. BCP-47 language tag normalization for all 8 Indian languages", () => {
        const expected = {
            en: "en-IN",
            hi: "hi-IN",
            gu: "gu-IN",
            mr: "mr-IN",
            kn: "kn-IN",
            ta: "ta-IN",
            te: "te-IN",
            bn: "bn-IN",
        };

        for (const [code, bcp47] of Object.entries(expected)) {
            assert.equal(toSarvamBcp47(code), bcp47);
            assert.equal(toSarvamBcp47(code.toUpperCase()), bcp47);
            assert.equal(toSarvamBcp47(bcp47), bcp47);
            assert.equal(toTwoLetterLang(bcp47), code);
        }
    });

    await t.test("2. Unsupported language code triggers 400 ApiError", () => {
        assert.throws(
            () => toSarvamBcp47("fr"),
            (err) => err.statusCode === 400 && err.message.includes("not supported by Sarvam")
        );
        assert.throws(
            () => toSarvamBcp47("de"),
            (err) => err.statusCode === 400
        );
        assert.throws(
            () => toSarvamBcp47(""),
            (err) => err.statusCode === 400
        );
    });

    // ─── 2. Safe Sentence & Text Chunking ────────────────────────────────────
    await t.test("3. Text chunking respects character limits and Indic punctuation boundaries", () => {
        // Short text under limit
        const shortText = "यह एक सरकारी योजना है।";
        const shortChunks = chunkTextForSarvam(shortText, 2000);
        assert.equal(shortChunks.length, 1);
        assert.equal(shortChunks[0], shortText);

        // Long text with Hindi Danda ('।')
        const sentence = "यह नागरिक अधिकार सूचना है। ";
        const repeatedText = sentence.repeat(150); // ~4200 characters
        const chunks = chunkTextForSarvam(repeatedText, 1500);

        assert.ok(chunks.length >= 3);
        for (const chunk of chunks) {
            assert.ok(chunk.length <= 1500);
        }

        // Long unbroken string without punctuation splits gracefully
        const longWordRun = "word ".repeat(500);
        const longChunks = chunkTextForSarvam(longWordRun, 500);
        assert.ok(longChunks.length >= 4);
    });

    // ─── 3. WAV Header & Duration Handling ──────────────────────────────────
    await t.test("4. Concatenating WAV buffers updates header sizes and calculates duration", () => {
        const pcm1 = 48000; // 1 second at 24kHz 16-bit mono
        const pcm2 = 48000; // 1 second
        const wav1 = createDummyWavBuffer(pcm1);
        const wav2 = createDummyWavBuffer(pcm2);

        const merged = concatWavBuffers([wav1, wav2]);
        assert.equal(merged.toString("ascii", 0, 4), "RIFF");
        assert.equal(merged.toString("ascii", 8, 12), "WAVE");

        const totalPcm = pcm1 + pcm2;
        assert.equal(merged.readUInt32LE(4), 36 + totalPcm);
        assert.equal(merged.readUInt32LE(40), totalPcm);

        const duration = calculateWavDuration(merged, 24000);
                assert.equal(duration, 2);
        
                // Verify WAV buffer with extra metadata chunk (e.g. LIST chunk before data)
                const listHeader = Buffer.from("LIST\x04\x00\x00\x00INFO", "binary");
                const customWav = Buffer.concat([wav1.subarray(0, 36), listHeader, wav1.subarray(36)]);
                customWav.writeUInt32LE(customWav.length - 8, 4);
                const mergedWithMeta = concatWavBuffers([customWav, wav2]);
                assert.equal(mergedWithMeta.toString("ascii", 0, 4), "RIFF");
                assert.equal(calculateWavDuration(mergedWithMeta, 24000), 2);
    });

    // ─── 4. Sarvam Translation Pipeline ─────────────────────────────────────
    await t.test("5. Sarvam translateText bypasses API when source matches target", async () => {
        const service = new SarvamService({ apiKey: "mock-key" });
        const result = await service.translateText("Hello World", "en", "en");
        assert.equal(result.translatedText, "Hello World");
        assert.equal(result.targetLanguage, "en-IN");
    });

    await t.test("6. Sarvam translateText calls endpoint with proper payload & headers", async () => {
        let calledUrl = "";
        let calledHeaders = {};
        let calledBody = null;

        const mockFetch = async (url, options) => {
            calledUrl = url;
            calledHeaders = options.headers;
            calledBody = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({
                    request_id: "req-123",
                    translated_text: "यह एक सरकारी योजना है",
                    source_language_code: "en-IN",
                }),
            };
        };

        const service = new SarvamService({
            apiKey: "test-sarvam-key-123",
            fetchFn: mockFetch,
        });

        const result = await service.translateText("This is a government scheme.", "hi", "en");

        assert.equal(calledUrl, "https://api.sarvam.ai/translate");
        assert.equal(calledHeaders["api-subscription-key"], "test-sarvam-key-123");
        assert.equal(calledBody.input, "This is a government scheme.");
        assert.equal(calledBody.target_language_code, "hi-IN");
        assert.equal(calledBody.source_language_code, "en-IN");
        assert.equal(result.translatedText, "यह एक सरकारी योजना है");
    });

    await t.test("7. Sarvam translateText throws 503 if API key is not configured", async () => {
        const service = new SarvamService({ apiKey: "" });
        await assert.rejects(
            async () => await service.translateText("Test text", "hi"),
            (err) => err.statusCode === 503 && err.message.includes("SARVAM_API_KEY")
        );
    });

    // ─── 5. Sarvam TTS Pipeline ─────────────────────────────────────────────
    await t.test("8. Sarvam synthesizeSpeech decodes base64 WAV audio", async () => {
        const dummyPcm = 48000;
        const dummyWav = createDummyWavBuffer(dummyPcm);
        const base64Wav = dummyWav.toString("base64");

        let calledBody = null;
        const mockFetch = async (url, options) => {
            calledBody = JSON.parse(options.body);
            return {
                ok: true,
                json: async () => ({
                    request_id: "tts-999",
                    audios: [base64Wav],
                }),
            };
        };

        const service = new SarvamService({
            apiKey: "test-sarvam-key-123",
            fetchFn: mockFetch,
        });

        const result = await service.synthesizeSpeech("किसान योजना विवरण", "hi", { speaker: "shubh" });

        assert.equal(calledBody.text, "किसान योजना विवरण");
        assert.equal(calledBody.target_language_code, "hi-IN");
        assert.equal(calledBody.speaker, "shubh");
        assert.equal(calledBody.output_audio_codec, "wav");
        assert.ok(Buffer.isBuffer(result.audioBuffer));
        assert.equal(result.audioBuffer.length, dummyWav.length);
        assert.equal(result.durationSeconds, 1);
        assert.equal(result.mimeType, "audio/wav");
    });

    await t.test("9. Sarvam synthesizeSpeech throws 400 on empty text and 503 if unconfigured", async () => {
        const serviceWithKey = new SarvamService({ apiKey: "some-key" });
        await assert.rejects(
            async () => await serviceWithKey.synthesizeSpeech("", "hi"),
            (err) => err.statusCode === 400
        );

        const serviceNoKey = new SarvamService({ apiKey: "" });
        await assert.rejects(
            async () => await serviceNoKey.synthesizeSpeech("Hello", "hi"),
            (err) => err.statusCode === 503
        );
    });

    // ─── 6. Public Scheme Explainer Audio Controller ────────────────────────
    await t.test("10. Scheme audio controller validates IDs and serves cached audio", async () => {
        // Invalid ObjectId format
        const reqBadId = { params: { id: "invalid-id" }, query: { language: "hi" } };
        const res = {
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(body) {
                this.body = body;
                return this;
            },
        };

        await assert.rejects(
            async () => await getOrGenerateSchemeAudio(reqBadId, res),
            (err) => err.statusCode === 400 && err.message.includes("Invalid scheme document ID")
        );

        // Document not found
        const nonExistentId = new mongoose.Types.ObjectId().toString();
        const origDocFind = Document.findById;
        Document.findById = async () => null;

        try {
            await assert.rejects(
                async () => await getOrGenerateSchemeAudio({ params: { id: nonExistentId } }, res),
                (err) => err.statusCode === 404
            );
        } finally {
            Document.findById = origDocFind;
        }

        // Cached explainer test
        const validId = new mongoose.Types.ObjectId().toString();
        const mockDoc = { _id: validId, title: "PM Kisan Samman Nidhi", description: "Farmer income support" };
        const mockCachedExplainer = {
            documentId: validId,
            languageCode: "hi",
            languageName: "Hindi",
            plainSummary: "किसानों के लिए ₹6,000 वार्षिक सहायता।",
            audio: {
                audioUrl: "https://bucket.s3.ap-south-1.amazonaws.com/audio/explainers/kisan-hi.wav",
                durationSeconds: 45,
                mimeType: "audio/wav",
                voiceName: "shubh",
            },
        };

        const origDoc = Document.findById;
        const origExplainer = Explainer.findOne;
        Document.findById = async () => mockDoc;
        Explainer.findOne = async () => mockCachedExplainer;

        try {
            let statusCalled = null;
            let jsonPayload = null;
            const resMock = {
                status(code) {
                    statusCalled = code;
                    return this;
                },
                json(payload) {
                    jsonPayload = payload;
                    return this;
                },
            };

            await getOrGenerateSchemeAudio({ params: { id: validId }, query: { language: "hi" } }, resMock);

            assert.equal(statusCalled, 200);
            assert.equal(jsonPayload.data.isCached, true);
            assert.equal(jsonPayload.data.audioUrl, `/api/v1/explore/${validId}/audio/stream?language=hi`);
            assert.equal(jsonPayload.data.durationSeconds, 45);
        } finally {
            Document.findById = origDoc;
            Explainer.findOne = origExplainer;
        }
    });

    // ─── 7. Private Notice Audio Controller Ownership & Streaming ────────────
    await t.test("11. Private notice audio strictly enforces citizen ownership", async () => {
        const noticeId = new mongoose.Types.ObjectId().toString();
        const ownerId = new mongoose.Types.ObjectId();
        const strangerId = new mongoose.Types.ObjectId();

        const origFindOne = UserAnalyzedDocument.findOne;
        // Mock DB: returns doc only when queried with ownerId
        UserAnalyzedDocument.findOne = async (query) => {
            if (query._id === noticeId && query.user.toString() === ownerId.toString()) {
                return {
                    _id: noticeId,
                    user: ownerId,
                    fileName: "notice.pdf",
                    status: "analyzed",
                    primaryExplanation: {
                        language: "hi",
                        summary: "नगर पालिका संपत्ति कर नोटिस।",
                    },
                    audioUrl: "data:audio/wav;base64,UklGRg==",
                    audioLanguage: "hi",
                    audioDurationSeconds: 15,
                };
            }
            return null;
        };

        try {
            // Unauthorized citizen (stranger) attempts access
            const reqStranger = {
                params: { id: noticeId },
                user: { _id: strangerId },
            };
            const resMock = { status: () => resMock, json: () => {} };

            await assert.rejects(
                async () => await getOrGenerateNoticeAudio(reqStranger, resMock),
                (err) => err.statusCode === 404 && err.message.includes("access denied")
            );

            await assert.rejects(
                async () => await streamNoticeAudio(reqStranger, resMock),
                (err) => err.statusCode === 404 && err.message.includes("access denied")
            );

            // Authorized owner retrieves cached audio
            let statusResult = null;
            let bodyResult = null;
            const resOwner = {
                status(code) {
                    statusResult = code;
                    return this;
                },
                json(payload) {
                    bodyResult = payload;
                    return this;
                },
            };

            const reqOwner = {
                params: { id: noticeId },
                user: { _id: ownerId },
                body: { language: "hi" },
            };

            await getOrGenerateNoticeAudio(reqOwner, resOwner);

            assert.equal(statusResult, 200);
            assert.equal(bodyResult.data.isCached, true);
            assert.equal(bodyResult.data.audioUrl, "data:audio/wav;base64,UklGRg==");
            assert.equal(bodyResult.data.durationSeconds, 15);
        } finally {
            UserAnalyzedDocument.findOne = origFindOne;
        }
    });
});
