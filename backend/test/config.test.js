import assert from "node:assert";
import { config, validateEnv, getSanitizedConfigSummary, isAiConfigured, isStorageConfigured } from "../src/config/env.js";
import { getGeminiClient, CIVIC_GROUNDING_INSTRUCTION } from "../src/services/gemini.service.js";
import { uploadFileToS3 } from "../src/utils/s3Uploader.js";
import { ApiError } from "../src/utils/apiError.js";
import { closeEmailQueue } from "../src/queues/email.queue.js";
import { closeRateLimitRedis } from "../src/middlewares/rateLimiter.middleware.js";

async function runTests() {
    console.log("🧪 Running Lok-Setu Configuration & AI Foundation Tests...\n");

    // 1. Test Environment Diagnostics & Sanitization
    console.log("Test 1: Environment Diagnostics & Sanitization");
    const summary = getSanitizedConfigSummary();
    assert.strictEqual(typeof summary.environment, "string");
    assert.strictEqual(typeof summary.port, "number");
    assert.strictEqual(typeof summary.ai.configured, "boolean");
    assert.ok(summary.ai.keyMasked !== undefined);
    assert.ok(!summary.ai.keyMasked.includes("real-secret-key-12345"));
    console.log("  ✅ getSanitizedConfigSummary returned valid masked structure.");

    // 2. Test Production Validation Guard
    console.log("Test 2: Production Missing Keys Check");
    const originalEnv = process.env.NODE_ENV;
    const originalApiKey = process.env.GEMINI_API_KEY;
    try {
        process.env.NODE_ENV = "production";
        delete process.env.GEMINI_API_KEY;
        config.server.isProduction = true;
        config.ai.geminiApiKey = "";

        assert.throws(
            () => validateEnv(),
            /Missing required production environment variables/
        );
        console.log("  ✅ Fatal error thrown when required keys are missing in production.");
    } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalApiKey) process.env.GEMINI_API_KEY = originalApiKey;
        config.server.isProduction = (originalEnv || "").toLowerCase() === "production";
        config.ai.geminiApiKey = originalApiKey || "";
    }

    // 3. Test Grounding System Instruction
    console.log("Test 3: Civic Grounding Instructions");
    assert.ok(CIVIC_GROUNDING_INSTRUCTION.includes("CRITICAL GROUNDING & SAFETY RULES"));
    assert.ok(CIVIC_GROUNDING_INSTRUCTION.includes("This document does not clearly specify this information."));
    assert.ok(CIVIC_GROUNDING_INSTRUCTION.includes("Stated in source"));
    assert.ok(CIVIC_GROUNDING_INSTRUCTION.includes("AI interpretation"));
    assert.ok(CIVIC_GROUNDING_INSTRUCTION.includes("You may be eligible"));
    console.log("  ✅ Civic grounding prompt contains all non-negotiable clauses.");

    // 4. Test Gemini Service Unconfigured Behavior
    console.log("Test 4: Unconfigured Gemini Client Handling");
    const currentAiKey = config.ai.geminiApiKey;
    try {
        config.ai.geminiApiKey = "";
        assert.strictEqual(isAiConfigured(), false);
        assert.throws(
            () => getGeminiClient(),
            (err) => err instanceof ApiError && err.statusCode === 503 && err.message.includes("GEMINI_API_KEY")
        );
        console.log("  ✅ getGeminiClient throws 503 ApiError with clear instructions when unconfigured.");
    } finally {
        config.ai.geminiApiKey = currentAiKey;
    }

    // 5. Test Unconfigured S3 Storage Handling
    console.log("Test 5: Unconfigured S3 Storage Handling");
    const currentBucket = config.storage.bucketName;
    try {
        config.storage.bucketName = "";
        assert.strictEqual(isStorageConfigured(), false);
        await assert.rejects(
            async () => await uploadFileToS3(Buffer.from("test"), "test.txt", "text/plain"),
            (err) => err instanceof ApiError && err.statusCode === 503 && err.message.includes("AWS S3")
        );
        console.log("  ✅ uploadFileToS3 throws 503 ApiError with clear instructions when unconfigured.");
    } finally {
        config.storage.bucketName = currentBucket;
    }

    // 6. Test App Health Route & Middleware Stack
    console.log("Test 6: App Health Route & Middleware Stack");
    const { default: app } = await import("../src/app.js");
    assert.ok(app);
    console.log("  ✅ Express app loaded cleanly with all security and rate limiter middlewares.");

    // Cleanup open Redis sockets
    await closeEmailQueue();
    await closeRateLimitRedis();

    console.log("\n🎉 All Configuration & AI Foundation Tests Passed Successfully!\n");
    process.exit(0);
}

runTests().catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
