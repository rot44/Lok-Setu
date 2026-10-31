import dotenv from "dotenv";

// Load .env file before reading variables
dotenv.config({ path: "./.env" });

/**
 * Helper to mask sensitive keys for safe diagnostic logging.
 * Returns "***" if string is short or masked value (e.g., "sk-ab...12").
 */
const maskSecret = (secret) => {
    if (!secret || typeof secret !== "string") return "[Not Configured]";
    if (secret.length <= 8) return "********";
    return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
};

/**
 * Validated, typed configuration object with defaults.
 */
export const config = {
    server: {
        port: parseInt(process.env.PORT, 10) || 8000,
        nodeEnv: process.env.NODE_ENV || "development",
        clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
        isProduction: (process.env.NODE_ENV || "").toLowerCase() === "production",
        isTest: (process.env.NODE_ENV || "").toLowerCase() === "test",
    },
    db: {
        uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
        name: process.env.DB_NAME || "lokSetu",
    },
    auth: {
        accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || "",
        accessTokenExpiry: process.env.ACCESS_TOKEN_EXPIRY || "1d",
        refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || "",
        refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || "7d",
    },
    redis: {
        url: process.env.REDIS_URL || "",
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        password: process.env.REDIS_PASSWORD || "",
    },
    email: {
        apiKey: process.env.RESEND_API_KEY || "",
        fromEmail: process.env.RESEND_FROM_EMAIL || "Lok Setu <onboarding@resend.dev>",
    },
    storage: {
        region: process.env.AWS_REGION || "ap-south-1",
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        bucketName: process.env.AWS_S3_BUCKET_NAME || "",
    },
    ai: {
        geminiApiKey: process.env.GEMINI_API_KEY || "",
        model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
        embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
        ttsModel: process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash",
        timeoutMs: parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 60000,
        maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES, 10) || 3,
    },
    sarvam: {
        apiKey: process.env.SARVAM_API_KEY || "",
        translationModel: process.env.SARVAM_TRANSLATION_MODEL || "sarvam-translate:v1",
        ttsModel: process.env.SARVAM_TTS_MODEL || "bulbul:v3",
        defaultSpeaker: process.env.SARVAM_DEFAULT_SPEAKER || "shubh",
        timeoutMs: parseInt(process.env.SARVAM_TIMEOUT_MS, 10) || 30000,
        maxRetries: parseInt(process.env.SARVAM_MAX_RETRIES, 10) || 3,
    },
};

/**
 * Service capability checks.
 */
export const isAiConfigured = () => Boolean(config.ai.geminiApiKey);
export const isSarvamConfigured = () => Boolean(config.sarvam.apiKey);
export const isStorageConfigured = () =>
    Boolean(config.storage.bucketName && config.storage.accessKeyId && config.storage.secretAccessKey);
export const isEmailConfigured = () => Boolean(config.email.apiKey);
export const isAuthConfigured = () =>
    Boolean(config.auth.accessTokenSecret && config.auth.refreshTokenSecret);

/**
 * Validates environment settings at application boot.
 * - In production: throws fatal errors if required variables are missing.
 * - In development: warns cleanly about missing optional dependencies.
 */
export const validateEnv = () => {
    const missingProductionKeys = [];

    if (!config.db.uri) missingProductionKeys.push("MONGODB_URI");
    if (!config.auth.accessTokenSecret) missingProductionKeys.push("ACCESS_TOKEN_SECRET");
    if (!config.auth.refreshTokenSecret) missingProductionKeys.push("REFRESH_TOKEN_SECRET");
    if (!config.ai.geminiApiKey) missingProductionKeys.push("GEMINI_API_KEY");

    if (config.server.isProduction && missingProductionKeys.length > 0) {
        throw new Error(
            `❌ Fatal Startup Error: Missing required production environment variables:\n` +
            `   - ${missingProductionKeys.join("\n   - ")}\n` +
            `Please check your server environment configuration.`
        );
    }

    return getSanitizedConfigSummary();
};

/**
 * Generates a sanitized summary of active services for startup diagnostics.
 * Never exposes plaintext secrets.
 */
export const getSanitizedConfigSummary = () => {
    return {
        environment: config.server.nodeEnv,
        port: config.server.port,
        clientUrl: config.server.clientUrl,
        database: {
            configured: Boolean(config.db.uri),
            dbName: config.db.name,
        },
        auth: {
            accessTokenConfigured: Boolean(config.auth.accessTokenSecret),
            refreshTokenConfigured: Boolean(config.auth.refreshTokenSecret),
            accessTokenExpiry: config.auth.accessTokenExpiry,
        },
        ai: {
            configured: isAiConfigured(),
            model: config.ai.model,
            embeddingModel: config.ai.embeddingModel,
            timeoutMs: config.ai.timeoutMs,
            keyMasked: maskSecret(config.ai.geminiApiKey),
        },
        sarvam: {
            configured: isSarvamConfigured(),
            translationModel: config.sarvam.translationModel,
            ttsModel: config.sarvam.ttsModel,
            defaultSpeaker: config.sarvam.defaultSpeaker,
            timeoutMs: config.sarvam.timeoutMs,
            keyMasked: maskSecret(config.sarvam.apiKey),
        },
        storage: {
            configured: isStorageConfigured(),
            region: config.storage.region,
            bucket: config.storage.bucketName || "[Not Configured]",
        },
        email: {
            configured: isEmailConfigured(),
            from: config.email.fromEmail,
        },
        redis: {
            urlProvided: Boolean(config.redis.url),
            host: config.redis.host,
            port: config.redis.port,
        },
    };
};

/**
 * Logs user-friendly diagnostic information at startup.
 */
export const logStartupDiagnostics = () => {
    const summary = getSanitizedConfigSummary();
    console.log("─────────────────────────────────────────────────────────────");
    console.log(`🏛️  Lok-Setu Startup Diagnostics [${summary.environment}]`);
    console.log("─────────────────────────────────────────────────────────────");
    console.log(`• Database (MongoDB) : ${summary.database.configured ? `✅ (${summary.database.dbName})` : "❌ Missing MONGODB_URI"}`);
    console.log(`• Authentication     : ${summary.auth.accessTokenConfigured && summary.auth.refreshTokenConfigured ? "✅ JWT Secrets Present" : "⚠️  JWT Secrets Missing (Auth will fail)"}`);
    console.log(`• Gemini AI Service  : ${summary.ai.configured ? `✅ Configured [${summary.ai.model}]` : "⚠️  Unconfigured (Set GEMINI_API_KEY)"}`);
    console.log(`• Sarvam AI Voice    : ${summary.sarvam.configured ? `✅ Configured [${summary.sarvam.ttsModel} / ${summary.sarvam.translationModel}]` : "⚠️  Unconfigured (Set SARVAM_API_KEY)"}`);
    console.log(`• Redis / BullMQ     : ✅ Target: ${summary.redis.urlProvided ? "via REDIS_URL" : `${summary.redis.host}:${summary.redis.port}`}`);
    console.log(`• Object Storage (S3): ${summary.storage.configured ? `✅ Bucket: ${summary.storage.bucket}` : "⚠️  Unconfigured (S3 uploads disabled)"}`);
    console.log(`• Email (Resend)     : ${summary.email.configured ? `✅ Active (${summary.email.from})` : "⚠️  Unconfigured (Emails will fail)"}`);
    console.log("─────────────────────────────────────────────────────────────");
};
