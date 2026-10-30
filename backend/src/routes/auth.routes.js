import { Router } from "express";
import {
    registerUser,
    verifyEmailOtp,
    resendVerificationOtp,
    loginUser,
    logoutUser,
    refreshAccessToken,
    forgotPassword,
    resetPassword,
    getCurrentUser,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authRateLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

// ─── Public Auth Routes (Protected by Auth Rate Limiter) ──────────────────────
router.post("/register", authRateLimiter, registerUser);
router.post("/verify-otp", authRateLimiter, verifyEmailOtp);
router.post("/resend-otp", authRateLimiter, resendVerificationOtp);
router.post("/login", authRateLimiter, loginUser);
router.post("/forgot-password", authRateLimiter, forgotPassword);
router.post("/reset-password", authRateLimiter, resetPassword);

// ─── Token Rotation Route ───────────────────────────────────────────────────
router.post("/refresh-token", refreshAccessToken);

//protected routes
router.post("/logout", verifyJWT, logoutUser);
router.get("/me", verifyJWT, getCurrentUser);

export default router;

