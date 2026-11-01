// app.js — creates and configures the Express application
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler } from "./middlewares/error.middleware.js";
import { apiRateLimiter } from "./middlewares/rateLimiter.middleware.js";

// Route imports
import authRouter from "./routes/auth.routes.js";
import notificationRouter from "./routes/notification.routes.js";
import analysisRouter from "./routes/analysis.routes.js";
import exploreRouter from "./routes/explore.routes.js";
import profileRouter from "./routes/userProfile.routes.js";
import eligibilityRouter from "./routes/eligibility.routes.js";
import documentRouter from "./routes/document.routes.js";
import assistantRouter from "./routes/assistant.routes.js";

const app = express();

// Trust reverse proxies (Render, Cloudflare, Vercel, Nginx, AWS)
// Set to true so Express correctly reads X-Forwarded-For for real client IP and HTTPS cookies
app.set("trust proxy", true);

// Compress all HTTP responses (gzip/Brotli) — must be first
app.use(compression());

// Set secure HTTP headers
// crossOriginResourcePolicy:false — helmet manages all other security headers
// but does NOT block cross-origin asset loading (needed for S3 audio/image URLs)
app.use(helmet({ crossOriginResourcePolicy: false }));

// HTTP request logger (dev mode: coloured, concise)
app.use(morgan("dev"));

// Enable CORS — supports local development, any Vercel deployment (*.vercel.app), and custom CLIENT_URL
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
];

if (process.env.CLIENT_URL) {
    const customOrigins = process.env.CLIENT_URL.split(",").map((u) => u.trim().replace(/\/$/, ""));
    allowedOrigins.push(...customOrigins);
}

const isOriginAllowed = (origin) => {
    // Allow non-browser requests (mobile apps, curl, server-to-server)
    if (!origin) return true;

    // Allow localhost and local IP development ports
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;

    // Allow all Vercel deployment URLs (production, preview, branch deployments)
    if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return true;

    // Allow explicitly defined origins in CLIENT_URL
    if (allowedOrigins.includes(origin)) return true;

    // Civic platform: reflect origin for public browser access
    return true;
};

app.use(
    cors({
        origin: (origin, callback) => {
            if (isOriginAllowed(origin)) {
                return callback(null, true);
            }
            return callback(new Error("CORS policy violation: origin not allowed"));
        },
        credentials: true,
        optionsSuccessStatus: 200,
    })
);

// Apply global rate limiting across all routes
app.use(apiRateLimiter);

// Body parsers
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Cookie parser — reads JWT tokens stored in HTTP-only cookies
app.use(cookieParser());

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1/analyze", analysisRouter);
app.use("/api/v1/explore", exploreRouter);
app.use("/api/v1/profile", profileRouter);
app.use("/api/v1/eligibility", eligibilityRouter);
app.use("/api/v1/documents", documentRouter);
app.use("/api/v1/assistant", assistantRouter);

// Health check (used by Render / Railway / cloud deployment platforms)
app.get("/", (req, res) => {
    res.status(200).json({ success: true, message: "Lok Setu API is running 🏛️" });
});
app.get("/health", (req, res) => {
    res.status(200).json({ success: true, message: "Lok Setu API is running 🏛️" });
});
app.get("/api/v1/health", (req, res) => {
    res.status(200).json({ success: true, message: "Lok Setu API is running 🏛️" });
});

// ─── Global Error Handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

export default app;
