import crypto from "node:crypto";
import { AiChatSession } from "../models/aiChatSession.model.js";
import {
    analyzeCivicQuery,
    validateQuery,
    validateLanguage,
} from "../services/civicAnalysis.service.js";
import { CHAT_SESSION_MODES } from "../constants.js";
import { ApiError } from "../utils/apiError.js";
import { APIResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
    const { query, language = "en", sessionId, guestToken: bodyGuestToken, filters = {} } = req.body;

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

    // 4. Run grounded civic analysis (fails cleanly before mutating database if error occurs)
    const analysisFn = req.analysisService || analyzeCivicQuery;
    const analysis = await analysisFn(validQuery, {
        language: validLanguage,
        filters: typeof filters === "object" && filters !== null ? filters : {},
        conversationHistory,
    });

    // 5. Construct user and assistant messages
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

    // 6. Atomic Persistence
    if (session) {
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
            sessionMode: CHAT_SESSION_MODES.GENERAL_QUERY,
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
