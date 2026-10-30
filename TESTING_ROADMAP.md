# 🏛️ Lok Setu (Civic AI) — Exhaustive Step-by-Step Testing Roadmap

This is the **step-by-step master testing runbook** for the Lok Setu backend. Every single test case is documented with explicit, sequential execution steps, exact payload data, expected HTTP status codes, response assertions, and internal database reasoning.

---

## 🛠️ Phase 0: Pre-Flight Environment Setup

Follow these exact steps before initiating Postman tests:

### Step 1: Ensure Prerequisites
* **MongoDB**: Atlas Cluster connected (`MONGODB_URI` in `.env`).
* **Node.js**: v18+ running ES modules.
* **Redis**: Local Mac service running via `brew services start redis` (for BullMQ).
* **AWS S3**: Bucket `irctc-space` in `eu-north-1` configured in `.env`.

### Step 2: Seed 7 Verified Government Schemes
Run the seeder from terminal:
```bash
cd "Lok Setu/backend"
npm run seed:schemes
```
* **Verify Terminal Output**: Must show `✅ Seeded: ...` for 7 schemes (PM-Kisan, NSP Scholarship, Ayushman Bharat, Beti Bachao Beti Padhao, CGTMSE, PMAY-U, UP Kanya Sumangala) followed by `🎉 Successfully seeded 7 real government schemes!`.

### Step 3: Boot The Backend Server
```bash
npm run dev
```
* **Verify Terminal Output**:
  - `MongoDB connected successfully and host is ac-...`
  - `🚀 Lok Setu server running at port 8000`

---

## 📋 Suite 1: System Health Check

### Test Case: `TC-SYS-01` — Base API Uptime Verification
* **Step 1 (Method & URL)**: `GET http://localhost:8000/health`
* **Step 2 (Headers)**: None required.
* **Step 3 (Body)**: None (empty).
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body**:
    ```json
    {
      "success": true,
      "message": "Lok Setu API is running 🏛️"
    }
    ```
* **Step 5 (Technical Reason)**: Verifies the Express application instance, routing middleware, and server process are operational.

---

## 📋 Suite 2: Auth & 2FA Security Pipeline (`/api/v1/auth`)

### Test Case: `TC-AUTH-01` — Valid Citizen Registration (2FA Trigger)
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/register`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "username": "prakhar_citizen",
    "email": "prakhar.test@gmail.com",
    "password": "Password@123",
    "phone": "9876543210",
    "state": "Uttar Pradesh",
    "city": "Varanasi"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `201 Created`
  - **Response Body**: `success: true`, `isVerified: false`.
  - **Terminal Check**: Check backend console. It prints:
    ```
    ==================================================
    🔑 [DEV MODE OTP for prakhar.test@gmail.com]: <6_DIGIT_OTP>
    ==================================================
    ```
* **Step 5 (Technical Reason)**: User document created with BCrypt password hashing. Linked `UserProfile` auto-initialized with "Uttar Pradesh". 6-digit OTP generated with 10-minute expiry.

---

### Test Case: `TC-AUTH-02` — Duplicate Email Prevention
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/register`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "username": "another_user",
    "email": "prakhar.test@gmail.com",
    "password": "Password@123"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `409 Conflict`
  - **Response Body**: `message: "A user with this email or username already exists."`
* **Step 5 (Technical Reason)**: MongoDB unique index on `email` prevents duplicate citizen identity creation.

---

### Test Case: `TC-AUTH-03` — Password Validation (< 8 Chars)
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/register`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "username": "short_pass_user",
    "email": "short@example.com",
    "password": "pass"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `400 Bad Request`
  - **Response Body**: `message: "Password must be at least 8 characters long."`
* **Step 5 (Technical Reason)**: Controller boundary validation intercepts weak passwords before hitting database.

---

### Test Case: `TC-AUTH-04` — Missing Required Fields
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/register`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "email": "onlyemail@example.com"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `400 Bad Request`
  - **Response Body**: `message: "Username, email, and password are required."`
* **Step 5 (Technical Reason)**: Input sanitizer enforces mandatory schema fields.

---

### Test Case: `TC-AUTH-05` — Verify Registration OTP with Wrong Code
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/verify-otp`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "email": "prakhar.test@gmail.com",
    "otp": "000000"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `400 Bad Request`
  - **Response Body**: `message: "Invalid or expired verification OTP."`
* **Step 5 (Technical Reason)**: OTP mismatch prevents unauthorized account activation.

---

### Test Case: `TC-AUTH-06` — Verify Registration OTP (Happy Path)
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/verify-otp`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**: Feed the exact 6-digit OTP from your terminal log:
  ```json
  {
    "email": "prakhar.test@gmail.com",
    "otp": "<PASTE_OTP_HERE>"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body**: `message: "Email verified successfully! Welcome to Lok Setu 🏛️"`
  - **Cookies Assert**: Postman response tab should show `accessToken` and `refreshToken` received in HTTP-only cookies.
* **Step 5 (Technical Reason)**: User record updated to `isVerified: true`, OTP wiped out, JWT session established.

---

### Test Case: `TC-AUTH-07` — Resend OTP to Verified Account
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/resend-otp`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "email": "prakhar.test@gmail.com"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body**: `message: "Email is already verified."`
* **Step 5 (Technical Reason)**: Prevents redundant OTP generation for verified citizens.

---

### Test Case: `TC-AUTH-08` — Login via Email
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/login`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "email": "prakhar.test@gmail.com",
    "password": "Password@123"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Cookies Received**: `accessToken` (1d validity) and `refreshToken` (7d validity).
* **Step 5 (Technical Reason)**: Model chains `.select("+password")` to retrieve and verify bcrypt hash without exposing password in response.

---

### Test Case: `TC-AUTH-09` — Login via Username
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/login`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "username": "prakhar_citizen",
    "password": "Password@123"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body**: `message: "Citizen login successful! 🏛️"`
* **Step 5 (Technical Reason)**: Login controller uses `$or: [{ email }, { username }]` for flexible citizen access.

---

### Test Case: `TC-AUTH-10` — Login with Wrong Password
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/login`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "email": "prakhar.test@gmail.com",
    "password": "WrongPassword999"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `401 Unauthorized`
  - **Response Body**: `message: "Invalid credentials."`
* **Step 5 (Technical Reason)**: `user.isPasswordCorrect()` returns false, triggering a 401 error.

---

### Test Case: `TC-AUTH-11` — Get Current Citizen Profile (`/me`)
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/auth/me`
* **Step 2 (Headers)**: None (Postman automatically attaches cookie from Login step).
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body**: Returns `user` object with `username`, `email`, `role`, but `password` and `refreshToken` are stripped.
* **Step 5 (Technical Reason)**: `verifyJWT` decodes token and attaches sanitized `req.user`.

---

### Test Case: `TC-AUTH-12` — Unauthorized Request Without Token
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/auth/me`
* **Step 2 (Postman Setup)**: In Postman, clear or disable cookies for `localhost`.
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `401 Unauthorized`
  - **Response Body**: `message: "Unauthorised Request"`
* **Step 5 (Technical Reason)**: `verifyJWT` blocks requests lacking cookie or Authorization header.

---

### Test Case: `TC-AUTH-13` — Refresh Access Token
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/refresh-token`
* **Step 2 (Headers)**: Cookie containing valid `refreshToken`.
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body**: Returns new `accessToken`.
* **Step 5 (Technical Reason)**: Rotates refresh token in MongoDB to prevent replay attacks.

---

### Test Case: `TC-AUTH-14` — Forgot Password Flow
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/forgot-password`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "email": "prakhar.test@gmail.com"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Terminal Check**: Check console for `🔑 [DEV MODE FORGOT PASSWORD OTP]: <OTP>`.
* **Step 5 (Technical Reason)**: Generates 6-digit reset OTP valid for 10 minutes.

---

### Test Case: `TC-AUTH-15` — Reset Password Flow
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/reset-password`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "email": "prakhar.test@gmail.com",
    "otp": "<RESET_OTP_FROM_TERMINAL>",
    "newPassword": "NewPassword@2026"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body**: `message: "Password reset successfully! You can now log in."`
* **Step 5 (Technical Reason)**: Verifies OTP, hashes new password, invalidates OTP.

---

### Test Case: `TC-AUTH-16` — Citizen Logout
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/logout`
* **Step 2 (Headers)**: Active session cookie (after logging in with `NewPassword@2026`).
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body**: `message: "Citizen logged out successfully."`
  - **Cookies Assert**: Postman cookies `accessToken` and `refreshToken` are cleared.
* **Step 5 (Technical Reason)**: Clears `refreshToken` in MongoDB database and expires cookies.

---

### Test Case: `TC-AUTH-17` — Auth Rate Limiting (11 Rapid Requests)
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/auth/login`
* **Step 2 (Action)**: Send request 11 times within 10 seconds.
* **Step 3 (Assert 11th Request)**:
  - **Status Code**: `429 Too Many Requests`
  - **Response Body**: `message: "Too many auth attempts. Please try again after 10 minutes."`
* **Step 4 (Technical Reason)**: `authRateLimiter` middleware protects against credential brute-forcing.

---

## 📋 Suite 3: Citizen Profile & Demographics (`/api/v1/profile`)

> Ensure you are logged in so cookies are attached.

### Test Case: `TC-PROF-01` — Fetch Profile (Auto-Provisioning)
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/profile`
* **Step 2 (Headers)**: Cookies active.
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body**: Returns profile with populated `user` details (`username`, `email`, `role`).
* **Step 5 (Technical Reason)**: Self-healing architecture: If a citizen profile record does not exist, controller creates one with sane defaults.

---

### Test Case: `TC-PROF-02` — Update Complete Citizen Profile
* **Step 1 (Method & URL)**: `PUT http://localhost:8000/api/v1/profile`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "dob": "2004-01-15",
    "age": 22,
    "gender": "male",
    "maritalStatus": "single",
    "religion": "hindu",
    "caste": "general",
    "isSpeciallyAbled": false,
    "state": "Uttar Pradesh",
    "city": "Varanasi",
    "location": {
      "area": "Lanka",
      "pincode": "221005",
      "localityType": "urban"
    },
    "incomeRange": "below_2.5_lakh",
    "rationCardType": "none",
    "occupation": "student",
    "isBusinessOwner": false,
    "isFarmer": false,
    "preferredLanguages": {
      "primary": "hi",
      "secondary": "en",
      "tertiary": "bho"
    }
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `isProfileComplete: true`
    - `preferredLanguages.primary: "hi"`, `tertiary: "bho"`
* **Step 5 (Technical Reason)**: Updates all 16 demographic fields and marks profile complete.

---

### Test Case: `TC-PROF-03` — Citizen Dashboard Overview & Scheme Matching
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/profile/dashboard`
* **Step 2 (Headers)**: Cookies active.
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `dashboardMetrics.matchedSchemesCount`: `>= 1`
    - `matchedSchemes`: Contains "National Scholarship Portal" (matches occupation: `student` and state: `Uttar Pradesh`).
* **Step 5 (Technical Reason)**: Controller executes dynamic compound MongoDB query matching citizen's state and occupation.

---

## 📋 Suite 4: Card 2 — Explore Schemes & Multi-Filters (`/api/v1/explore`)

### Test Case: `TC-EXP-01` — Fetch Sidebar Filter Metadata Counts
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/explore/filters-meta`
* **Step 2 (Headers)**: None.
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `categories`: Contains counts for `Education`, `Agriculture`, `Healthcare`, `Women & Child`, `MSME & Business`, `Housing`.
    - `jurisdictions`: `central >= 6`, `state >= 1`.
    - `states`: Contains `"Uttar Pradesh"`.
* **Step 5 (Technical Reason)**: Powers dynamic counts shown in the left sidebar of the UI screenshot.

---

### Test Case: `TC-EXP-02` — Default Scheme Listing (Page 1)
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/explore`
* **Step 2 (Headers)**: None.
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `pagination.page: 1`
    - `pagination.limit: 12`
    - `schemes.length: 7`
* **Step 5 (Technical Reason)**: Returns all seeded government schemes sorted by `createdAt: -1`.

---

### Test Case: `TC-EXP-03` — Full-Text Search ("Kisan")
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/explore?search=Kisan`
* **Step 2 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**: Returns "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)" as the primary result.
* **Step 3 (Technical Reason)**: Full-text indexing on `title` and `rawExtractedText`.

---

### Test Case: `TC-EXP-04` — Quick Tab Filter (Policies Only)
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/explore?documentType=policy`
* **Step 2 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**: Only returns "Beti Bachao Beti Padhao" (`documentType === "policy"`).
* **Step 3 (Technical Reason)**: Quick top tabs filter between Schemes, Policies, and Circulars.

---

### Test Case: `TC-EXP-05` — State Jurisdiction Filter (Uttar Pradesh)
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/explore?state=Uttar Pradesh`
* **Step 2 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**: Returns schemes where `applicableState` is `"Uttar Pradesh"` or `"ALL"`.
* **Step 3 (Technical Reason)**: Region-targeted filtering ensuring citizens see both central and home-state benefits.

---

### Test Case: `TC-EXP-06` — Gender Filter (Female Exclusive)
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/explore?gender=female`
* **Step 2 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**: Returns "Beti Bachao Beti Padhao" and "UP Kanya Sumangala".
* **Step 3 (Technical Reason)**: Queries `eligibilityRules.genders: { $in: ["female", "ALL"] }`.

---

### Test Case: `TC-EXP-07` — Pagination Test (Limit 2)
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/explore?page=1&limit=2`
* **Step 2 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `schemes.length: 2`
    - `pagination.hasMore: true`
    - `pagination.totalPages: 4`
* **Step 3 (Technical Reason)**: Mongoose `.skip(0).limit(2)` provides clean server-side pagination.

---

### Test Case: `TC-EXP-08` — Search with Zero Results (Honest Empty State)
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/explore?search=nonexistentterm123`
* **Step 2 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `schemes: []`
    - `pagination.totalCount: 0`
* **Step 3 (Technical Reason)**: Strict adherence to zero-dummy-data requirement; honest empty array returned.

---

### Test Case: `TC-EXP-09` — Single Scheme by ID
* **Step 1 (Get Scheme ID)**: Copy any `_id` from `TC-EXP-02` (e.g., PM-Kisan ID).
* **Step 2 (Method & URL)**: `GET http://localhost:8000/api/v1/explore/<SCHEME_ID>`
* **Step 3 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**: Contains full scheme object, eligibility rules, and `officialPortalUrl`.
* **Step 4 (Technical Reason)**: Retrieves single official record for detailed card view.

---

## 📋 Suite 5: Card 1 — Eligibility Matching Engine (`/api/v1/eligibility`)

### Test Case: `TC-ELIG-01` — Match All Schemes for Student Profile
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/eligibility/match-all`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "age": 20,
    "gender": "male",
    "state": "Uttar Pradesh",
    "occupation": "student",
    "caste": "general"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `eligibleSchemes`: Contains "National Scholarship Portal" (`isEligible: true`).
    - `passedCriteria`: Contains `"Age (20 yrs) satisfies criteria"` and `"Occupation (student) meets scheme criteria"`.
* **Step 5 (Technical Reason)**: Pure mathematical evaluation engine compares citizen data against all seeded documents.

---

### Test Case: `TC-ELIG-02` — Match All Schemes for Farmer Profile
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/eligibility/match-all`
* **Step 2 (Headers)**: `Content-Type: application/json`
* **Step 3 (Body Payload)**:
  ```json
  {
    "age": 45,
    "gender": "male",
    "state": "Madhya Pradesh",
    "occupation": "farmer"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `eligibleSchemes`: Contains "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)".
* **Step 5 (Technical Reason)**: Matches `occupations: ["farmer", "ALL"]`.

---

### Test Case: `TC-ELIG-03` — Check Single Scheme Eligibility (Eligible Case)
* **Step 1 (Get NSP Scholarship ID)**: Find `_id` of "National Scholarship Portal".
* **Step 2 (Method & URL)**: `POST http://localhost:8000/api/v1/eligibility/check/<NSP_SCHEME_ID>`
* **Step 3 (Body Payload)**:
  ```json
  {
    "age": 20,
    "gender": "male",
    "occupation": "student",
    "state": "Delhi"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `isEligible: true`
    - `matchPercentage: 100`
    - `failedCriteria: []`
* **Step 5 (Technical Reason)**: Age 20 is within [17, 25], occupation is student, jurisdiction is central (all India).

---

### Test Case: `TC-ELIG-04` — Check Single Scheme Ineligible Due to Age Limit
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/eligibility/check/<NSP_SCHEME_ID>`
* **Step 2 (Body Payload)**:
  ```json
  {
    "age": 30,
    "occupation": "student",
    "state": "Delhi"
  }
  ```
* **Step 3 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `isEligible: false`
    - `failedCriteria`: Contains `"Age 30 exceeds maximum eligible age of 25 years."`
* **Step 4 (Technical Reason)**: Precise failure explanation provides transparent feedback to citizen.

---

### Test Case: `TC-ELIG-05` — Check Single Scheme Ineligible Due to Gender Mismatch
* **Step 1 (Get Beti Bachao ID)**: Find `_id` of "Beti Bachao Beti Padhao".
* **Step 2 (Method & URL)**: `POST http://localhost:8000/api/v1/eligibility/check/<BETI_BACHAO_ID>`
* **Step 3 (Body Payload)**:
  ```json
  {
    "age": 16,
    "gender": "male"
  }
  ```
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `isEligible: false`
    - `failedCriteria`: Contains `"Scheme is exclusively for female applicants."`
* **Step 5 (Technical Reason)**: Evaluates `genders: ["female"]` constraint.

---

## 📋 Suite 6: Card 4 — Stay Notified Timeline (`/api/v1/notifications`)

### Test Case: `TC-NOTIF-01` — Header Bell Badge Count
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/notifications/count`
* **Step 2 (Headers)**: None.
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `data.recentCount: 7` (from the 7 seeded notifications created today).
* **Step 5 (Technical Reason)**: Queries documents created within past 7 days (`createdAt >= 7 days ago`).

---

### Test Case: `TC-NOTIF-02` — Timeline Feed Grouped by Days
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/notifications`
* **Step 2 (Headers)**: None.
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `timeline.today`: Array of notifications created today.
    - `timeline.yesterday`: Array.
    - `timeline.earlierThisWeek`: Array.
* **Step 5 (Technical Reason)**: JavaScript temporal grouping organizes circulars into civic timeline.

---

## 📋 Suite 7: Card 3 — Document Analysis Pipeline (`/api/v1/analyze`)

> Requires cookies or Authorization header.

### Test Case: `TC-ANA-01` — Initialize AI Analysis Session
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/analyze/init-session`
* **Step 2 (Headers)**: Active session cookie.
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `sessionId`: New session ID.
    - `initialSystemContext`: Contains pre-prompt with citizen's state (`Uttar Pradesh`), occupation (`student`), and language (`hi`).
* **Step 5 (Technical Reason)**: Pre-computes citizen context for the teammate's LangGraph/Gemini AI agent.

---

### Test Case: `TC-ANA-02` — Upload Document to Amazon S3 (Multipart/Form-Data)
* **Step 1 (Method & URL)**: `POST http://localhost:8000/api/v1/analyze/upload`
* **Step 2 (Headers)**: Active session cookie. (Postman handles `multipart/form-data` boundary automatically).
* **Step 3 (Body Setup in Postman)**:
  - Go to **Body** tab -> select **form-data**.
  - Key: `document` (Change type dropdown from Text to **File**).
  - Value: Select any real `.pdf` or `.png` file from your computer.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**:
    - `fileUrl`: Points to `https://irctc-space.s3.eu-north-1.amazonaws.com/user-uploads/...`
    - `status: "uploaded"`
    - `fileHash`: 64-char SHA-256 string.
* **Step 5 (Technical Reason)**: Performs binary magic bytes sniffing, computes SHA-256 checksum, and streams file to Amazon S3.

---

### Test Case: `TC-ANA-03` — File Sniffing Rejects Spoofed File
* **Step 1 (Create Spoofed File)**: Take a text file or `.exe`, rename it to `fake.pdf`.
* **Step 2 (Method & URL)**: `POST http://localhost:8000/api/v1/analyze/upload`
* **Step 3 (Body)**: Key `document` -> select `fake.pdf`.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `400 Bad Request`
  - **Response Body Assert**: `message: "Invalid file type detected by binary signature"`
* **Step 5 (Technical Reason)**: `fileValidator.js` inspects binary magic bytes (`%PDF-`) rather than trusting file extension.

---

### Test Case: `TC-ANA-04` — Citizen Upload History
* **Step 1 (Method & URL)**: `GET http://localhost:8000/api/v1/analyze/history`
* **Step 2 (Headers)**: Active session cookie.
* **Step 3 (Body)**: Empty.
* **Step 4 (Send & Assert)**:
  - **Status Code**: `200 OK`
  - **Response Body Assert**: Returns list of documents uploaded by this citizen.
* **Step 5 (Technical Reason)**: Queries `UserAnalyzedDocument` filtering by `user: req.user._id`.

---

## 🎯 Verification Matrix Quick Reference

| Suite | Focus Area | Total Cases | Key Assertions |
| :--- | :--- | :--- | :--- |
| **Suite 1** | System Uptime | 1 | `200 OK`, health response |
| **Suite 2** | Auth & 2FA Pipeline | 17 | BCrypt hash, 2FA OTP, JWT cookies, rate limit `429` |
| **Suite 3** | Citizen Profile | 3 | Demographics, 3 languages, Dashboard match |
| **Suite 4** | Card 2: Explore Schemes | 9 | Metadata counts, full-text search, pagination |
| **Suite 5** | Card 1: Eligibility Engine | 5 | Reason-based matching, age/gender restrictions |
| **Suite 6** | Card 4: Stay Notified | 2 | 7-day timeline grouping, Navbar badge count |
| **Suite 7** | Card 3: Document Analysis | 4 | S3 upload, binary sniffing, SHA-256 deduplication |
| **Total** | **All Modules** | **41 Step-by-Step Cases** | **100% Backend API Verification** |
