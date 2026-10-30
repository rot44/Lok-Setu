import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { Document } from "../models/document.model.js";
import connectDB from "../db/index.js";

const BASE_URL = "http://localhost:8000/api/v1";
const results = [];
let cookies = {};

const extractCookies = (res) => {
    const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const cookieHeader = res.headers.get("set-cookie");
    const all = rawCookies.length ? rawCookies : cookieHeader ? cookieHeader.split(/,(?=[a-zA-Z0-9_-]+=)/) : [];

    for (const cookieStr of all) {
        const parts = cookieStr.split(";")[0].split("=");
        if (parts.length === 2) {
            cookies[parts[0].trim()] = parts[1].trim();
        }
    }
};

const getCookieHeader = () => {
    return Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
};

const logResult = (id, title, passed, detail) => {
    results.push({ id, title, passed, detail });
    const symbol = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${symbol} [${id}] ${title} — ${detail}`);
};

const runAll = async () => {
    console.log("\n🏛️ ========================================================");
    console.log("   LOK SETU SUITES 3 TO 6 AUTOMATED TEST RUNNER");
    console.log("========================================================\n");

    await connectDB();

    // 1. Authenticate to obtain active session cookies
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: "prakhar.test@gmail.com",
            password: "Password@123",
        }),
    });
    extractCookies(loginRes);

    // ==========================================
    // SUITE 3: PROFILE & DEMOGRAPHICS
    // ==========================================
    console.log("\n📌 SUITE 3: PROFILE & DEMOGRAPHICS");

    // TC-PROF-01: Fetch Profile
    try {
        const res = await fetch(`${BASE_URL}/profile`, {
            headers: { Cookie: getCookieHeader() },
        });
        const data = await res.json();
        const passed = res.status === 200 && Boolean(data.data?._id);
        logResult("TC-PROF-01", "Fetch Profile (Auto-Provisioning)", passed, `Status: ${res.status}, State: ${data.data?.state}`);
    } catch (e) {
        logResult("TC-PROF-01", "Fetch Profile", false, e.message);
    }

    // TC-PROF-02: Complete Profile Update
    try {
        const res = await fetch(`${BASE_URL}/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Cookie: getCookieHeader(),
            },
            body: JSON.stringify({
                dob: "2004-01-15",
                age: 22,
                gender: "male",
                maritalStatus: "single",
                religion: "hindu",
                caste: "general",
                isSpeciallyAbled: false,
                state: "Uttar Pradesh",
                city: "Varanasi",
                location: {
                    area: "Lanka",
                    pincode: "221005",
                    localityType: "urban",
                },
                incomeRange: "1_to_2.5_lakh",
                rationCardType: "none",
                occupation: "student",
                preferredLanguages: {
                    primary: "hi",
                    secondary: "en",
                    tertiary: "bho",
                },
            }),
        });
        const data = await res.json();
        const passed = res.status === 200 && data.data?.isProfileComplete === true;
        logResult("TC-PROF-02", "Complete Profile Update", passed, `Status: ${res.status}, Profile Complete: ${data.data?.isProfileComplete}`);
    } catch (e) {
        logResult("TC-PROF-02", "Complete Profile Update", false, e.message);
    }

    // TC-PROF-03: Dashboard Overview & Matched Schemes
    try {
        const res = await fetch(`${BASE_URL}/profile/dashboard`, {
            headers: { Cookie: getCookieHeader() },
        });
        const data = await res.json();
        const count = data.data?.dashboardMetrics?.matchedSchemesCount || 0;
        const passed = res.status === 200 && count >= 1;
        logResult("TC-PROF-03", "Dashboard Matched Schemes", passed, `Status: ${res.status}, Matched Schemes: ${count}`);
    } catch (e) {
        logResult("TC-PROF-03", "Dashboard Matched Schemes", false, e.message);
    }

    // ==========================================
    // SUITE 4: CARD 2 — EXPLORE SCHEMES
    // ==========================================
    console.log("\n📌 SUITE 4: CARD 2 — EXPLORE SCHEMES");

    // TC-EXP-01: Filter Metadata Counts
    try {
        const res = await fetch(`${BASE_URL}/explore/filters-meta`);
        const data = await res.json();
        const passed = res.status === 200 && Boolean(data.data?.categories);
        logResult("TC-EXP-01", "Sidebar Filter Metadata Counts", passed, `Status: ${res.status}, Active Categories: ${Object.keys(data.data?.categories || {}).length}`);
    } catch (e) {
        logResult("TC-EXP-01", "Filter Metadata", false, e.message);
    }

    // TC-EXP-02: Default Scheme Listing
    try {
        const res = await fetch(`${BASE_URL}/explore`);
        const data = await res.json();
        const docs = data.data?.documents || [];
        const passed = res.status === 200 && docs.length >= 5;
        logResult("TC-EXP-02", "Default Scheme Listing (Page 1)", passed, `Status: ${res.status}, Schemes Count: ${docs.length}`);
    } catch (e) {
        logResult("TC-EXP-02", "Default Listing", false, e.message);
    }

    // TC-EXP-03: Full-Text Search ("Kisan")
    try {
        const res = await fetch(`${BASE_URL}/explore?search=Kisan`);
        const data = await res.json();
        const title = data.data?.documents?.[0]?.title || "";
        const passed = res.status === 200 && title.includes("Kisan");
        logResult("TC-EXP-03", "Full-Text Search ('Kisan')", passed, `Status: ${res.status}, Result: "${title}"`);
    } catch (e) {
        logResult("TC-EXP-03", "Search", false, e.message);
    }

    // TC-EXP-04: Quick Tab Filter (Policies Only)
    try {
        const res = await fetch(`${BASE_URL}/explore?tab=policies`);
        const data = await res.json();
        const docs = data.data?.documents || [];
        const passed = res.status === 200 && docs.length >= 1 && docs.some((s) => s.title.includes("Beti Bachao"));
        logResult("TC-EXP-04", "Quick Tab Filter (Policies)", passed, `Status: ${res.status}, Policies Found: ${docs.length}`);
    } catch (e) {
        logResult("TC-EXP-04", "Tab Filter", false, e.message);
    }

    // TC-EXP-05: State Jurisdiction Filter
    try {
        const res = await fetch(`${BASE_URL}/explore?state=Uttar Pradesh`);
        const data = await res.json();
        const docs = data.data?.documents || [];
        const passed = res.status === 200 && docs.length >= 1;
        logResult("TC-EXP-05", "State Filter (Uttar Pradesh)", passed, `Status: ${res.status}, Results: ${docs.length}`);
    } catch (e) {
        logResult("TC-EXP-05", "State Filter", false, e.message);
    }

    // TC-EXP-06: Gender Filter (Female)
    try {
        const res = await fetch(`${BASE_URL}/explore?gender=female`);
        const data = await res.json();
        const docs = data.data?.documents || [];
        const passed = res.status === 200 && docs.length >= 2;
        logResult("TC-EXP-06", "Gender Filter (Female)", passed, `Status: ${res.status}, Schemes Found: ${docs.length}`);
    } catch (e) {
        logResult("TC-EXP-06", "Gender Filter", false, e.message);
    }

    // TC-EXP-07: Pagination (Limit 2)
    try {
        const res = await fetch(`${BASE_URL}/explore?page=1&limit=2`);
        const data = await res.json();
        const docs = data.data?.documents || [];
        const passed = res.status === 200 && docs.length === 2 && data.data?.totalPages >= 3;
        logResult("TC-EXP-07", "Pagination (limit=2)", passed, `Status: ${res.status}, TotalPages: ${data.data?.totalPages}`);
    } catch (e) {
        logResult("TC-EXP-07", "Pagination", false, e.message);
    }

    // TC-EXP-08: Search with No Results (Honest Empty State)
    try {
        const res = await fetch(`${BASE_URL}/explore?search=nonexistentxyz123`);
        const data = await res.json();
        const docs = data.data?.documents || [];
        const passed = res.status === 200 && docs.length === 0;
        logResult("TC-EXP-08", "Search with No Results (Honest Empty)", passed, `Status: ${res.status}, Empty Array Returned: true`);
    } catch (e) {
        logResult("TC-EXP-08", "Empty Search", false, e.message);
    }

    // TC-EXP-09: Single Scheme Detail by ID
    const sampleDoc = await Document.findOne({ isActive: true });
    try {
        const res = await fetch(`${BASE_URL}/explore/${sampleDoc._id}`);
        const data = await res.json();
        const passed = res.status === 200 && data.data?.document?.title === sampleDoc.title;
        logResult("TC-EXP-09", "Single Scheme Details by ID", passed, `Status: ${res.status}, Title: "${data.data?.document?.title}"`);
    } catch (e) {
        logResult("TC-EXP-09", "Single Scheme Detail", false, e.message);
    }

    // ==========================================
    // SUITE 5: CARD 1 — ELIGIBILITY MATCHING
    // ==========================================
    console.log("\n📌 SUITE 5: CARD 1 — ELIGIBILITY MATCHING ENGINE");

    // TC-ELIG-01: Match All Schemes for Student Profile
    try {
        const res = await fetch(`${BASE_URL}/eligibility/match-all`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                age: 20,
                gender: "male",
                state: "Uttar Pradesh",
                occupation: "student",
            }),
        });
        const data = await res.json();
        const nspFound = data.data?.eligibleSchemes?.some((s) => s.title.includes("Scholarship"));
        const passed = res.status === 200 && nspFound;
        logResult("TC-ELIG-01", "Match All (Student Profile)", passed, `Status: ${res.status}, Eligible Count: ${data.data?.totalEligible}`);
    } catch (e) {
        logResult("TC-ELIG-01", "Match All (Student)", false, e.message);
    }

    // TC-ELIG-02: Match All Schemes for Farmer Profile
    try {
        const res = await fetch(`${BASE_URL}/eligibility/match-all`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                age: 42,
                gender: "male",
                state: "Madhya Pradesh",
                occupation: "farmer",
            }),
        });
        const data = await res.json();
        const kisanFound = data.data?.eligibleSchemes?.some((s) => s.title.includes("Kisan"));
        const passed = res.status === 200 && kisanFound;
        logResult("TC-ELIG-02", "Match All (Farmer Profile)", passed, `Status: ${res.status}, PM-Kisan Matched: ${kisanFound}`);
    } catch (e) {
        logResult("TC-ELIG-02", "Match All (Farmer)", false, e.message);
    }

    // TC-ELIG-03: Single Scheme Eligibility (Eligible Case)
    const nspDoc = await Document.findOne({ title: /Scholarship/ });
    try {
        const res = await fetch(`${BASE_URL}/eligibility/check/${nspDoc._id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                age: 20,
                occupation: "student",
                gender: "male",
                state: "Delhi",
            }),
        });
        const data = await res.json();
        const passed = res.status === 200 && data.data?.isEligible === true;
        logResult("TC-ELIG-03", "Single Scheme Check (Eligible Case)", passed, `Status: ${res.status}, IsEligible: ${data.data?.isEligible}`);
    } catch (e) {
        logResult("TC-ELIG-03", "Single Scheme (Eligible)", false, e.message);
    }

    // TC-ELIG-04: Single Scheme Ineligible Due to Age Limit
    try {
        const res = await fetch(`${BASE_URL}/eligibility/check/${nspDoc._id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                age: 30, // Exceeds maxAge 25
                occupation: "student",
                gender: "male",
            }),
        });
        const data = await res.json();
        const hasReason = data.data?.failedCriteria?.[0]?.includes("exceeds maximum");
        const passed = res.status === 200 && data.data?.isEligible === false && hasReason;
        logResult("TC-ELIG-04", "Age Over-Limit Explanation", passed, `Status: ${res.status}, Reason: "${data.data?.failedCriteria?.[0]}"`);
    } catch (e) {
        logResult("TC-ELIG-04", "Age Over-Limit", false, e.message);
    }

    // TC-ELIG-05: Single Scheme Ineligible Due to Gender Mismatch
    const bbbpDoc = await Document.findOne({ title: /Beti Bachao/ });
    try {
        const res = await fetch(`${BASE_URL}/eligibility/check/${bbbpDoc._id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                age: 16,
                gender: "male", // Scheme is female-only
            }),
        });
        const data = await res.json();
        const hasReason = data.data?.failedCriteria?.[0]?.includes("exclusively for female");
        const passed = res.status === 200 && data.data?.isEligible === false && hasReason;
        logResult("TC-ELIG-05", "Gender Mismatch Explanation", passed, `Status: ${res.status}, Reason: "${data.data?.failedCriteria?.[0]}"`);
    } catch (e) {
        logResult("TC-ELIG-05", "Gender Mismatch", false, e.message);
    }

    // ==========================================
    // SUITE 6: CARD 4 — STAY NOTIFIED
    // ==========================================
    console.log("\n📌 SUITE 6: CARD 4 — STAY NOTIFIED TIMELINE");

    // TC-NOTIF-01: Header Badge Count
    try {
        const res = await fetch(`${BASE_URL}/notifications/count`);
        const data = await res.json();
        const count = data.data?.newCount ?? data.data?.recentCount;
        const passed = res.status === 200 && typeof count === "number";
        logResult("TC-NOTIF-01", "Header Notification Badge Count", passed, `Status: ${res.status}, Recent 7-Day Count: ${count}`);
    } catch (e) {
        logResult("TC-NOTIF-01", "Notification Badge Count", false, e.message);
    }

    // TC-NOTIF-02: 7-Day Grouped Timeline Feed
    try {
        const res = await fetch(`${BASE_URL}/notifications`);
        const data = await res.json();
        const hasGroups = data.data?.grouped?.today !== undefined;
        const passed = res.status === 200 && hasGroups;
        logResult("TC-NOTIF-02", "Timeline Feed Grouped by Days", passed, `Status: ${res.status}, Today Count: ${data.data?.grouped?.today?.length}`);
    } catch (e) {
        logResult("TC-NOTIF-02", "Grouped Timeline Feed", false, e.message);
    }

    // Final Summary
    const total = results.length;
    const passedCount = results.filter((r) => r.passed).length;
    console.log("\n📊 ========================================================");
    console.log(`   TEST SUMMARY: ${passedCount} / ${total} TESTS PASSED (${Math.round((passedCount / total) * 100)}%)`);
    console.log("========================================================\n");

    process.exit(0);
};

runAll().catch((err) => {
    console.error("Runner crash:", err);
    process.exit(1);
});
