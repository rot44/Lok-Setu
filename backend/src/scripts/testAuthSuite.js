import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import mongoose from "mongoose";
import connectDB from "../db/index.js";
import { User } from "../models/user.model.js";

const BASE_URL = "http://localhost:8000/api/v1/auth";
const HEALTH_URL = "http://localhost:8000/health";

const results = [];
let storedCookies = {};

// Helper to parse Set-Cookie headers
const extractCookies = (res) => {
    // Node.js fetch getSetCookie() returns array of set-cookie headers
    const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const cookieHeader = res.headers.get("set-cookie");
    const all = rawCookies.length ? rawCookies : cookieHeader ? cookieHeader.split(/,(?=[a-zA-Z0-9_-]+=)/) : [];

    for (const cookieStr of all) {
        const parts = cookieStr.split(";")[0].split("=");
        if (parts.length === 2) {
            storedCookies[parts[0].trim()] = parts[1].trim();
        }
    }
};

const getCookieHeader = () => {
    return Object.entries(storedCookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
};

const logResult = (id, title, passed, detail) => {
    results.push({ id, title, passed, detail });
    const symbol = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${symbol} [${id}] ${title} — ${detail}`);
};

const runSuite = async () => {
    console.log("\n🏛️ ========================================================");
    console.log("   LOK SETU AUTOMATED AUTH TEST RUNNER (TC-AUTH-03 to 17)");
    console.log("========================================================\n");

    try {
        const healthRes = await fetch(HEALTH_URL);
        if (!healthRes.ok) throw new Error(`Health check returned ${healthRes.status}`);
        console.log("🌐 Server is healthy at http://localhost:8000\n");
    } catch (e) {
        console.error("❌ Cannot reach server at http://localhost:8000. Is `npm run dev` running?", e.message);
        process.exit(1);
    }

    await connectDB();

    // TC-AUTH-03: Weak Password (< 8 chars)
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: "weak_pwd_user",
                email: "weak@test.com",
                password: "short",
            }),
        });
        const data = await res.json();
        const passed = res.status === 400 && data.message.includes("at least 8 characters");
        logResult("TC-AUTH-03", "Weak Password (< 8 chars) Validation", passed, `Status: ${res.status}, Msg: "${data.message}"`);
    } catch (e) {
        logResult("TC-AUTH-03", "Weak Password Validation", false, e.message);
    }

    // TC-AUTH-04: Missing Required Fields
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "missing_fields@test.com" }),
        });
        const data = await res.json();
        const passed = res.status === 400 && data.message.includes("required");
        logResult("TC-AUTH-04", "Missing Fields Interception", passed, `Status: ${res.status}, Msg: "${data.message}"`);
    } catch (e) {
        logResult("TC-AUTH-04", "Missing Fields Interception", false, e.message);
    }

    // TC-AUTH-05: Verify Registration OTP with Wrong Code (using a fresh unverified account)
    try {
        await User.deleteOne({ email: "unverified_probe@test.com" });
        await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: "unverified_probe",
                email: "unverified_probe@test.com",
                password: "Password@123",
            }),
        });

        const res = await fetch(`${BASE_URL}/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "unverified_probe@test.com",
                otp: "000000",
            }),
        });
        const data = await res.json();
        const passed = res.status === 400 && data.message.includes("Invalid verification OTP");
        logResult("TC-AUTH-05", "Wrong OTP Rejection", passed, `Status: ${res.status}, Msg: "${data.message}"`);
        await User.deleteOne({ email: "unverified_probe@test.com" });
    } catch (e) {
        logResult("TC-AUTH-05", "Wrong OTP Rejection", false, e.message);
    }

    // TC-AUTH-07: Resend OTP to Verified Account
    try {
        const res = await fetch(`${BASE_URL}/resend-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "prakhar.test@gmail.com" }),
        });
        const data = await res.json();
        const passed = res.status === 200 && data.message.includes("already verified");
        logResult("TC-AUTH-07", "Resend OTP on Verified Account", passed, `Status: ${res.status}, Msg: "${data.message}"`);
    } catch (e) {
        logResult("TC-AUTH-07", "Resend OTP on Verified Account", false, e.message);
    }

    // TC-AUTH-08: Login via Email (Happy Path)
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "prakhar.test@gmail.com",
                password: "Password@123",
            }),
        });
        extractCookies(res);
        const data = await res.json();
        const passed = res.status === 200 && data.success === true && Boolean(storedCookies.accessToken);
        logResult("TC-AUTH-08", "Citizen Login via Email & Cookies", passed, `Status: ${res.status}, User: ${data.data?.user?.username}`);
    } catch (e) {
        logResult("TC-AUTH-08", "Citizen Login via Email", false, e.message);
    }

    // TC-AUTH-09: Login via Username
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: "prakhar_citizen",
                password: "Password@123",
            }),
        });
        const data = await res.json();
        const passed = res.status === 200 && data.success === true;
        logResult("TC-AUTH-09", "Citizen Login via Username", passed, `Status: ${res.status}, Msg: "${data.message}"`);
    } catch (e) {
        logResult("TC-AUTH-09", "Citizen Login via Username", false, e.message);
    }

    // TC-AUTH-10: Login with Wrong Password
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "prakhar.test@gmail.com",
                password: "WrongPassword999",
            }),
        });
        const data = await res.json();
        const passed = res.status === 401 && data.message.includes("Invalid");
        logResult("TC-AUTH-10", "Wrong Password Interception", passed, `Status: ${res.status}, Msg: "${data.message}"`);
    } catch (e) {
        logResult("TC-AUTH-10", "Wrong Password Interception", false, e.message);
    }

    // TC-AUTH-11: Get Current Citizen Context (/me) with valid session
    try {
        const res = await fetch(`${BASE_URL}/me`, {
            method: "GET",
            headers: {
                Cookie: getCookieHeader(),
            },
        });
        const data = await res.json();
        const passed = res.status === 200 && data.data?.user?.email === "prakhar.test@gmail.com";
        logResult("TC-AUTH-11", "Protected Profile Context (/me)", passed, `Status: ${res.status}, Authenticated as: ${data.data?.user?.username}`);
    } catch (e) {
        logResult("TC-AUTH-11", "Protected Profile Context (/me)", false, e.message);
    }

    // TC-AUTH-12: Unauthorized Request Without Token
    try {
        const res = await fetch(`${BASE_URL}/me`, {
            method: "GET",
        });
        const data = await res.json();
        const passed = res.status === 401 && data.message.toLowerCase().includes("unauthori");
        logResult("TC-AUTH-12", "Unauthorized Request Protection", passed, `Status: ${res.status}, Msg: "${data.message.trim()}"`);
    } catch (e) {
        logResult("TC-AUTH-12", "Unauthorized Request Protection", false, e.message);
    }

    // TC-AUTH-13: Refresh Access Token
    try {
        // Fallback pass refreshToken in body or cookie
        const res = await fetch(`${BASE_URL}/refresh-token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Cookie: getCookieHeader(),
            },
            body: JSON.stringify({
                refreshToken: storedCookies.refreshToken,
            }),
        });
        extractCookies(res);
        const data = await res.json();
        const passed = res.status === 200 && Boolean(data.data?.accessToken);
        logResult("TC-AUTH-13", "Refresh Token Rotation", passed, `Status: ${res.status}, New Token Issued: ${Boolean(data.data?.accessToken)}`);
    } catch (e) {
        logResult("TC-AUTH-13", "Refresh Token Rotation", false, e.message);
    }

    // TC-AUTH-14: Forgot Password Flow
    let resetOtp = null;
    try {
        const res = await fetch(`${BASE_URL}/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "prakhar.test@gmail.com" }),
        });
        const data = await res.json();

        const user = await User.findOne({ email: "prakhar.test@gmail.com" });
        resetOtp = user?.forgotPasswordOtp;

        const passed = res.status === 200 && Boolean(resetOtp);
        logResult("TC-AUTH-14", "Forgot Password Trigger & OTP Generation", passed, `Status: ${res.status}, Generated Reset OTP: ${resetOtp}`);
    } catch (e) {
        logResult("TC-AUTH-14", "Forgot Password Trigger", false, e.message);
    }

    // TC-AUTH-15: Reset Password with OTP
    try {
        const res = await fetch(`${BASE_URL}/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "prakhar.test@gmail.com",
                otp: resetOtp,
                newPassword: "NewPassword@2026",
            }),
        });
        const data = await res.json();
        const passed = res.status === 200 && data.message.toLowerCase().includes("reset");
        logResult("TC-AUTH-15", "Password Reset Execution", passed, `Status: ${res.status}, Msg: "${data.message}"`);
    } catch (e) {
        logResult("TC-AUTH-15", "Password Reset Execution", false, e.message);
    }

    // TC-AUTH-16: Citizen Logout
    try {
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: "prakhar.test@gmail.com",
                password: "NewPassword@2026",
            }),
        });
        extractCookies(loginRes);

        const res = await fetch(`${BASE_URL}/logout`, {
            method: "POST",
            headers: {
                Cookie: getCookieHeader(),
            },
        });
        const data = await res.json();
        const passed = res.status === 200 && data.message.toLowerCase().includes("logged out");
        logResult("TC-AUTH-16", "Citizen Logout & Session Invalidation", passed, `Status: ${res.status}, Msg: "${data.message}"`);
    } catch (e) {
        logResult("TC-AUTH-16", "Citizen Logout", false, e.message);
    }

    // TC-AUTH-17: Auth Rate Limiting (11 rapid requests)
    try {
        let rateLimited = false;
        for (let i = 0; i < 12; i++) {
            const res = await fetch(`${BASE_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: "ratelimit_probe@test.com",
                    password: "dummyPassword123",
                }),
            });
            if (res.status === 429) {
                rateLimited = true;
                break;
            }
        }
        logResult("TC-AUTH-17", "Auth Rate Limiter Protection (429)", rateLimited, `Rate Limit Triggered (Status 429 on rapid calls)`);
    } catch (e) {
        logResult("TC-AUTH-17", "Auth Rate Limiter Protection", false, e.message);
    }

    // Restore original password
    const restoredUser = await User.findOne({ email: "prakhar.test@gmail.com" });
    if (restoredUser) {
        restoredUser.password = "Password@123";
        await restoredUser.save();
        console.log("\n🔒 Restored password back to 'Password@123' for your ongoing manual Postman tests.");
    }

    // Final Summary
    const total = results.length;
    const passedCount = results.filter((r) => r.passed).length;
    console.log("\n📊 ========================================================");
    console.log(`   TEST SUMMARY: ${passedCount} / ${total} TESTS PASSED (${Math.round((passedCount / total) * 100)}%)`);
    console.log("========================================================\n");

    process.exit(0);
};

runSuite().catch((err) => {
    console.error("Runner crash:", err);
    process.exit(1);
});
