# Lok-Setu — Local Development Setup Guide

This guide details how to set up, configure, and run the **Lok-Setu** development environment.

---

## 1. Prerequisites

Ensure you have the following installed locally:

- **Node.js**: v20+ (v22 LTS recommended)
- **npm**: v10+
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017`) or a free MongoDB Atlas cluster.
- **Redis**: Local Redis server (`127.0.0.1:6379`) or a cloud instance (e.g. Upstash).
  - *Note:* Redis is required for BullMQ background email jobs and API rate limiting.

---

## 2. Setting Up the Backend

### Step 1: Install Dependencies
From the repository root:
```bash
cd backend
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Edit `.env` and fill in:
- `MONGODB_URI`: Your MongoDB connection string.
- `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`: Generate two random 64-character hex strings:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `GEMINI_API_KEY`: Get a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
- (Optional for email/S3 features): Add your `RESEND_API_KEY` and AWS S3 credentials.

### Step 3: Start Services
Ensure MongoDB and Redis are running:
```bash
# Verify MongoDB
mongosh --eval "db.runCommand({ ping: 1 })"

# Verify Redis
redis-cli ping
# Expected output: PONG
```

### Step 4: Run the Backend
In development mode with auto-reload:
```bash
npm run dev
```

The server will start at `http://localhost:8000`. You should see the sanitized startup diagnostics:
```text
🏛️ Lok-Setu Configuration Diagnostics:
  - Database (MongoDB): Configured
  - Authentication (JWT): Configured
  - Gemini AI Service: Configured (Model: gemini-2.5-flash)
  - Redis / Queues: Configured (127.0.0.1:6379)
  - Object Storage (S3): Configured (Bucket: lok-setu-storage)
  - Email (Resend): Configured
🚀 Lok Setu server running at port 8000
```

Verify the health check endpoint:
```bash
curl http://localhost:8000/health
# Response: {"success":true,"message":"Lok Setu API is running 🏛️"}
```

---

## 3. Working Without Optional Services (Graceful Fallbacks)

- **Without Redis:** The server will log a diagnostic warning for Redis and rate-limiting. Attempting to enqueue email jobs will return a descriptive service unavailable error rather than silently failing.
- **Without Gemini API Key:** The server will boot, but calls to AI endpoints (`/api/v1/explainers/*`, `/api/v1/chat/*`) will explicitly report that `GEMINI_API_KEY` is required.
- **Without AWS S3:** Document upload endpoints will indicate that S3 credentials are required.

No fake data or placeholder responses are ever returned.
