import { Router } from "express";
import {
    ingestOfficialDocument,
    getDocumentStatus,
    triggerPibSync,
    triggerAutonomousGovSync,
} from "../controllers/document.controller.js";
import { verifyJWT, verifyRole } from "../middlewares/auth.middleware.js";
import { USER_ROLES } from "../constants.js";

const router = Router();

// Authentication required for all document endpoints
router.use(verifyJWT);

// Ingest official policy document: restricted to admin and official roles
router.post(
    "/ingest",
    verifyRole(USER_ROLES.ADMIN, USER_ROLES.OFFICIAL),
    ingestOfficialDocument
);

// Trigger live sync of PIB notifications: restricted to admin and official roles
router.post(
    "/sync-pib",
    verifyRole(USER_ROLES.ADMIN, USER_ROLES.OFFICIAL),
    triggerPibSync
);

// Trigger full autonomous multi-state & multi-category government scheme synchronization
router.post(
    "/auto-sync-all",
    verifyRole(USER_ROLES.ADMIN, USER_ROLES.OFFICIAL),
    triggerAutonomousGovSync
);

// Get ingestion & indexing status for a document
router.get("/:id/status", getDocumentStatus);

export default router;
