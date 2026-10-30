import { Router } from "express";
import {
    checkSingleSchemeEligibility,
    matchAllEligibleSchemes,
} from "../controllers/eligibility.controller.js";

const router = Router();

// Card 1: Check Eligibility endpoints
router.post("/check/:documentId", checkSingleSchemeEligibility);
router.post("/match-all", matchAllEligibleSchemes);

export default router;

