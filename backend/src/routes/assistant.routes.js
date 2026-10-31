import { Router } from "express";
import {
    handleAssistantChat,
    getAssistantSession,
    generateAssistantSpeech,
    streamAssistantAudio,
    transcribeAssistantAudio,
} from "../controllers/assistant.controller.js";
import { optionalAuth } from "../middlewares/auth.middleware.js";
import { audioUpload } from "../middlewares/multer.middleware.js";

const router = Router();

// Apply optionalAuth so req.user is set for logged-in citizens and null for guests
router.use(optionalAuth);

// POST /api/v1/assistant/transcribe — Transcribe audio using Sarvam AI Saaras v4
router.post("/transcribe", audioUpload.single("audio"), transcribeAssistantAudio);

// GET /api/v1/assistant/audio/stream — Stream audio WAV binary for assistant message
router.get("/audio/stream", streamAssistantAudio);

// POST /api/v1/assistant/audio — Generate Sarvam Bulbul TTS audio for assistant explanation
router.post("/audio", generateAssistantSpeech);

// POST /api/v1/assistant/chat — Send query, get grounded response with citations
router.post("/chat", handleAssistantChat);

// GET /api/v1/assistant/session/:sessionId — Retrieve session history
router.get("/session/:sessionId", getAssistantSession);

export default router;
