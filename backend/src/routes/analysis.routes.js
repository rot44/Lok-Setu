import { Router } from "express";
import {
    initAnalyzeSession,
    uploadDocumentForAnalysis,
    getUserAnalysisHistory,
    getAnalyzedDocumentById,
} from "../controllers/analysis.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// All analysis endpoints are private and require JWT authentication
router.use(verifyJWT);

// 1. Initialize session & formulate profile-based Pre-Prompt when user clicks "Analyze Document"
router.post("/init-session", initAnalyzeSession);

// 2. Upload file (PDF, DOCX, Image) to Amazon S3 & save metadata
router.post("/upload", upload.single("document"), uploadDocumentForAnalysis);

// 3. User analysis history & single document details (for Dashboard / Revisit)
router.get("/history", getUserAnalysisHistory);
router.get("/:id", getAnalyzedDocumentById);

export default router;

