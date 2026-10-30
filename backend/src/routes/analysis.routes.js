import { Router } from "express";
import {
    initAnalyzeSession,
    uploadDocumentForAnalysis,
    executeDocumentAnalysis,
    getUserAnalysisHistory,
    getAnalyzedDocumentById,
    getOrGenerateNoticeAudio,
    streamNoticeAudio,
} from "../controllers/analysis.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// All analysis endpoints are private and require JWT authentication
router.use(verifyJWT);

// 1. Initialize session & formulate profile-based Pre-Prompt when user clicks "Analyze Document"
router.post("/init-session", initAnalyzeSession);

// 2. Upload file (PDF, DOCX, Image, Text) to Amazon S3 & save metadata
router.post("/upload", upload.single("document"), uploadDocumentForAnalysis);

// 3. Execute notice analysis and structured rights extraction
router.post("/:id/execute", executeDocumentAnalysis);

// 4. Voice Explainer Audio (Sarvam Bulbul TTS)
router.post("/:id/audio", getOrGenerateNoticeAudio);
router.get("/:id/audio", streamNoticeAudio);

// 5. User analysis history & single document details (for Dashboard / Revisit)
router.get("/history", getUserAnalysisHistory);
router.get("/:id", getAnalyzedDocumentById);

export default router;
