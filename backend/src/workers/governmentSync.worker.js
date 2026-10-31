import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { governmentSyncService } from "../services/governmentSync.service.js";

const DEFAULT_SYNC_INTERVAL_HOURS = 6;
const intervalMs =
    (parseInt(process.env.GOV_SYNC_INTERVAL_HOURS, 10) || DEFAULT_SYNC_INTERVAL_HOURS) *
    60 *
    60 *
    1000;

let intervalId = null;
let isShuttingDown = false;
let isJobRunning = false;

/**
 * Runs one complete synchronization cycle.
 */
const runSyncCycle = async () => {
    if (isJobRunning) {
        console.log("⏳ [GovSync Worker] Previous sync cycle still running, skipping this trigger.");
        return;
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
        console.log(`   - Regional PIB Releases Synced: ${result.livePib.syncedCount} (Inspected: ${result.livePib.totalInspected})`);
        console.log(`   - Total New Documents Added: ${result.totalNewDocumentsSynced}`);
        console.log(`   - Total Indexed into Atlas Vector Search: ${result.totalIndexedChunks}`);

        if (result.livePib.errors?.length > 0) {
            console.warn(`   - Warnings/Errors:`, result.livePib.errors);
        }
    } catch (err) {
        console.error(`❌ [GovSync Worker] Error during sync cycle:`, err.message);
    } finally {
        isJobRunning = false;
        console.log(`⏰ [GovSync Worker] Next cycle scheduled in ${intervalMs / (1000 * 60 * 60)} hours.\n`);
    }
};

/**
 * Graceful termination handler.
 */
const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\n🛑 [GovSync Worker] Received ${signal}. Terminating worker gracefully...`);

    if (intervalId) {
        clearInterval(intervalId);
    }

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

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Connect DB and Start Worker
connectDB()
    .then(async () => {
        console.log(`🚀 [GovSync Worker] Connected to MongoDB Atlas.`);
        console.log(`🔄 Autonomous 24/7 Government Scheme Poller Active.`);

        // Run immediately on launch
        await runSyncCycle();

        // Schedule ongoing interval
        intervalId = setInterval(runSyncCycle, intervalMs);
    })
    .catch((err) => {
        console.error("❌ [GovSync Worker] MongoDB connection failed:", err.message);
        process.exit(1);
    });
