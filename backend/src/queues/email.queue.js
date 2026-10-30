import Redis from "ioredis";
import { Queue } from "bullmq";

const redisOptions = {
    maxRetriesPerRequest: null, // Mandatory for BullMQ
    retryStrategy(times) {
        if (times > 2) {
            return null; // Stop reconnecting if Redis is offline
        }
        return 2000;
    },
};

// Single shared Redis connection for BullMQ
const redisConnection = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, redisOptions)
    : new Redis({
          host: process.env.REDIS_HOST || "127.0.0.1",
          port: parseInt(process.env.REDIS_PORT) || 6379,
          ...redisOptions,
      });

let hasLoggedQueueWarning = false;
redisConnection.on("connect", () => {
    console.log("✅ Redis connected for BullMQ email queue");
    hasLoggedQueueWarning = false;
});

redisConnection.on("error", (err) => {
    if (!hasLoggedQueueWarning) {
        console.warn("⚠️ Redis is currently offline (BullMQ queue paused). Run `brew services start redis` to enable.");
        hasLoggedQueueWarning = true;
    }
});

// emailQueue: handles OTP emails and policy alert notifications
export const emailQueue = new Queue("emailQueue", { connection: redisConnection });

export { redisConnection };
