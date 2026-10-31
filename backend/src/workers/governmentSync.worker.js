import "dotenv/config";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import connectDB from "../db/index.js";
import { governmentSyncService } from "../services/governmentSync.service.js";

const DEFAULT_SYNC_INTERVAL_HOURS = 6;

let intervalId = null;
let isShuttingDown = false;
let isJobRunning = false;

/**
 * Runs one complete synchronization cycle.
 */
export const runGovSyncCycle = async () => {
    if (isJobRunning) {
        console.log("⏳ [GovSync Worker] Previous sync cycle still running, skipping this trigger.");
        return null;
    }

    isJobRunning = true;
    console.log(`\n======================================================`);
    console.log(`🏛️ [GovSync Worker] Starting Scheduled Ingestion Cycle: ${new Date().toISOString()}`);
    console.log(`======================================================`);

    try {
        const result = await governmentSyncService.runFullAutonomousSync({
            includeLivePib: true,
            bureauCodes: [48, 3, 30, 14, 22, 10, 26, 2, 15, 6], // Major Central & Regional Bureaus
            limitPerBureau: 2,
        });

        console.log(`✅ [GovSync Worker] Cycle Completed Successfully:`);
        console.log(`   - National Baseline Schemas Synced: ${result.catalog.syncedCount} (Skipped: ${result.catalog.skippedCount})`);
        console.log(`   - Registered Sources Synced: ${result.registeredSources?.syncedCount ?? result.livePib?.syncedCount ?? 0} (Inspected: ${result.registeredSources?.totalInspected ?? result.livePib?.totalInspected ?? 0})`);
        console.log(`   - Total New Documents Added: ${result.totalNewDocumentsSynced}`);
        console.log(`   - Total Documents Updated: ${result.totalDocumentsUpdated || 0}`);
        console.log(`   - Total Indexed into Atlas Vector Search: ${result.totalIndexedChunks}`);

        const syncErrors = result.registeredSources?.errors || result.livePib?.errors || [];
        if (syncErrors.length > 0) {
            console.warn(`   - Warnings/Errors:`, syncErrors);
        }
        return result;
    } catch (err) {
        console.error(`❌ [GovSync Worker] Error during sync cycle:`, err.message);
        return null;
    } finally {
        isJobRunning = false;
        console.log(`⏰ [GovSync Worker] Next cycle scheduled.`);
    }
};

/**
 * Starts the ongoing autonomous government synchronization scheduler.
 */
export const startGovSyncScheduler = async ({
    intervalHours = parseInt(process.env.GOV_SYNC_INTERVAL_HOURS, 10) || DEFAULT_SYNC_INTERVAL_HOURS,
    runImmediate = false,
} = {}) => {
    if (intervalId) {
        console.log("ℹ️ [GovSync Worker] Scheduler already active.");
        return;
    }

    const intervalMs = Math.max(1, intervalHours) * 60 * 60 * 1000;
    console.log(`🔄 Autonomous 24/7 Government Scheme Poller Active (Interval: ${intervalHours}h).`);

    if (runImmediate) {
        // Run first cycle asynchronously without blocking
        runGovSyncCycle().catch((err) => console.error("⚠️ Immediate GovSync cycle error:", err.message));
    }

    intervalId = setInterval(runGovSyncCycle, intervalMs);
    // Unref so worker doesn't prevent clean test exits if started in test mode
    if (intervalId && typeof intervalId.unref === "function") {
        intervalId.unref();
    }
};

/**
 * Stops the autonomous government synchronization scheduler.
 */
export const stopGovSyncScheduler = async () => {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log("🛑 [GovSync Worker] Scheduler stopped cleanly.");
    }
};

/**
 * Graceful termination handler for standalone worker execution.
 */
const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 [GovSync Worker] Received ${signal}. Terminating worker gracefully...`);

    await stopGovSyncScheduler();

    try {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log("🛑 [GovSync Worker] MongoDB disconnected.");
        }
        console.log("🏛️ [GovSync Worker] Exited cleanly.");
        process.exit(0);
    } catch (err) {
        console.error("❌ [GovSync Worker] Error during shutdown:", err.message);
        process.exit(1);
    }
};

// Check if run directly from node CLI
const isDirectExecution =
    process.argv[1] &&
    (fileURLToPath(import.meta.url) === process.argv[1] ||
        process.argv[1].endsWith("governmentSync.worker.js"));

if (isDirectExecution) {
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    connectDB()
        .then(async () => {
            console.log(`🚀 [GovSync Worker] Connected to MongoDB Atlas.`);
            await startGovSyncScheduler({ runImmediate: true });
        })
        .catch((err) => {
            console.error("❌ [GovSync Worker] MongoDB connection failed:", err.message);
            process.exit(1);
        });
}


