import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis from "ioredis";
import { config } from "../config/env.js";

const redisOptions = {
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
        return Math.min(times * 500, 10000);
    },
};

if (config.redis.password) {
    redisOptions.password = config.redis.password;
}

// Dedicated Redis client for rate limiting
export const redisRateLimitClient = config.redis.url
    ? new Redis(config.redis.url, redisOptions)
    : new Redis({
          host: config.redis.host,
          port: config.redis.port,
          ...redisOptions,
      });

// Alias for backwards compatibility
export const redisClient = redisRateLimitClient;

redisRateLimitClient.on("connect", () => {
    console.log("✅ [RateLimiter Redis] Connected");
});

redisRateLimitClient.on("error", (err) => {
    console.warn("⚠️ Rate-limit Redis warning:", err.message);
});

/**
 * Resilient Redis command executor that handles temporary disconnects cleanly.
 */
const safeSendCommand = async (...args) => {
    try {
        if (redisRateLimitClient.status !== "ready") {
            // If Redis is temporarily offline during local dev, skip rate limit counter
            return null;
        }
        return await redisRateLimitClient.call(...args);
    } catch (err) {
        console.warn(`⚠️ [RateLimiter] Redis command error: ${err.message}`);
        return null;
    }
};

// General API rate limiter — applied globally on all routes (100 reqs / 15 mins)
export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: safeSendCommand,
    }),
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: "Too many requests from this IP. Please try again after 15 minutes.",
            data: null,
        });
    },
});

// Strict rate limiter for auth routes (10 attempts / 10 mins)
export const authRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
        sendCommand: safeSendCommand,
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
        if (redisRateLimitClient.status !== "end") {
            await redisRateLimitClient.quit();
        }
        console.log("🛑 [RateLimiter] Redis connection closed cleanly.");
    } catch (err) {
        console.error("⚠️ Error while closing rate limiter Redis:", err.message);
    }
};
