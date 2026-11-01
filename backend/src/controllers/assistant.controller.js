import crypto from "node:crypto";
import mongoose from "mongoose";
import { AiChatSession } from "../models/aiChatSession.model.js";
import { UserAnalyzedDocument } from "../models/userAnalyzedDocument.model.js";
import {
    analyzeCivicQuery,
    validateQuery,
    validateLanguage,
} from "../services/civicAnalysis.service.js";
import { sarvamService, toTwoLetterLang } from "../services/sarvam.service.js";
import { getGeminiClient } from "../services/gemini.service.js";
import { uploadFileToS3, downloadFileBufferFromS3, isStorageConfigured } from "../utils/s3Uploader.js";
import { CHAT_SESSION_MODES } from "../constants.js";
import { ApiError } from "../utils/apiError.js";
import { APIResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * In-memory LRU-like audio cache for assistant speech synthesis
 */
const assistantAudioCache = new Map();

/**
 * Clean markdown symbols, headers, URLs, and citations for natural speech synthesis
 */
export const cleanTextForSpeech = (text = "") => {
    return text
        .replace(/\[CITE-[^\]]+\]/g, "")
        .replace(/\[.*?\]\(.*?\)/g, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/#{1,6}\s+/g, "")
        .replace(/^[-*•]\s+/gm, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/\s+/g, " ")
        .trim();
};

/**
 * Computes deterministic SHA-256 hash of a guest access token.
 */
const hashGuestToken = (token) => {
    if (!token || typeof token !== "string") return null;
    return crypto.createHash("sha256").update(token.trim()).digest("hex");
};

/**
 * @desc    Submit a question to the conversational civic assistant
 * @route   POST /api/v1/assistant/chat
 * @access  Public (Guest) or Private (Authenticated Citizen)
 */
export const handleAssistantChat = asyncHandler(async (req, res) => {
    const {
        query,
        language = "en",
        sessionId,
        guestToken: bodyGuestToken,
        filters = {},
        documentId,
        documentText,
    } = req.body;

    // 1. Strict input validation
    const validQuery = validateQuery(query);
    const validLanguage = validateLanguage(language);

    let session = null;
    let newGuestToken = null;
    let guestTokenHash = null;
    let sessionUserId = null;
    let newSessionId = null;

    // 2. Session Resolution & Authorization
    if (sessionId) {
        if (typeof sessionId !== "string" || !sessionId.trim()) {
            throw new ApiError(400, "Provided sessionId must be a valid non-empty string.");
        }

        session = await AiChatSession.findOne({ sessionId: sessionId.trim() }).select("+guestTokenHash");
        if (!session) {
            throw new ApiError(404, `Chat session with ID '${sessionId}' not found.`);
        }

        // Enforce strict ownership / authorization
        if (session.user) {
            if (!req.user) {
                throw new ApiError(401, "Authentication required to access this chat session.");
            }
            if (session.user.toString() !== req.user._id.toString()) {
                throw new ApiError(403, "Access denied. You do not own this chat session.");
            }
        } else {
            // Guest session: client MUST provide matching guest token
            const clientGuestToken = req.headers["x-guest-token"] || bodyGuestToken;
            if (!clientGuestToken) {
                throw new ApiError(403, "Access denied. Guest session token is required to continue this session.");
            }
            const providedHash = hashGuestToken(clientGuestToken);
            if (providedHash !== session.guestTokenHash) {
                throw new ApiError(403, "Access denied. Invalid guest session token.");
            }
        }
    } else {
        // Create new session
        newSessionId = crypto.randomUUID();
        if (req.user) {
            sessionUserId = req.user._id;
        } else {
            const rawToken = crypto.randomBytes(32).toString("hex");
            guestTokenHash = hashGuestToken(rawToken);
            newGuestToken = rawToken;
        }
    }

    // 3. Extract bounded conversation history (max 4 recent messages for context)
    const conversationHistory = session
        ? session.messages.slice(-4).map((m) => ({
              sender: m.sender,
              text: m.text,
          }))
        : [];

    // 4. Resolve attached notice or uploaded document context if present
    let preSuppliedEvidence = null;
    let resolvedDocId = documentId || (session?.injectedUserProfileContext?.documentId);

    if (resolvedDocId && mongoose.Types.ObjectId.isValid(resolvedDocId)) {
        try {
            const userDoc = await UserAnalyzedDocument.findById(resolvedDocId);
            if (userDoc) {
                const rawContent = userDoc.rawExtractedText || userDoc.primaryExplanation?.summary || "";
                if (rawContent) {
                    preSuppliedEvidence = [
                        {
                            chunkId: `notice_${userDoc._id}`,
                            documentId: String(userDoc._id),
                            title: userDoc.fileName || "Uploaded Citizen Notice",
                            issuingAuthority: "Official Notice Authority",
                            jurisdictionLevel: "State / Local Notice",
                            sectionHeading: "Full Uploaded Document Text",
                            sourceText: rawContent,
                            sourceUrl: userDoc.fileUrl || null,
                            officialPortalUrl: userDoc.fileUrl || null,
                        },
                    ];
                }
            }
        } catch {
            // Ignore doc fetch error
        }
    } else if (documentText && typeof documentText === "string" && documentText.trim()) {
        preSuppliedEvidence = [
            {
                chunkId: "doc_provided_text",
                title: "Uploaded Citizen Notice",
                issuingAuthority: "Official Notice Authority",
                jurisdictionLevel: "State / Local Notice",
                sectionHeading: "Uploaded Notice Document",
                sourceText: documentText.trim(),
                sourceUrl: null,
            },
        ];
    } else if (req.user) {
        // Fallback: Check if user has an uploaded document matching the query
        try {
            const latestDoc = await UserAnalyzedDocument.findOne({ user: req.user._id }).sort({ createdAt: -1 });
            if (latestDoc && (validQuery.includes(latestDoc.fileName) || /notice|circular|challan|order|ekyc|ration|tax/i.test(validQuery))) {
                const rawContent = latestDoc.rawExtractedText || latestDoc.primaryExplanation?.summary || "";
                if (rawContent) {
                    preSuppliedEvidence = [
                        {
                            chunkId: `notice_${latestDoc._id}`,
                            documentId: String(latestDoc._id),
                            title: latestDoc.fileName || "Uploaded Citizen Notice",
                            issuingAuthority: "Official Notice Authority",
                            jurisdictionLevel: "State / Local Notice",
                            sectionHeading: "Full Uploaded Document Text",
                            sourceText: rawContent,
                            sourceUrl: latestDoc.fileUrl || null,
                            officialPortalUrl: latestDoc.fileUrl || null,
                        },
                    ];
                    resolvedDocId = latestDoc._id;
                }
            }
        } catch {
            // Ignore fallback error
        }
    }

    // Also check if the query itself contains extracted notice content
    if (!preSuppliedEvidence && (validQuery.includes("Uploaded Notice:") || validQuery.includes("Notice Summary:"))) {
        preSuppliedEvidence = [
            {
                chunkId: "query_notice_text",
                title: "Uploaded Notice Context",
                issuingAuthority: "Official Notice Authority",
                jurisdictionLevel: "Notice",
                sectionHeading: "Notice Summary & Facts",
                sourceText: validQuery,
                sourceUrl: null,
            },
        ];
    }

    // 5. Run grounded civic analysis with attached evidence
    const analysisFn = req.analysisService || analyzeCivicQuery;
    const analysis = await analysisFn(validQuery, {
        language: validLanguage,
        filters: typeof filters === "object" && filters !== null ? filters : {},
        conversationHistory,
        evidence: preSuppliedEvidence,
    });

    // 6. Construct user and assistant messages
    const userMessage = {
        sender: "user",
        text: validQuery,
        languageUsed: validLanguage,
        timestamp: new Date(),
    };

    const assistantMessage = {
        sender: "assistant",
        text: analysis.answer,
        languageUsed: validLanguage,
        timestamp: new Date(),
        analysis: {
            summary: analysis.summary,
            sourceFacts: analysis.sourceFacts,
            interpretation: analysis.interpretation,
            limitations: analysis.limitations,
            citations: analysis.citations,
            insufficientEvidence: analysis.insufficientEvidence,
        },
    };

    // 7. Atomic Persistence
    if (session) {
        if (resolvedDocId && (!session.injectedUserProfileContext || !session.injectedUserProfileContext.documentId)) {
            session.injectedUserProfileContext = {
                ...(session.injectedUserProfileContext || {}),
                documentId: resolvedDocId,
            };
        }
        session.messages.push(userMessage, assistantMessage);
        // Bounded session storage: keep maximum 30 messages
        if (session.messages.length > 30) {
            session.messages = [session.messages[0], ...session.messages.slice(-29)];
        }
        session.lastActiveAt = new Date();
        await session.save();
    } else {
        session = await AiChatSession.create({
            user: sessionUserId,
            sessionId: newSessionId,
            sessionMode: resolvedDocId ? CHAT_SESSION_MODES.ANALYZE_DOCUMENT : CHAT_SESSION_MODES.GENERAL_QUERY,
            injectedUserProfileContext: resolvedDocId ? { documentId: resolvedDocId } : null,
            guestTokenHash,
            lastActiveAt: new Date(),
            messages: [userMessage, assistantMessage],
        });
    }

    const savedAssistantMsg = session.messages[session.messages.length - 1];

    return res.status(200).json(
        new APIResponse(
            200,
            {
                sessionId: session.sessionId,
                guestToken: newGuestToken || undefined,
                message: {
                    id: savedAssistantMsg?._id ? String(savedAssistantMsg._id) : crypto.randomUUID(),
                    sender: "assistant",
                    text: analysis.answer,
                    languageUsed: validLanguage,
                    timestamp: assistantMessage.timestamp,
                    analysis: assistantMessage.analysis,
                },
                disclaimer: analysis.disclaimer,
            },
            "Assistant response generated successfully."
        )
    );
});

/**
 * @desc    Retrieve chat session history by sessionId
 * @route   GET /api/v1/assistant/session/:sessionId
 * @access  Public (Guest with token) or Private (Session Owner)
 */
export const getAssistantSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
        throw new ApiError(400, "Valid sessionId parameter is required.");
    }

    const session = await AiChatSession.findOne({ sessionId: sessionId.trim() }).select("+guestTokenHash");
    if (!session) {
        throw new ApiError(404, `Chat session with ID '${sessionId}' not found.`);
    }

    // Ownership & authorization check
    if (session.user) {
        if (!req.user) {
            throw new ApiError(401, "Authentication required to access this chat session.");
        }
        if (session.user.toString() !== req.user._id.toString()) {
            throw new ApiError(403, "Access denied. You do not own this chat session.");
        }
    } else {
        // Guest session verification
        const clientGuestToken =
            req.headers["x-guest-token"] ||
            req.query.guestToken;

        if (!clientGuestToken) {
            throw new ApiError(403, "Access denied. Guest session token is required to view this session.");
        }
        const providedHash = hashGuestToken(clientGuestToken);
        if (providedHash !== session.guestTokenHash) {
            throw new ApiError(403, "Access denied. Invalid guest session token.");
        }
    }

    return res.status(200).json(
        new APIResponse(
            200,
            {
                sessionId: session.sessionId,
                sessionMode: session.sessionMode,
                createdAt: session.createdAt,
                lastActiveAt: session.lastActiveAt,
                messages: session.messages.map((m) => ({
                    id: m._id ? String(m._id) : "",
                    sender: m.sender,
                    text: m.text,
                    languageUsed: m.languageUsed,
                    timestamp: m.timestamp,
                    analysis: m.analysis || null,
                })),
            },
            "Chat session retrieved successfully."
        )
    );
});

/**
 * @desc    Generate natural spoken audio explanation for an assistant answer (Sarvam Bulbul TTS)
 * @route   POST /api/v1/assistant/audio
 * @access  Public
 */
export const generateAssistantSpeech = asyncHandler(async (req, res) => {
    const { text, language = "hi", title } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
        throw new ApiError(400, "Text is required to generate speech.");
    }

    const languageCode = toTwoLetterLang(language);
    const cleanSpeechText = cleanTextForSpeech(text);

    // Compute deterministic hash of text + language
    const contentHash = crypto
        .createHash("sha256")
        .update(`${languageCode}::${cleanSpeechText}`)
        .digest("hex");

    const host = req.get("host") || "lok-setu-3yep.onrender.com";
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const streamUrl = `${protocol}://${host}/api/v1/assistant/audio/stream?hash=${contentHash}&lang=${languageCode}`;

    // 1. Check in-memory cache
    if (assistantAudioCache.has(contentHash)) {
        const cached = assistantAudioCache.get(contentHash);
        return res.status(200).json(
            new APIResponse(
                200,
                {
                    audioUrl: streamUrl,
                    durationSeconds: cached.durationSeconds || 0,
                    language: languageCode,
                    voiceName: cached.voiceName || "shubh",
                    isCached: true,
                },
                "Spoken explanation retrieved from cache."
            )
        );
    }

    // 2. Synthesize using Sarvam Bulbul TTS (with graceful fallback to browser speech if Sarvam unconfigured)
    let ttsResult = null;
    try {
        ttsResult = await sarvamService.synthesizeSpeech(cleanSpeechText, languageCode);
    } catch (sarvamErr) {
        console.warn("⚠️ Sarvam TTS synthesis notice, signaling client browser speech synthesis:", sarvamErr.message);
        return res.status(200).json(
            new APIResponse(
                200,
                {
                    audioUrl: null,
                    useBrowserSpeech: true,
                    text: cleanSpeechText,
                    language: languageCode,
                    durationSeconds: Math.ceil(cleanSpeechText.length / 15),
                    voiceName: "Browser Native Voice",
                },
                "Browser speech fallback enabled."
            )
        );
    }

    // 3. Cache in memory (evict oldest if cache exceeds 100 entries)
    if (assistantAudioCache.size >= 100) {
        const firstKey = assistantAudioCache.keys().next().value;
        assistantAudioCache.delete(firstKey);
    }
    assistantAudioCache.set(contentHash, {
        buffer: ttsResult.audioBuffer,
        durationSeconds: ttsResult.durationSeconds,
        voiceName: ttsResult.speaker,
    });

    // 4. Save to S3 in background if configured
    if (isStorageConfigured()) {
        const s3Key = `audio/assistant/${contentHash}.wav`;
        uploadFileToS3(ttsResult.audioBuffer, s3Key, "audio/wav").catch((err) =>
            console.error("⚠️ Background assistant audio S3 upload error:", err.message)
        );
    }

    return res.status(200).json(
        new APIResponse(
            200,
            {
                audioUrl: streamUrl,
                durationSeconds: ttsResult.durationSeconds,
                language: languageCode,
                voiceName: ttsResult.speaker,
                isCached: false,
            },
            "Spoken explanation generated successfully."
        )
    );
});

/**
 * @desc    Stream audio WAV for assistant explanation with HTTP Range support
 * @route   GET /api/v1/assistant/audio/stream
 * @access  Public
 */
export const streamAssistantAudio = asyncHandler(async (req, res) => {
    const { hash, lang = "hi" } = req.query;

    if (!hash || typeof hash !== "string") {
        throw new ApiError(400, "Valid audio content hash is required.");
    }

    let audioBuffer = null;

    // 1. Check in-memory cache
    if (assistantAudioCache.has(hash)) {
        audioBuffer = assistantAudioCache.get(hash).buffer;
    }

    // 2. Try download from S3 if configured
    if (!audioBuffer && isStorageConfigured()) {
        try {
            audioBuffer = await downloadFileBufferFromS3(`audio/assistant/${hash}.wav`);
            assistantAudioCache.set(hash, { buffer: audioBuffer, durationSeconds: 0 });
        } catch (_err) {
            // S3 object not found
        }
    }

    if (!audioBuffer || audioBuffer.length === 0) {
        throw new ApiError(404, "Audio stream not found. Please request speech synthesis first.");
    }

    const total = audioBuffer.length;
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=86400");

    const range = req.headers.range;
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : total - 1;

        if (start >= total || end >= total || start > end) {
            res.setHeader("Content-Range", `bytes */${total}`);
            return res.status(416).send("Requested range not satisfiable");
        }

        const chunk = audioBuffer.subarray(start, end + 1);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
        res.setHeader("Content-Length", chunk.length);
        return res.status(206).send(chunk);
    }

    res.setHeader("Content-Length", total);
    return res.status(200).send(audioBuffer);
});

/**
 * @desc    Transcribe speech audio into text using Sarvam AI Saaras v4
 * @route   POST /api/v1/assistant/transcribe
 * @access  Public
 */
export const transcribeAssistantAudio = asyncHandler(async (req, res) => {
    const file = req.file;
    const language = req.body?.language || req.query?.language || "hi";

    if (!file || !file.buffer || file.buffer.length === 0) {
        throw new ApiError(400, "Audio file is required for voice transcription.");
    }

    // 1. Try Sarvam AI Saaras v4 if configured
    try {
        const result = await sarvamService.transcribeSpeech(
            file.buffer,
            language,
            file.originalname || "voice.webm",
            file.mimetype || "audio/webm"
        );

        return res.status(200).json(
            new APIResponse(
                200,
                {
                    transcript: result.transcript,
                    languageCode: result.languageCode,
                    requestId: result.requestId,
                },
                "Voice transcribed successfully via Sarvam AI."
            )
        );
    } catch (sarvamErr) {
        console.warn("⚠️ Sarvam transcribe notice, falling back to Gemini Multimodal Audio:", sarvamErr.message);

        // 2. Intelligent Fallback: Gemini Multimodal Audio Transcription
        try {
            const client = getGeminiClient();
            const mimeType = file.mimetype || "audio/webm";
            const prompt = `You are an accurate voice transcription engine for Indian civic queries. Listen to this spoken audio recording (language context: ${language}) and transcribe exactly what the user said. Return ONLY the transcribed text, without any quotes or introductory or concluding remarks.`;

            const response = await client.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [
                    {
                        inlineData: {
                            mimeType,
                            data: file.buffer.toString("base64"),
                        },
                    },
                    prompt,
                ],
            });

            const transcript = response?.text?.trim() || "";
            return res.status(200).json(
                new APIResponse(
                    200,
                    {
                        transcript,
                        languageCode: language,
                        requestId: `gemini-audio-${Date.now()}`,
                    },
                    "Voice transcribed successfully via Gemini Multimodal Audio."
                )
            );
        } catch (geminiErr) {
            console.error("❌ Gemini audio transcription fallback error:", geminiErr.message);
            throw new ApiError(500, "Failed to transcribe audio. Please try typing your question.");
        }
    }
});
