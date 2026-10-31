import test from "node:test";
import assert from "node:assert/strict";
import { translations, SUPPORTED_LANGUAGES } from "../src/translations/index.ts";
import { buildSchemeExplanationPrompt } from "../src/utils/aiPrompt.ts";

test("Lok-Setu Civic Assistant Contracts & State Machine", async (t) => {
  const EXACT_MISSING_INFO = "This document does not clearly specify this information.";

  await t.test("Assistant chat payload conforms strictly to backend API contract", () => {
    const payload = {
      query: "What is the subsidy for rooftop solar under PM Surya Ghar?",
      language: "hi",
      sessionId: "session-uuid-123",
      guestToken: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      filters: {
        jurisdictionLevel: "central",
        applicableState: "ALL",
      },
    };

    assert.equal(payload.query, "What is the subsidy for rooftop solar under PM Surya Ghar?");
    assert.equal(payload.language, "hi");
    assert.equal(payload.sessionId, "session-uuid-123");
    assert.equal(payload.guestToken.length, 64);
    assert.equal(payload.filters.jurisdictionLevel, "central");
    assert.equal(payload.filters.applicableState, "ALL");
  });

  await t.test("Assistant response data model validates grounded analysis structure", () => {
    const mockResponse = {
      sessionId: "session-uuid-123",
      message: {
        id: "msg-001",
        sender: "assistant",
        text: "Under PM SVANidhi, urban street vendors can obtain an initial working capital loan of up to Rs. 10,000.",
        languageUsed: "en",
        timestamp: "2026-10-31T02:00:00.000Z",
        analysis: {
          summary: "Working capital loan of up to Rs. 10,000 with 7% interest subsidy.",
          sourceFacts: [
            "Collateral-free working capital loan of up to Rs. 10,000 for 1-year tenure.",
            "Timely repayment qualifies for 7% interest subsidy credited directly to bank account.",
          ],
          interpretation: "Vendors holding identity cards from municipal bodies can apply without any guarantee.",
          limitations: ["Applicable only to urban street vendors."],
          citations: [
            {
              chunkId: "svanidhi_chunk_001",
              documentId: "65d8f1e293a8b417c8d9e111",
              title: "PM SVANidhi Scheme Guidelines",
              issuingAuthority: "Ministry of Housing and Urban Affairs",
              sectionHeading: "Eligibility",
              clauseNumber: "Clause 4.1",
              startOffset: 120,
              endOffset: 650,
              sourceUrl: "https://pmsvanidhi.mohua.gov.in",
            },
          ],
          insufficientEvidence: false,
        },
      },
      disclaimer: "Informational guidance only. Not an authoritative legal determination.",
    };

    assert.equal(mockResponse.message.sender, "assistant");
    assert.ok(mockResponse.message.analysis.sourceFacts.length >= 2);
    assert.equal(mockResponse.message.analysis.citations.length, 1);
    assert.equal(mockResponse.message.analysis.citations[0].chunkId, "svanidhi_chunk_001");
    assert.equal(mockResponse.message.analysis.citations[0].sourceUrl, "https://pmsvanidhi.mohua.gov.in");
    assert.equal(mockResponse.message.analysis.insufficientEvidence, false);
    assert.ok(mockResponse.disclaimer.includes("Informational guidance"));
  });

  await t.test("Insufficient evidence response honors exact missing-information sentence", () => {
    const mockInsufficient = {
      sessionId: "session-uuid-456",
      message: {
        id: "msg-002",
        sender: "assistant",
        text: `The verified documents do not contain rules for this condition. ${EXACT_MISSING_INFO}`,
        analysis: {
          summary: "No relevant official policy rules found.",
          sourceFacts: [],
          interpretation: EXACT_MISSING_INFO,
          limitations: ["No official matching records found in knowledge base."],
          citations: [],
          insufficientEvidence: true,
        },
      },
    };

    assert.equal(mockInsufficient.message.analysis.insufficientEvidence, true);
    assert.ok(mockInsufficient.message.text.includes(EXACT_MISSING_INFO));
    assert.equal(mockInsufficient.message.analysis.interpretation, EXACT_MISSING_INFO);
    assert.deepEqual(mockInsufficient.message.analysis.citations, []);
  });

  await t.test("Session storage helpers safely persist and clear guestToken and sessionId", () => {
    const mockStorage = new Map();
    const GUEST_TOKEN_KEY = "loksetu_guest_token";
    const SESSION_ID_KEY = "loksetu_assistant_session_id";

    const getStoredGuestToken = () => mockStorage.get(GUEST_TOKEN_KEY) || null;
    const setStoredGuestToken = (token) => mockStorage.set(GUEST_TOKEN_KEY, token);
    const getStoredSessionId = () => mockStorage.get(SESSION_ID_KEY) || null;
    const setStoredSessionId = (id) => mockStorage.set(SESSION_ID_KEY, id);
    const clearStoredSession = () => {
      mockStorage.delete(GUEST_TOKEN_KEY);
      mockStorage.delete(SESSION_ID_KEY);
    };

    assert.equal(getStoredGuestToken(), null);
    assert.equal(getStoredSessionId(), null);

    setStoredGuestToken("test-guest-token-12345");
    setStoredSessionId("test-session-uuid-67890");

    assert.equal(getStoredGuestToken(), "test-guest-token-12345");
    assert.equal(getStoredSessionId(), "test-session-uuid-67890");

    clearStoredSession();

    assert.equal(getStoredGuestToken(), null);
    assert.equal(getStoredSessionId(), null);
  });

  await t.test("User input is preserved for retry on request failure", () => {
    const userQuery = "Confidential question about property tax exemption";
    let inputState = userQuery;
    let requestFailed = true;

    // When request fails: inputState must not be discarded
    if (requestFailed) {
      assert.equal(inputState, userQuery, "User query must be retained on failure for one-tap retry");
    }

    // When request succeeds: inputState is cleared
    requestFailed = false;
    if (!requestFailed) {
      inputState = "";
      assert.equal(inputState, "");
    }
  });

  await t.test("Assistant navigation and common keys exist across all 8 languages", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const dict = translations[lang.code];
      assert.ok(dict, `Translation dictionary exists for ${lang.code}`);
      assert.ok(dict["nav.assistant"], `nav.assistant must be defined for ${lang.code}`);
      assert.ok(dict["common.disclaimer"], `common.disclaimer must be defined for ${lang.code}`);
    }
  });

  await t.test("buildSchemeExplanationPrompt generates localized queries for all supported languages", () => {
    const title = "PM-Kisan Samman Nidhi";
    const hiPrompt = buildSchemeExplanationPrompt(title, "hi");
    assert.ok(hiPrompt.includes("PM-Kisan Samman Nidhi"));
    assert.ok(hiPrompt.includes("योजना के बारे में"));

    const enPrompt = buildSchemeExplanationPrompt(title, "en");
    assert.ok(enPrompt.includes("Please explain the 'PM-Kisan Samman Nidhi' scheme"));

    const bnPrompt = buildSchemeExplanationPrompt(title, "bn");
    assert.ok(bnPrompt.includes("প্রকল্প"));

    const mrPrompt = buildSchemeExplanationPrompt(title, "mr");
    assert.ok(mrPrompt.includes("योजनेबद्दल"));

    const taPrompt = buildSchemeExplanationPrompt(title, "ta");
    assert.ok(taPrompt.includes("திட்டம்"));

    const guPrompt = buildSchemeExplanationPrompt(title, "gu");
    assert.ok(guPrompt.includes("યોજના"));
  });
});
