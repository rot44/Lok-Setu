# Lok-Setu — Environment & Security Architecture

This document outlines the environment configuration, secret management standards, and client-server boundaries for **Lok-Setu**.

---

## 1. Security Architecture & Boundary Rules

1. **Zero Secret Leakage to Client:**
   Under no circumstances may backend secrets, database connection URIs, JWT signing secrets, Google Gemini API keys, AWS credentials, or Resend keys be bundled into or accessible by frontend code.
2. **Backend as Sole AI & Data Gateway:**
   All interactions with Google Gemini, MongoDB, Redis, AWS S3, and Resend must be mediated exclusively through the Express backend API (`/api/v1/*`). The browser client never communicates directly with third-party cloud AI or storage APIs.
3. **Frontend Variable Conventions:**
   Vite statically replaces variables prefixed with `VITE_` during build time and embeds them in plain text in client JavaScript bundles.
   - **Allowed in Frontend (`VITE_*`):** Non-sensitive public endpoints and configuration flags only (e.g., `VITE_API_BASE_URL`, `VITE_APP_TITLE`, `VITE_ENABLE_ANALYTICS`).
   - **Strictly Prohibited in Frontend:**
     - ❌ `VITE_GEMINI_API_KEY`
     - ❌ `VITE_AWS_SECRET_ACCESS_KEY`
     - ❌ `VITE_ACCESS_TOKEN_SECRET`
     - ❌ `VITE_MONGODB_URI`
     - ❌ `VITE_RESEND_API_KEY`
4. **Session & Token Storage:**
   JWT access and refresh tokens are conveyed through secure, `HTTP-only`, `SameSite=Lax` cookies with `secure: true` in production, protecting them against cross-site scripting (XSS) extraction.
5. **No Secret Logging:**
   Backend environment validators, loggers, and error handlers must sanitize or mask any configuration strings before printing to console output (e.g. `sk-...`).

---

## 2. Backend Environment Variables Reference (`backend/.env`)

| Variable | Required in Prod | Default / Fallback | Purpose |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `8000` | Port on which Express listens. |
| `NODE_ENV` | Yes | `development` | `development`, `production`, or `test`. |
| `CLIENT_URL` | Yes | `http://localhost:5173` | Allowed CORS origin for credentials and cookies. |
| `MONGODB_URI` | **Yes** | `mongodb://127.0.0.1:27017` | MongoDB connection URI. |
| `DB_NAME` | No | `lokSetu` | Database name. |
| `ACCESS_TOKEN_SECRET` | **Yes** | _None (Throws in prod)_ | Secret key for signing short-lived JWT access tokens. |
| `ACCESS_TOKEN_EXPIRY` | No | `1d` | Access token lifespan. |
| `REFRESH_TOKEN_SECRET` | **Yes** | _None (Throws in prod)_ | Secret key for signing long-lived JWT refresh tokens. |
| `REFRESH_TOKEN_EXPIRY` | No | `7d` | Refresh token lifespan. |
| `REDIS_URL` | No | _None_ | Full Redis URI (takes priority over host/port). |
| `REDIS_HOST` | No | `127.0.0.1` | Redis host for rate limiting and BullMQ. |
| `REDIS_PORT` | No | `6379` | Redis port. |
| `REDIS_PASSWORD` | No | _None_ | Redis password. |
| `RESEND_API_KEY` | Optional in dev | _None_ | API key for Resend email service. |
| `RESEND_FROM_EMAIL` | No | `Lok Setu <onboarding@resend.dev>` | Verified sender address. |
| `AWS_REGION` | Optional in dev | `ap-south-1` | AWS S3 region. |
| `AWS_ACCESS_KEY_ID` | Optional in dev | _None_ | AWS IAM Access Key ID. |
| `AWS_SECRET_ACCESS_KEY` | Optional in dev | _None_ | AWS IAM Secret Access Key. |
| `AWS_S3_BUCKET_NAME` | Optional in dev | _None_ | Target S3 bucket for documents and audio. |
| `GEMINI_API_KEY` | **Yes** | _None_ | Google AI Studio API key for Gemini. |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Primary grounded LLM for civic chat & explainers. |
| `GEMINI_EMBEDDING_MODEL`| No | `text-embedding-004` | Model for document chunk vector embeddings. |
| `GEMINI_TTS_MODEL` | No | `gemini-2.5-flash` | Voice audio synthesis model. |
| `GEMINI_TIMEOUT_MS` | No | `30000` | Request timeout in milliseconds (30s). |
| `GEMINI_MAX_RETRIES` | No | `3` | Exponential backoff retry limit. |

---

## 3. Frontend Environment Variables Reference (`frontend/.env`)

When the React + Vite frontend is initialized, its configuration must conform to this schema:

| Variable | Required | Typical Development Value | Purpose |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | No | `/api/v1` (via Vite proxy) or `http://localhost:8000/api/v1` | Base URL for backend API requests. |
| `VITE_APP_NAME` | No | `Lok-Setu` | Brand title displayed in UI headers and meta tags. |
| `VITE_DEFAULT_LANGUAGE` | No | `hi` (Hindi) | Default UI language fallback. |

### Sample `frontend/.env.example`
```env
# Base URL for API calls (leave empty or '/api/v1' if using Vite dev server proxy)
VITE_API_BASE_URL=/api/v1

# Application Name
VITE_APP_NAME=Lok-Setu

# Default Language Code (hi, en, gu, mr, ta, te, kn, bn)
VITE_DEFAULT_LANGUAGE=hi
```

---

## 4. Environment Diagnostics & Validation at Startup

The backend runs an automated configuration validation pass at startup (`src/config/env.js`):
1. **Production Mode:** Immediately halts server boot if critical secrets (`MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `GEMINI_API_KEY`) are missing.
2. **Development Mode:** Logs a sanitized status summary showing which subsystems are active (MongoDB, JWT Auth, Redis, Resend, S3, Gemini AI) and flags missing optional dependencies.
3. **No Silent Failures:** If a feature requires an unconfigured service (e.g. attempting to generate an explainer without `GEMINI_API_KEY`, or queue an email without Redis/Resend), the backend returns a clear `503 Service Unavailable` with actionable diagnostic instructions rather than returning mock/fake data or crashing.
