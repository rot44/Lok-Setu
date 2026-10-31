import assert from "node:assert";
import test from "node:test";
import crypto from "node:crypto";
import mongoose from "mongoose";
import {
    handleAssistantChat,
    getAssistantSession,
} from "../src/controllers/assistant.controller.js";
import { AiChatSession } from "../src/models/aiChatSession.model.js";
import { UserAnalyzedDocument } from "../src/models/userAnalyzedDocument.model.js";
import { ApiError } from "../src/utils/apiError.js";
import {
    buildCivicPrompt,
    formatConversationContext,
    EXACT_MISSING_INFO_SENTENCE,
    CIVIC_DISCLAIMER,
} from "../src/services/civicAnalysis.service.js";

// Helper to create mock response object
const createMockRes = () => {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
};

// Helper for next callback in asyncHandler tests
const next = (err) => {
    if (err) throw err;
};

// Standard mock civic analysis result
const createMockAnalysisResult = (overrides = {}) => ({
    answer: "Under PM SVANidhi, urban vendors are eligible for an initial collateral-free loan of up to Rs. 10,000 for 1 year.",
    language: "en",
    summary: "PM SVANidhi provides working capital loans of up to Rs 10,000 to street vendors.",
    sourceFacts: [
        "Collateral-free working capital loan up to Rs. 10,000.",
        "Repayment tenure of 1 year with 7% interest subsidy on timely repayment.",
    ],
    interpretation: "If you have a vendor ID card from your local municipal corporation, you can apply without collateral.",
    limitations: ["Requires Certificate of Vending issued by Urban Local Bodies."],
    citations: [
        {
            chunkId: "svanidhi_chunk_001",
            documentId: "65d8f1e293a8b417c8d9e111",
            title: "PM Street Vendor's AtmaNirbhar Nidhi Guidelines",
            issuingAuthority: "Ministry of Housing and Urban Affairs",
            sectionHeading: "Eligibility",
            clauseNumber: "Clause 4.1",
            startOffset: 120,
            endOffset: 650,
            sourceUrl: "https://pmsvanidhi.mohua.gov.in",
        },
    ],
    insufficientEvidence: false,
    disclaimer: CIVIC_DISCLAIMER,
    ...overrides,
});

test("Lok-Setu Conversational Civic Assistant Suite", async (t) => {
    // ─── 1. Input Validation Tests ────────────────────────────────────────────
    await t.test("handleAssistantChat validates query text and language strictly", async () => {
        const res = createMockRes();

        // Empty query
        await assert.rejects(
            async () => {
                await handleAssistantChat({ body: { query: "" } }, res, next);
            },
            (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes("cannot be empty")
        );

        // Whitespace-only query
        await assert.rejects(
            async () => {
                await handleAssistantChat({ body: { query: "    " } }, res, next);
            },
            (err) => err instanceof ApiError && err.statusCode === 400
        );

        // Unsupported language
        await assert.rejects(
            async () => {
                await handleAssistantChat({ body: { query: "What is PM SVANidhi?", language: "fr" } }, res, next);
            },
            (err) => err instanceof ApiError && err.statusCode === 400 && err.message.includes("Unsupported language")
        );

        // Query exceeding 2000 chars
        await assert.rejects(
            async () => {
                await handleAssistantChat({ body: { query: "q".repeat(2001) } }, res, next);
            },
            (err) => err instanceof ApiError && err.statusCode === 400
        );
    });

    // ─── 2. New Session Creation (Authenticated vs Guest) ─────────────────────
    await t.test("handleAssistantChat creates new authenticated session without exposing guestToken", async () => {
        const originalCreate = AiChatSession.create;
        let createdPayload = null;

        AiChatSession.create = async (payload) => {
            createdPayload = payload;
            return {
                ...payload,
                _id: new mongoose.Types.ObjectId(),
            };
        };

        try {
            const req = {
                user: { _id: new mongoose.Types.ObjectId("65d8f1e293a8b417c8d9e111") },
                body: {
                    query: "Tell me about PM SVANidhi loans",
                    language: "en",
                },
                headers: {},
                analysisService: async () => createMockAnalysisResult(),
            };
            const res = createMockRes();

            await handleAssistantChat(req, res, next);

            assert.equal(res.statusCode, 200);
            assert.ok(res.body.data.sessionId);
            assert.equal(res.body.data.guestToken, undefined, "Authenticated session must not return guestToken");
            assert.equal(createdPayload.user.toString(), req.user._id.toString());
            assert.equal(createdPayload.guestTokenHash, null);
            assert.equal(createdPayload.messages.length, 2);
            assert.equal(createdPayload.messages[0].sender, "user");
            assert.equal(createdPayload.messages[1].sender, "assistant");
            assert.equal(createdPayload.messages[1].analysis.citations.length, 1);
            assert.equal(createdPayload.messages[1].analysis.citations[0].chunkId, "svanidhi_chunk_001");
        } finally {
            AiChatSession.create = originalCreate;
        }
    });

    await t.test("handleAssistantChat creates new secure guest session with random UUID and 256-bit token", async () => {
        const originalCreate = AiChatSession.create;
        let createdPayload = null;

        AiChatSession.create = async (payload) => {
            createdPayload = payload;
            return {
                ...payload,
                _id: new mongoose.Types.ObjectId(),
            };
        };

        try {
            const req = {
                user: null, // Guest
                body: {
                    query: "Tell me about welfare schemes",
                    language: "en",
                },
                headers: {},
                analysisService: async () => createMockAnalysisResult(),
            };
            const res = createMockRes();

            await handleAssistantChat(req, res, next);

            assert.equal(res.statusCode, 200);
            assert.ok(res.body.data.sessionId);
            assert.ok(res.body.data.guestToken, "Guest session must return guestToken for secure continuity");
            assert.equal(res.body.data.guestToken.length, 64, "Guest token must be 256-bit (64 hex characters)");
            assert.equal(createdPayload.user, null);
            assert.ok(createdPayload.guestTokenHash, "SHA-256 hash must be stored in database");

            // Verify stored hash matches returned token
            const expectedHash = crypto.createHash("sha256").update(res.body.data.guestToken).digest("hex");
            assert.equal(createdPayload.guestTokenHash, expectedHash);
        } finally {
            AiChatSession.create = originalCreate;
        }
    });

    // ─── 3. Session Authorization & Ownership Guards ──────────────────────────
    await t.test("handleAssistantChat rejects access when user attempts to access another citizen's session", async () => {
        const sessionOwnerId = new mongoose.Types.ObjectId("65d8f1e293a8b417c8d9e111");
        const attackerUserId = new mongoose.Types.ObjectId("65d8f1e293a8b417c8d9e222");

        const mockSession = {
            sessionId: "target_user_session_123",
            user: sessionOwnerId,
            messages: [],
        };

        const originalFindOne = AiChatSession.findOne;
        AiChatSession.findOne = () => ({
            select: () => mockSession,
        });

        try {
            const req = {
                user: { _id: attackerUserId }, // Attacker
                body: {
                    sessionId: "target_user_session_123",
                    query: "Show confidential rights",
                    language: "en",
                },
                headers: {},
                analysisService: async () => createMockAnalysisResult(),
            };
            const res = createMockRes();

            await assert.rejects(
                async () => {
                    await handleAssistantChat(req, res, next);
                },
                (err) => err instanceof ApiError && err.statusCode === 403 && err.message.includes("You do not own this chat session")
            );
        } finally {
            AiChatSession.findOne = originalFindOne;
        }
    });

    await t.test("handleAssistantChat requires authentication when guest attempts to access authenticated session", async () => {
        const sessionOwnerId = new mongoose.Types.ObjectId("65d8f1e293a8b417c8d9e111");
        const mockSession = {
            sessionId: "auth_user_session_123",
            user: sessionOwnerId,
            messages: [],
        };

        const originalFindOne = AiChatSession.findOne;
        AiChatSession.findOne = () => ({
            select: () => mockSession,
        });

        try {
            const req = {
                user: null, // Unauthenticated guest
                body: {
                    sessionId: "auth_user_session_123",
                    query: "Can I see this chat?",
                    language: "en",
                },
                headers: {},
                analysisService: async () => createMockAnalysisResult(),
            };
            const res = createMockRes();

            await assert.rejects(
                async () => {
                    await handleAssistantChat(req, res, next);
                },
                (err) => err instanceof ApiError && err.statusCode === 401 && err.message.includes("Authentication required")
            );
        } finally {
            AiChatSession.findOne = originalFindOne;
        }
    });

    await t.test("handleAssistantChat rejects guest session access without valid guestToken", async () => {
        const rawToken = "super_secret_guest_token_1234567890abcdef";
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        const mockSession = {
            sessionId: "guest_session_123",
            user: null,
            guestTokenHash: tokenHash,
            messages: [],
        };

        const originalFindOne = AiChatSession.findOne;
        AiChatSession.findOne = () => ({
            select: () => mockSession,
        });

        try {
            // Missing token entirely
            await assert.rejects(
                async () => {
                    await handleAssistantChat(
                        {
                            user: null,
                            body: { sessionId: "guest_session_123", query: "Hello" },
                            headers: {},
                            analysisService: async () => createMockAnalysisResult(),
                        },
                        createMockRes(),
                        next
                    );
                },
                (err) => err instanceof ApiError && err.statusCode === 403 && err.message.includes("Guest session token is required")
            );

            // Invalid / wrong token
            await assert.rejects(
                async () => {
                    await handleAssistantChat(
                        {
                            user: null,
                            body: { sessionId: "guest_session_123", query: "Hello", guestToken: "wrong_token_guess" },
                            headers: {},
                            analysisService: async () => createMockAnalysisResult(),
                        },
                        createMockRes(),
                        next
                    );
                },
                (err) => err instanceof ApiError && err.statusCode === 403 && err.message.includes("Invalid guest session token")
            );
        } finally {
            AiChatSession.findOne = originalFindOne;
        }
    });

    await t.test("handleAssistantChat returns 404 for non-existent session ID", async () => {
        const originalFindOne = AiChatSession.findOne;
        AiChatSession.findOne = () => ({
            select: () => null,
        });

        try {
            await assert.rejects(
                async () => {
                    await handleAssistantChat(
                        {
                            user: { _id: new mongoose.Types.ObjectId() },
                            body: { sessionId: "missing_session_999", query: "Hello" },
                            headers: {},
                            analysisService: async () => createMockAnalysisResult(),
                        },
                        createMockRes(),
                        next
                    );
                },
                (err) => err instanceof ApiError && err.statusCode === 404 && err.message.includes("not found")
            );
        } finally {
            AiChatSession.findOne = originalFindOne;
        }
    });

    // ─── 4. Multi-Turn Session Continuity & Bounded History ───────────────────
    await t.test("handleAssistantChat appends turn to owned session and bounds stored history to 30 messages", async () => {
        const userId = new mongoose.Types.ObjectId("65d8f1e293a8b417c8d9e111");
        let saved = false;

        // Existing session with 30 existing messages
        const existingMessages = Array.from({ length: 30 }, (_, i) => ({
            sender: i % 2 === 0 ? "user" : "assistant",
            text: `Message ${i}`,
            timestamp: new Date(),
        }));

        const mockSession = {
            sessionId: "existing_session_123",
            user: userId,
            messages: [...existingMessages],
            async save() {
                saved = true;
            },
        };

        const originalFindOne = AiChatSession.findOne;
        AiChatSession.findOne = () => ({
            select: () => mockSession,
        });

        try {
            let passedContext = null;
            const mockAnalysis = async (q, opts) => {
                passedContext = opts.conversationHistory;
                return createMockAnalysisResult();
            };

            const req = {
                user: { _id: userId },
                body: {
                    sessionId: "existing_session_123",
                    query: "Follow up question",
                    language: "en",
                },
                headers: {},
                analysisService: mockAnalysis,
            };
            const res = createMockRes();

            await handleAssistantChat(req, res, next);

            assert.equal(res.statusCode, 200);
            assert.equal(saved, true);
            // Stored messages bounded to 30
            assert.equal(mockSession.messages.length, 30);
            // Verify conversation context passed to AI was bounded to max 4 messages
            assert.ok(passedContext.length <= 4);
            // The last message is the new assistant message
            assert.equal(mockSession.messages[29].sender, "assistant");
            assert.equal(mockSession.messages[28].sender, "user");
            assert.equal(mockSession.messages[28].text, "Follow up question");
        } finally {
            AiChatSession.findOne = originalFindOne;
        }
    });

    // ─── 5. Atomic Persistence on Analysis Failure ────────────────────────────
    await t.test("handleAssistantChat does not persist partial user/assistant messages if analysis fails", async () => {
        const userId = new mongoose.Types.ObjectId("65d8f1e293a8b417c8d9e111");
        let saveCalled = false;

        const mockSession = {
            sessionId: "safe_session_123",
            user: userId,
            messages: [
                { sender: "user", text: "Prior question" },
                { sender: "assistant", text: "Prior answer" },
            ],
            async save() {
                saveCalled = true;
            },
        };

        const originalFindOne = AiChatSession.findOne;
        AiChatSession.findOne = () => ({
            select: () => mockSession,
        });

        try {
            const failingAnalysis = async () => {
                throw new ApiError(504, "Gemini service timed out.");
            };

            const req = {
                user: { _id: userId },
                body: {
                    sessionId: "safe_session_123",
                    query: "Will this crash?",
                    language: "en",
                },
                headers: {},
                analysisService: failingAnalysis,
            };
            const res = createMockRes();

            await assert.rejects(
                async () => {
                    await handleAssistantChat(req, res, next);
                },
                (err) => err instanceof ApiError && err.statusCode === 504
            );

            // Session must NOT have been saved with partial fabricated responses
            assert.equal(saveCalled, false);
            assert.equal(mockSession.messages.length, 2, "Failed query must not corrupt persisted history");
        } finally {
            AiChatSession.findOne = originalFindOne;
        }
    });

    // ─── 6. Conversation Context Isolation & Grounding ────────────────────────
    await t.test("formatConversationContext isolates prior turns with clear non-evidence notice", () => {
        const history = [
            { sender: "user", text: "What is PM SVANidhi?" },
            { sender: "assistant", text: "It is a micro-credit scheme for street vendors." },
        ];

        const context = formatConversationContext(history);
        assert.ok(context.includes("<recent_conversation_context>"));
        assert.ok(context.includes("Note: The following recent exchange provides dialogue context for pronoun/topic resolution ONLY."));
        assert.ok(context.includes("It is NOT official evidence and must NEVER be treated as a source of legal truth."));
        assert.ok(context.includes("Citizen: What is PM SVANidhi?"));
        assert.ok(context.includes("Assistant: It is a micro-credit scheme for street vendors."));
    });

    await t.test("buildCivicPrompt places conversation context distinctly above untrusted evidence", () => {
        const prompt = buildCivicPrompt({
            query: "What is the loan amount?",
            language: "hi",
            evidenceList: [],
            conversationHistory: [{ sender: "user", text: "Tell me about PM SVANidhi" }],
        });

        assert.ok(prompt.includes("<recent_conversation_context>"));
        assert.ok(prompt.includes("CITIZEN QUERY:\n\"What is the loan amount?\""));
        assert.ok(prompt.includes("<retrieved_evidence>"));
    });

    // ─── 7. Insufficient Evidence Propagation ─────────────────────────────────
    await t.test("handleAssistantChat propagates insufficient evidence response with exact clause", async () => {
        const userId = new mongoose.Types.ObjectId();
        const mockSession = {
            sessionId: "insufficient_session_1",
            user: userId,
            messages: [],
            async save() {},
        };

        const originalFindOne = AiChatSession.findOne;
        AiChatSession.findOne = () => ({
            select: () => mockSession,
        });

        try {
            const insufficientAnalysis = async () =>
                createMockAnalysisResult({
                    answer: `The official guidelines do not mention this scheme. ${EXACT_MISSING_INFO_SENTENCE}`,
                    insufficientEvidence: true,
                    citations: [],
                });

            const req = {
                user: { _id: userId },
                body: {
                    sessionId: "insufficient_session_1",
                    query: "Can Martian residents get PM SVANidhi loan?",
                    language: "en",
                },
                headers: {},
                analysisService: insufficientAnalysis,
            };
            const res = createMockRes();

            await handleAssistantChat(req, res, next);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.data.message.analysis.insufficientEvidence, true);
            assert.ok(res.body.data.message.text.includes(EXACT_MISSING_INFO_SENTENCE));
            assert.deepEqual(res.body.data.message.analysis.citations, []);
        } finally {
            AiChatSession.findOne = originalFindOne;
        }
    });

    // ─── 8. getAssistantSession Endpoint Verification ─────────────────────────
    await t.test("getAssistantSession returns session history for authorized owner", async () => {
        const userId = new mongoose.Types.ObjectId("65d8f1e293a8b417c8d9e111");
        const mockSession = {
            sessionId: "my_session_1",
            user: userId,
            sessionMode: "general_query",
            createdAt: new Date(),
            lastActiveAt: new Date(),
            messages: [
                {
                    _id: new mongoose.Types.ObjectId(),
                    sender: "user",
                    text: "Question 1",
                    languageUsed: "en",
                    timestamp: new Date(),
                },
                {
                    _id: new mongoose.Types.ObjectId(),
                    sender: "assistant",
                    text: "Answer 1",
                    languageUsed: "en",
                    timestamp: new Date(),
                    analysis: { summary: "Summary 1", citations: [] },
                },
            ],
        };

        const originalFindOne = AiChatSession.findOne;
        AiChatSession.findOne = () => ({
            select: () => mockSession,
        });

        try {
            const req = {
                user: { _id: userId },
                params: { sessionId: "my_session_1" },
                headers: {},
            };
            const res = createMockRes();

            await getAssistantSession(req, res, next);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.data.sessionId, "my_session_1");
            assert.equal(res.body.data.messages.length, 2);
            assert.equal(res.body.data.messages[0].text, "Question 1");
            assert.equal(res.body.data.messages[1].text, "Answer 1");
        } finally {
            AiChatSession.findOne = originalFindOne;
        }
    });

    await t.test("getAssistantSession allows guest access with valid guestToken and rejects without it", async () => {
        const rawToken = "guest_secret_1234567890abcdef1234567890abcdef";
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        const mockSession = {
            sessionId: "guest_session_456",
            user: null,
            guestTokenHash: tokenHash,
            sessionMode: "general_query",
            createdAt: new Date(),
            lastActiveAt: new Date(),
            messages: [],
        };

        const originalFindOne = AiChatSession.findOne;
        AiChatSession.findOne = () => ({
            select: () => mockSession,
        });

        try {
            // Rejects without token
            await assert.rejects(
                async () => {
                    await getAssistantSession(
                        { user: null, params: { sessionId: "guest_session_456" }, headers: {}, query: {} },
                        createMockRes(),
                        next
                    );
                },
                (err) => err instanceof ApiError && err.statusCode === 403 && err.message.includes("Guest session token is required")
            );

            // Accepts with valid token header
            const req = {
                user: null,
                params: { sessionId: "guest_session_456" },
                headers: { "x-guest-token": rawToken },
                query: {},
            };
            const res = createMockRes();
            await getAssistantSession(req, res, next);
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.data.sessionId, "guest_session_456");
        } finally {
            AiChatSession.findOne = originalFindOne;
        }
    });

    await t.test("handleAssistantChat injects uploaded notice evidence when documentId or documentText is supplied", async () => {
        const dummyDocId = new mongoose.Types.ObjectId();
        let capturedEvidence = null;

        const originalDocFindById = UserAnalyzedDocument.findById;
        const originalCreate = AiChatSession.create;

        UserAnalyzedDocument.findById = async (id) => {
            if (String(id) === String(dummyDocId)) {
                return {
                    _id: dummyDocId,
                    fileName: "sample_ration_card_order.txt",
                    rawExtractedText: "Mandatory biometric e-KYC compliance directive for all NFSA ration cards.",
                    primaryExplanation: {
                        summary: "Complete biometric e-KYC by 30 November 2026.",
                    },
                    fileUrl: "https://s3.example.com/notices/sample.txt",
                };
            }
            return null;
        };

        AiChatSession.create = async (payload) => ({
            ...payload,
            _id: new mongoose.Types.ObjectId(),
        });

        try {
            const req = {
                user: { _id: new mongoose.Types.ObjectId() },
                body: {
                    query: "What is the deadline for this notice?",
                    documentId: String(dummyDocId),
                },
                headers: {},
                analysisService: async (query, opts) => {
                    capturedEvidence = opts.evidence;
                    return createMockAnalysisResult();
                },
            };

            const res = createMockRes();
            await handleAssistantChat(req, res, next);

            assert.equal(res.statusCode, 200);
            assert.ok(Array.isArray(capturedEvidence));
            assert.equal(capturedEvidence.length, 1);
            assert.equal(capturedEvidence[0].title, "sample_ration_card_order.txt");
            assert.ok(capturedEvidence[0].sourceText.includes("Mandatory biometric e-KYC"));
        } finally {
            UserAnalyzedDocument.findById = originalDocFindById;
            AiChatSession.create = originalCreate;
        }
    });
});
