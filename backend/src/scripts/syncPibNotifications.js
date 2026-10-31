import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { syncLatestPibReleases } from "../services/pibWatcher.service.js";

async function run() {
    console.log("🇮🇳 [PIB Sync] Starting Press Information Bureau Live Ingestion...");
    await connectDB();

    const start = Date.now();
    try {
        const result = await syncLatestPibReleases({ limit: 3 });
        console.log(`\n✅ [PIB Sync Complete in ${Date.now() - start}ms]`);
        console.log(`   - Inspected: ${result.totalInspected} releases`);
        console.log(`   - New Policy Documents Synced: ${result.syncedCount}`);
        console.log(`   - Skipped (Duplicates or Non-Civic): ${result.skippedCount}`);

        if (result.items?.length > 0) {
            console.log("\n📋 Newly Synced Policy Documents:");
            result.items.forEach((item, idx) => {
                console.log(`   ${idx + 1}. [${item.issuingAuthority}] ${item.title} (${item.applicableState})`);
            });
        }
    } catch (err) {
        console.error("❌ [PIB Sync Error]:", err.message);
    } finally {
        await mongoose.disconnect();
        console.log("🔒 Disconnected from database.");
        process.exit(0);
    }
}

run();

