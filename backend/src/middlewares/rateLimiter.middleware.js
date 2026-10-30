import rateLimit from "express-rate-limit";

/**
 * General API Rate Limiter
 * Applied globally across all API routes.
 * Max 100 requests per 15 minutes per IP.
 * Uses high-performance in-memory store (zero external crash risk).
 */
export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute window
    max: 100, // max 100 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: "Too many requests from this IP. Please try again after 15 minutes.",
            data: null,
        });
    },
});

/**
 * Strict Auth Rate Limiter
 * Applied on authentication routes (register, login, OTP resend, forgot password).
 * Max 10 attempts per 10 minutes per IP to prevent brute-force attacks.
 */
export const authRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minute window
    max: process.env.NODE_ENV === "production" ? 10 : 100, // generous for local dev/testing, strict 10 in production
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: "Too many auth attempts. Please try again after 10 minutes.",
            data: null,
        });
    },
});
