import { Router } from "express";
import {
    handleAssistantChat,
    getAssistantSession,
} from "../controllers/assistant.controller.js";
import { optionalAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply optionalAuth so req.user is set for logged-in citizens and null for guests
router.use(optionalAuth);

// POST /api/v1/assistant/chat — Send query, get grounded response with citations
router.post("/chat", handleAssistantChat);

// GET /api/v1/assistant/session/:sessionId — Retrieve session history
router.get("/session/:sessionId", getAssistantSession);

export default router;
