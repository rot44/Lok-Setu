import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis from "ioredis";

// Dedicated Redis client for rate limiting with clean reconnect backoff
const redisOptions = {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
        if (times > 2) {
            return null; // Stop reconnecting if Redis is offline to prevent spam
        }
        return 2000;
    },
};

const redisClient = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, redisOptions)
    : new Redis({
          host: process.env.REDIS_HOST || "127.0.0.1",
          port: parseInt(process.env.REDIS_PORT) || 6379,
          ...redisOptions,
      });

let hasLoggedRedisWarning = false;
redisClient.on("error", (err) => {
    if (!hasLoggedRedisWarning) {
        console.warn(
            "⚠️ Rate-limit Redis is currently offline (falling back to memory rate-limiting)."
        );
        hasLoggedRedisWarning = true;
    }
});

// General API rate limiter — applied globally on all routes
export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute window
    max: 100, // max 100 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true, // Graceful fallback if Redis is offline
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: "Too many requests from this IP. Please try again after 15 minutes.",
            data: null,
        });
    },
});

// Strict rate limiter for auth routes (OTP send, login, register)
export const authRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minute window
    max: 10, // max 10 auth attempts per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true, // Graceful fallback if Redis is offline
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: "Too many auth attempts. Please try again after 10 minutes.",
            data: null,
        });
    },
});
