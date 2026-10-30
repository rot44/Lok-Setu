import "dotenv/config";

import mongoose from "mongoose";
import connectDB from "./db/index.js";
import app from "./app.js";
import { config, validateEnv, logStartupDiagnostics } from "./config/env.js";
import { closeEmailQueue } from "./queues/email.queue.js";
import { closeEmailWorker } from "./workers/email.worker.js";
import { closeRateLimitRedis } from "./middlewares/rateLimiter.middleware.js";

// Validate environment variables on startup
validateEnv();
logStartupDiagnostics();

let server = null;
let isShuttingDown = false;

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);

    // Force exit after 10s timeout if cleanup hangs
    const forceExitTimer = setTimeout(() => {
        console.error("⚠️ Forced shutdown due to timeout.");
        process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    try {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
            console.log("🛑 [HTTP] Server stopped accepting new connections.");
        }

        // Close background workers and queues
        await closeEmailWorker();
        await closeEmailQueue();
        await closeRateLimitRedis();

        // Disconnect database
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log("🛑 [Database] MongoDB disconnected.");
        }

        console.log("🏛️ Lok-Setu shutdown complete. Goodbye!\n");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error during shutdown:", err.message);
        process.exit(1);
    }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled Rejection at Promise:", reason);
});

process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    gracefulShutdown("uncaughtException");
});

// Start Database & Server
connectDB()
    .then(() => {
        const port = config.server.port;
        server = app.listen(port, () => {
            console.log(`🚀 Lok Setu server running at port ${port}`);
        });
    })
    .catch((err) => {
        console.error("❌ MongoDB connection failed:", err);
        process.exit(1);
    });
