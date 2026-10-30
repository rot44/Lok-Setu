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

const app = express();

// Compress all HTTP responses (gzip/Brotli) — must be first
app.use(compression());

// Set secure HTTP headers
// crossOriginResourcePolicy:false — helmet manages all other security headers
// but does NOT block cross-origin asset loading (needed for S3 audio/image URLs)
app.use(helmet({ crossOriginResourcePolicy: false }));

// HTTP request logger (dev mode: coloured, concise)
app.use(morgan("dev"));

// Enable CORS — allows the React frontend to call this API with cookies
app.use(
    cors({
        origin: process.env.CLIENT_URL || true, // Set CLIENT_URL in .env for production
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

// Health check (used by Render / Railway deployment platforms)
app.get("/health", (req, res) => {
    res.status(200).json({ success: true, message: "Lok Setu API is running 🏛️" });
});

// ─── Global Error Handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

export default app;
