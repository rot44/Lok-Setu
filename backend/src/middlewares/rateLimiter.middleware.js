import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis from "ioredis";
import { config } from "../config/env.js";

const redisOptions = {
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy(times) {
        if (times > 2) return null;
        return 2000;
    },
};

const redisPassword = config?.redis?.password || process.env.REDIS_PASSWORD;
if (redisPassword) {
    redisOptions.password = redisPassword;
}

const redisUrl = config?.redis?.url || process.env.REDIS_URL;
const redisHost = config?.redis?.host || process.env.REDIS_HOST || "127.0.0.1";
const redisPort = config?.redis?.port || parseInt(process.env.REDIS_PORT, 10) || 6379;

export const redisRateLimitClient = redisUrl
    ? new Redis(redisUrl, redisOptions)
    : new Redis({
          host: redisHost,
          port: redisPort,
          ...redisOptions,
      });

// Alias for backwards compatibility
export const redisClient = redisRateLimitClient;

let hasLoggedRateLimitWarning = false;

redisRateLimitClient.on("connect", () => {
    hasLoggedRateLimitWarning = false;
    console.log("✅ [RateLimiter Redis] Connected");
});

redisRateLimitClient.on("error", (err) => {
    if (!hasLoggedRateLimitWarning) {
        console.warn("⚠️ Rate-limit Redis notice (falling back to memory store):", err.message);
        hasLoggedRateLimitWarning = true;
    }
});

/**
 * Resilient Redis command executor that handles temporary disconnects cleanly.
 */
const safeSendCommand = async (...args) => {
    try {
        if (redisRateLimitClient.status !== "ready") {
            return null;
        }
        return await redisRateLimitClient.call(...args);
    } catch (_err) {
        return null;
    }
};

/**
 * General API Rate Limiter
 * Applied globally across all API routes.
 * Max 100 requests per 15 minutes per IP.
 * Uses high-performance in-memory store in dev/test, and RedisStore in production.
 */
export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== "production",
    ...(process.env.NODE_ENV === "production" && {
        store: new RedisStore({ sendCommand: safeSendCommand }),
    }),
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
 * Max 10 attempts per 10 minutes in production; relaxed in dev/test to avoid blocking test runners.
 */
export const authRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: process.env.NODE_ENV === "production" ? 10 : 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== "production",
    ...(process.env.NODE_ENV === "production" && {
        store: new RedisStore({ sendCommand: safeSendCommand }),
    }),
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: "Too many authentication attempts. Please try again after 10 minutes.",
            data: null,
        });
    },
});

/**
 * Gracefully shuts down the rate limiter Redis client.
 */
export const closeRateLimitRedis = async () => {
    try {
        if (redisRateLimitClient && redisRateLimitClient.status !== "end") {
            await redisRateLimitClient.quit();
        }
        console.log("🛑 [RateLimiter] Redis connection closed cleanly.");
    } catch (_err) {
        // Safe ignore
    }
};
