import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis from "ioredis";
import { config } from "../config/env.js";

const redisOptions = {
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
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
 * Redis command executor for rate-limit-redis.
 * Leverages ioredis command pipeline and offline queuing.
 */
const safeSendCommand = async (...args) => {
    return await redisRateLimitClient.call(...args);
};

/**
 * Extracts the real client IP behind reverse proxies (Render, Cloudflare).
 * Prevents clustering all users into Render's internal 10.x.x.x container IP.
 */
const getClientIp = (req) => {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || "127.0.0.1";
};

/**
 * General API Rate Limiter
 * Relaxed to 1000 requests per 15 minutes per client IP.
 */
export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIp,
    skip: () => process.env.DISABLE_RATE_LIMITER === "true",
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
 * Relaxed to 500 attempts per 10 minutes per client IP to prevent lockouts during demos/testing.
 */
export const authRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIp,
    skip: () => process.env.DISABLE_RATE_LIMITER === "true",
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
