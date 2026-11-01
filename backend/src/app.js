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

// Trust reverse proxies (Render, Railway, Vercel, Nginx, AWS, Cloudflare)
// Required for accurate HTTPS detection, secure cookies, and proxy IP resolution
app.set("trust proxy", 1);

// Compress all HTTP responses (gzip/Brotli) — must be first
app.use(compression());

// Set secure HTTP headers
// crossOriginResourcePolicy:false — helmet manages all other security headers
// but does NOT block cross-origin asset loading (needed for S3 audio/image URLs)
app.use(helmet({ crossOriginResourcePolicy: false }));

// HTTP request logger (dev mode: coloured, concise)
app.use(morgan("dev"));

// Enable CORS — supports single or comma-separated allowed origins (e.g., local + deployed Vercel domain)
const clientOriginConfig = process.env.CLIENT_URL
    ? (process.env.CLIENT_URL.includes(",")
        ? process.env.CLIENT_URL.split(",").map((u) => u.trim().replace(/\/$/, ""))
        : process.env.CLIENT_URL.trim().replace(/\/$/, ""))
    : true;

app.use(
    cors({
        origin: clientOriginConfig,
        credentials: true,
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
