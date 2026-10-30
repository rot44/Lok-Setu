import Redis from "ioredis";
import { Queue } from "bullmq";
import { config } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

let isConnected = false;
let hasLoggedQueueWarning = false;

// maxRetriesPerRequest: null is MANDATORY for BullMQ
const redisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
        if (times > 3) {
            // Stop reconnect loop if Redis is permanently offline in dev
            return null;
        }
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

export const redisConnection = redisUrl
    ? new Redis(redisUrl, redisOptions)
    : new Redis({
          host: redisHost,
          port: redisPort,
          ...redisOptions,
      });

redisConnection.on("connect", () => {
    isConnected = true;
    hasLoggedQueueWarning = false;
    console.log("✅ [Redis] Connection established for BullMQ email queue");
});

redisConnection.on("ready", () => {
    isConnected = true;
});

redisConnection.on("error", (err) => {
    isConnected = false;
    if (!hasLoggedQueueWarning) {
        console.warn("⚠️ [Redis] Offline notice (BullMQ queue paused):", err.message);
        hasLoggedQueueWarning = true;
    }
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
