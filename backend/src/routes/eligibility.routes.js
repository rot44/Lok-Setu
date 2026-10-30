import { Router } from "express";
import {
    checkSingleSchemeEligibility,
    matchAllEligibleSchemes,
} from "../controllers/eligibility.controller.js";
import { optionalAuth } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply optionalAuth so logged-in citizens have their profile context available
router.use(optionalAuth);

// Card 1: Check Eligibility endpoints
router.post("/check/:documentId", checkSingleSchemeEligibility);
router.post("/match-all", matchAllEligibleSchemes);

export default router;
