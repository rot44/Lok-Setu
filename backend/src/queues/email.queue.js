import Redis from "ioredis";
import { Queue } from "bullmq";
import { config } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

let isConnected = false;

// Single shared Redis connection for BullMQ
// maxRetriesPerRequest: null is MANDATORY for BullMQ
const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
        // Exponential backoff up to 10 seconds, but don't crash
        return Math.min(times * 500, 10000);
    },
};

if (config.redis.password) {
    redisOptions.password = config.redis.password;
}

export const redisConnection = config.redis.url
    ? new Redis(config.redis.url, redisOptions)
    : new Redis({
          host: config.redis.host,
          port: config.redis.port,
          ...redisOptions,
      });

redisConnection.on("connect", () => {
    isConnected = true;
    console.log("✅ [Redis] Connection established");
});

redisConnection.on("ready", () => {
    isConnected = true;
});

redisConnection.on("error", (err) => {
    isConnected = false;
    // Informative log without crashing node process
    console.error(`❌ [Redis] Connection warning: ${err.message}`);
});

redisConnection.on("close", () => {
    isConnected = false;
});

// Primary email queue
export const emailQueue = new Queue("emailQueue", {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 5000,
        },
        removeOnComplete: 100, // keep last 100 completed
        removeOnFail: 200,     // keep last 200 failed for inspection
    },
});

/**
 * Checks whether Redis is currently reachable.
 */
export const isRedisConnected = () => isConnected && redisConnection.status === "ready";

/**
 * Safe helper to enqueue email jobs with diagnostic check.
 * Ensures local development reports offline queue instead of pretending it worked.
 */
export const addEmailJob = async (type, data) => {
    if (redisConnection.status !== "ready" && redisConnection.status !== "connecting") {
        throw new ApiError(
            503,
            "Redis service is offline. Background email delivery is currently unavailable."
        );
    }

    try {
        const job = await emailQueue.add(type, { ...data, type });
        return job;
    } catch (err) {
        throw new ApiError(503, `Failed to enqueue email job: ${err.message}`);
    }
};

/**
 * Gracefully shuts down the queue and its underlying Redis connection.
 */
export const closeEmailQueue = async () => {
    try {
        await emailQueue.close();
        if (redisConnection.status !== "end") {
            await redisConnection.quit();
        }
        console.log("🛑 [BullMQ] Email queue and Redis connection closed cleanly.");
    } catch (error) {
        console.error("⚠️ Error while closing email queue:", error.message);
    }
};
