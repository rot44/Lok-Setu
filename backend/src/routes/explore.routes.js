import { Router } from "express";
import {
    getExploreSchemes,
    getSchemeById,
    getFiltersMetadata,
    getOrGenerateSchemeAudio,
} from "../controllers/explore.controller.js";

const router = Router();

// Sidebar filter counts (e.g. Central: 342, Education: 124)
router.get("/filters-meta", getFiltersMetadata);

// Main Explore search, multi-filters & pagination endpoint
// e.g. GET /api/v1/explore?search=kisan&gender=female&state=Gujarat&incomeRange=below_1_lakh&page=1
router.get("/", getExploreSchemes);

// Scheme audio explainer synthesis and retrieval (Sarvam Bulbul TTS)
router.post("/:id/audio", getOrGenerateSchemeAudio);
router.get("/:id/audio", getOrGenerateSchemeAudio);

// Single Scheme detail view (with S3 audio player link)
router.get("/:id", getSchemeById);

export default router;
