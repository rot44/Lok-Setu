import { Router } from "express";
import {
    getProfile,
    updateProfile,
    getDashboardSummary,
} from "../controllers/userProfile.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// All profile & dashboard routes require authenticated citizen
router.use(verifyJWT);

router.route("/").get(getProfile).put(updateProfile);
router.route("/dashboard").get(getDashboardSummary);

export default router;

