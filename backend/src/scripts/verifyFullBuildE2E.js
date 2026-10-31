import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../db/index.js";
import app from "../app.js";
import { Document } from "../models/document.model.js";
import { noticeAnalysisService } from "../services/noticeAnalysis.service.js";
import { parsePibRssXml } from "../services/pibWatcher.service.js";
import { SarvamService, toSarvamBcp47 } from "../services/sarvam.service.js";

const results = [];

const logResult = (id, name, passed, details = "") => {
    results.push({ id, name, passed, details });
    const mark = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${mark} [${id}] ${name} ${details ? "→ " + details : ""}`);
};

async function runE2EVerification() {
    console.log("\n🇮🇳 ========================================================");
    console.log("   LOK SETU FULL BUILD & END-TO-END VERIFICATION RUNNER");
    console.log("========================================================\n");

    await connectDB();

    // Start ephemeral server
    const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}/api/v1`;

    try {
        // ─── SUITE 1: System Health Check ───────────────────────────────────────
        try {
            const res = await fetch(`http://127.0.0.1:${port}/health`);
            const data = await res.json();
            logResult(
                "E2E-01",
                "System Health & Security Middlewares",
                res.status === 200 && data.success === true,
                `Status: ${res.status}, Message: "${data.message}"`
            );
        } catch (e) {
            logResult("E2E-01", "System Health Check", false, e.message);
        }

        // ─── SUITE 2: Multi-Tier Live Notifications ─────────────────────────────
        try {
            const res = await fetch(`${baseUrl}/notifications?days=7&limit=100`);
            const data = await res.json();
            const total = data.data?.totalCount || 0;
            const hasCentral = data.data?.notifications?.some(
                (n) => n.jurisdictionLevel === "central"
            );
            const hasState = data.data?.notifications?.some(
                (n) => n.jurisdictionLevel === "state"
            );
            const hasMunicipal = data.data?.notifications?.some(
                (n) => n.jurisdictionLevel === "municipal"
            );

            logResult(
                "E2E-02",
                "7-Day Notifications Feed (Central + State + Municipal)",
                total >= 10 && hasCentral && hasState && hasMunicipal,
                `Found ${total} notifications across all 3 tiers`
            );
        } catch (e) {
            logResult("E2E-02", "7-Day Notifications Feed", false, e.message);
        }

        // ─── SUITE 3: Scheme Exploration Directory ──────────────────────────────
        let sampleSchemeId = null;
        try {
            const res = await fetch(`${baseUrl}/explore?page=1&limit=20`);
            const data = await res.json();
            const documents = data.data?.documents || [];
            if (documents.length > 0) sampleSchemeId = documents[0]._id;

            logResult(
                "E2E-03",
                "Scheme Exploration & Discovery Directory",
                res.status === 200 && documents.length >= 10,
                `Loaded ${documents.length} schemes with pagination`
            );
        } catch (e) {
            logResult("E2E-03", "Scheme Exploration Directory", false, e.message);
        }

        // ─── SUITE 4: State & Municipal Jurisdiction Filter ─────────────────────
        try {
            const resState = await fetch(`${baseUrl}/explore?state=Maharashtra`);
            const dataState = await resState.json();
            const stateDocs = dataState.data?.documents || [];

            const resMuni = await fetch(`${baseUrl}/explore?governmentLevel=municipal`);
            const dataMuni = await resMuni.json();
            const muniDocs = dataMuni.data?.documents || [];

            logResult(
                "E2E-04",
                "Jurisdiction & State Filter Mapping",
                stateDocs.length > 0 && muniDocs.length > 0,
                `Maharashtra filter: ${stateDocs.length} schemes, Municipal filter: ${muniDocs.length} circulars`
            );
        } catch (e) {
            logResult("E2E-04", "Jurisdiction Filter Mapping", false, e.message);
        }

        // ─── SUITE 5: Scheme Detail & Statutory Attribution ────────────────────
        try {
            if (!sampleSchemeId) throw new Error("No sample scheme ID available.");
            const res = await fetch(`${baseUrl}/explore/${sampleSchemeId}`);
            const data = await res.json();
            const s = data.data?.document;

            logResult(
                "E2E-05",
                "Scheme Detail & Statutory Attribution",
                res.status === 200 && s?.title && s?.issuingAuthority,
                `Verified "${s?.title}" by [${s?.issuingAuthority}]`
            );
        } catch (e) {
            logResult("E2E-05", "Scheme Detail & Attribution", false, e.message);
        }

        // ─── SUITE 6: Scheme Eligibility Evaluation Engine ──────────────────────
        try {
            const res = await fetch(`${baseUrl}/eligibility/match-all`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    state: "Uttar Pradesh",
                    age: 32,
                    gender: "male",
                    occupation: "farmer",
                }),
            });
            const data = await res.json();
            const totalEligible = data.data?.totalEligible || 0;
            const hasPmKisan = data.data?.eligibleSchemes?.some((s) =>
                s.title.includes("PM-KISAN")
            );

            logResult(
                "E2E-06",
                "Demographic Eligibility Matcher (match-all)",
                res.status === 200 && totalEligible >= 2 && hasPmKisan,
                `Matched ${totalEligible} schemes (PM-KISAN included)`
            );
        } catch (e) {
            logResult("E2E-06", "Demographic Eligibility Matcher", false, e.message);
        }

        // ─── SUITE 7: Conversational Civic Assistant (Hybrid RAG) ───────────────
        try {
            const res = await fetch(`${baseUrl}/assistant/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: "What is PM Kisan and how much money is given to farmers?",
                    language: "en",
                }),
            });
            const data = await res.json();
            const text = data.data?.message?.text || "";
            const citations = data.data?.message?.analysis?.citations || [];

            logResult(
                "E2E-07",
                "Civic Assistant Grounded RAG & Citations",
                res.status === 200 && text.length > 50 && citations.length > 0,
                `Generated ${text.length} chars grounded response with ${citations.length} verified citation(s)`
            );
        } catch (e) {
            logResult("E2E-07", "Civic Assistant RAG", false, e.message);
        }

        // ─── SUITE 8: PIB Real-Time Ingestion Engine ────────────────────────────
        try {
            const sampleXml = `<?xml version="1.0" encoding="utf-8"?><rss version="2.0"><channel><item><title>Test Policy Announcement</title><link>https://pib.gov.in/PressReleaseIframePage.aspx?PRID=999888</link></item></channel></rss>`;
            const parsed = parsePibRssXml(sampleXml);

            logResult(
                "E2E-08",
                "PIB Real-Time RSS Parser & PRID Extraction",
                parsed.length === 1 && parsed[0].prid === "999888",
                `Extracted PRID ${parsed[0]?.prid} cleanly`
            );
        } catch (e) {
            logResult("E2E-08", "PIB RSS Parser", false, e.message);
        }

        // ─── SUITE 9: Notice Document Analysis Engine ───────────────────────────
        try {
            const sampleNotice = `MUNICIPAL ORDER 45/2026: All commercial shops in Zone 4 must segregate wet and dry waste before 15 November 2026. Penalty for non-compliance is Rs 1,000 per day. Appeal can be made within 15 days to the Deputy Commissioner.`;
            const analysis = await noticeAnalysisService.analyzeNoticeDocument({
                doc: { fileType: "text", originalName: "MunicipalOrder.txt" },
                buffer: Buffer.from(sampleNotice),
                language: "en",
            });

            const hasDeadlines = analysis?.analysis?.datesAndDeadlines?.length > 0;
            const hasPenalties = analysis?.analysis?.penalties?.length > 0;
            const hasRights = analysis?.analysis?.keyRights?.length > 0;

            logResult(
                "E2E-09",
                "Notice Analyzer Grounded Rights Extraction",
                hasDeadlines && hasPenalties && hasRights,
                `Extracted: ${analysis?.analysis?.datesAndDeadlines?.[0]?.slice(0, 40)}...`
            );
        } catch (e) {
            logResult("E2E-09", "Notice Analyzer", false, e.message);
        }

        // ─── SUITE 10: Sarvam Multilingual Voice Pipeline ───────────────────────
        try {
            const hindiBcp47 = toSarvamBcp47("hi");
            const gujaratiBcp47 = toSarvamBcp47("gu");
            const service = new SarvamService();

            logResult(
                "E2E-10",
                "Sarvam Indic Voice & Language Configuration",
                hindiBcp47 === "hi-IN" && gujaratiBcp47 === "gu-IN" && !!service.apiKey,
                `Mapped BCP-47 tags (Hindi: ${hindiBcp47}, Gujarati: ${gujaratiBcp47}) with active API key`
            );
        } catch (e) {
            logResult("E2E-10", "Sarvam Multilingual Pipeline", false, e.message);
        }

    } finally {
        server.close();
        await mongoose.disconnect();
    }

    // Summary Scorecard
    const passed = results.filter((r) => r.passed).length;
    const total = results.length;
    console.log("\n========================================================");
    console.log(`📊 FINAL E2E SCORECARD: ${passed}/${total} SUITES PASSED (${Math.round((passed / total) * 100)}%)`);
    console.log("========================================================\n");

    if (passed === total) {
        console.log("🎉 ALL END-TO-END VERIFICATION SUITES PASSED FLAWLESSLY!\n");
        process.exit(0);
    } else {
        console.error("❌ Some verification suites failed.");
        process.exit(1);
    }
}

runE2EVerification();
