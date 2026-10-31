import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { governmentSyncService } from "../services/governmentSync.service.js";

const run = async () => {
    console.log("🏛️ [CLI] Initializing Autonomous Government Scheme Sync...");
    await connectDB();

    try {
        const stats = await governmentSyncService.runFullAutonomousSync({
            includeLivePib: true,
            bureauCodes: [48, 3, 30, 14, 22],
            limitPerBureau: 2,
        });

        console.log("\n================ SYNC SUMMARY ================");
        console.log(`Timestamp: ${stats.timestamp}`);
        console.log(`National Catalog New: ${stats.catalog.syncedCount} (Already Existed: ${stats.catalog.skippedCount})`);
        console.log(`Live PIB New: ${stats.livePib.syncedCount} (Total Checked: ${stats.livePib.totalInspected})`);
        console.log(`Total New Policies Ingested: ${stats.totalNewDocumentsSynced}`);
        console.log(`Total Indexed into Atlas Vector Search: ${stats.totalIndexedChunks}`);
        console.log("==============================================\n");
    } catch (err) {
        console.error("❌ Sync failed:", err);
    } finally {
        await mongoose.connection.close();
        console.log("🏛️ [CLI] Database connection closed. Done.");
        process.exit(0);
    }
};

run();
