import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis from "ioredis";

// Dedicated Redis client for rate limiting (no maxRetriesPerRequest:null needed here)
const redisClient = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL)
    : new Redis({
          host: process.env.REDIS_HOST || "127.0.0.1",
          port: parseInt(process.env.REDIS_PORT) || 6379,
      });

redisClient.on("error", (err) => {
    // Graceful warning — prevents unhandled error event crash when Redis is offline
    console.warn("⚠️ Rate-limit Redis warning:", err.message);
});

// General API rate limiter — applied globally on all routes
export const apiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minute window
    max: 100, // max 100 requests per IP per window
    standardHeaders: true,
    legacyHeaders: false,
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
// Prevents brute-force and OTP spam
export const authRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minute window
    max: 10, // max 10 auth attempts per IP per window
    standardHeaders: true,
    legacyHeaders: false,
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
