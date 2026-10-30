import Redis from "ioredis";
import { Queue } from "bullmq";

// Single shared Redis connection for BullMQ
// maxRetriesPerRequest: null is MANDATORY for BullMQ — without this BullMQ throws an error
const redisConnection = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new Redis({
          host: process.env.REDIS_HOST || "127.0.0.1",
          port: parseInt(process.env.REDIS_PORT) || 6379,
          maxRetriesPerRequest: null,
      });

redisConnection.on("connect", () => console.log("✅ Redis connected"));
redisConnection.on("error", (err) => console.error("❌ Redis error:", err.message));

// emailQueue: handles OTP emails and policy alert notifications
export const emailQueue = new Queue("emailQueue", { connection: redisConnection });

// Export shared connection so the worker can reuse the same instance
export { redisConnection };

