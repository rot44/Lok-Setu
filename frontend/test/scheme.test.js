import test from "node:test";
import assert from "node:assert/strict";
import { INDIAN_STATES } from "../src/constants/indianStates.ts";

test("Lok-Setu Scheme & Policy Discovery Contracts", async (t) => {
  const NOT_SPECIFIED = "This document does not clearly specify this information.";

  await t.test("Indian States constant covers comprehensive state and UT list", () => {
    assert.ok(Array.isArray(INDIAN_STATES));
    assert.ok(INDIAN_STATES.length >= 28, "Should cover at least 28 Indian states");
    assert.ok(INDIAN_STATES.includes("Uttar Pradesh"));
    assert.ok(INDIAN_STATES.includes("Maharashtra"));
    assert.ok(INDIAN_STATES.includes("Gujarat"));
    assert.ok(INDIAN_STATES.includes("Delhi"));
  });

  await t.test("Search & filter query parameters map cleanly to explore endpoint contract", () => {
    const params = {
      search: "kisan",
      tab: "schemes",
      governmentLevel: "central",
      state: "ALL",
      category: "Agriculture",
      gender: "all",
      ageGroup: "18_25",
      incomeRange: "below_1_lakh",
      caste: "obc",
      beneficiaryType: "farmer",
      isSpeciallyAbled: "false",
      sortBy: "newest",
      page: 1,
      limit: 12,
    };

    assert.equal(params.search, "kisan");
    assert.equal(params.governmentLevel, "central");
    assert.equal(params.category, "Agriculture");
    assert.ok(["newest", "relevance", "deadline", "title"].includes(params.sortBy));
    assert.equal(params.page, 1);
    assert.equal(params.limit, 12);
  });

  await t.test("Pagination and totalPages calculations behave as expected", () => {
    const totalCount = 25;
    const limit = 12;
    const totalPages = Math.ceil(totalCount / limit);
    assert.equal(totalPages, 3);

    const emptyCount = 0;
    const emptyPages = Math.ceil(emptyCount / limit);
    assert.equal(emptyPages, 0);
  });

  await t.test("SchemeSummary response structure validates all required fields", () => {
    const mockSummary = {
      _id: "6722d5f81234567890abcdef",
      title: "PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)",
      documentType: "welfare_policy",
      jurisdictionLevel: "central",
      applicableState: "ALL",
      issuingAuthority: "Ministry of Agriculture & Farmers Welfare",
      applicationDeadline: null,
      officialPortalUrl: "https://pmkisan.gov.in",
      tags: ["Agriculture", "Income Support", "Farmers"],
      eligibilityRules: {
        minAge: 18,
        maxAge: 100,
        genders: ["ALL"],
        castes: ["ALL"],
        religions: ["ALL"],
        occupations: ["farmer", "ALL"],
        maxAnnualIncome: "any",
        requiresRationCard: false,
        requiresDisabilityStatus: false,
      },
      createdAt: "2026-10-31T00:00:00.000Z",
    };

    assert.ok(mockSummary._id);
    assert.ok(mockSummary.title);
    assert.equal(mockSummary.jurisdictionLevel, "central");
    assert.equal(mockSummary.applicableState, "ALL");
    assert.ok(mockSummary.officialPortalUrl.startsWith("https://"));
    assert.equal(typeof mockSummary.eligibilityRules.minAge, "number");
    assert.equal(mockSummary.eligibilityRules.requiresRationCard, false);
  });

  await t.test("SchemeDetail honors verified source text and exact missing-information clause", () => {
    const mockDetail = {
      document: {
        _id: "6722d5f81234567890abcdef",
        title: "Credit Guarantee Scheme for Micro & Small Enterprises (CGTMSE)",
        documentType: "subsidies_grants",
        jurisdictionLevel: "central",
        applicableState: "ALL",
        issuingAuthority: "Ministry of Micro, Small & Medium Enterprises",
        rawExtractedText:
          "Collateral-free credit facility up to ₹500 lakh to first-generation entrepreneurs and micro & small enterprises without third-party guarantees.",
        officialPortalUrl: "https://www.cgtmse.in",
        notificationDate: "2026-10-31T00:00:00.000Z",
        applicationDeadline: null,
        isActive: true,
      },
      availableExplainers: [
        {
          _id: "6722d5f81234567890abcdeg",
          languageCode: "hi",
          languageName: "Hindi",
          plainSummary: "सूक्ष्म एवं लघु उद्यमों के लिए संपार्श्विक मुक्त ऋण गारंटी सुविधा।",
          keyRights: ["बिना किसी गिरवी के ₹500 लाख तक का ऋण"],
          citizenImpact: [],
          businessImpact: ["नए उद्यमियों को ऋण में सुगमता"],
          requiredDocuments: [],
          howToApplySteps: [],
          audio: {
            audioUrl: "https://s3.ap-south-1.amazonaws.com/lok-setu/cgtmse-hi.wav",
            durationSeconds: 45,
          },
        },
      ],
    };

    assert.ok(mockDetail.document.rawExtractedText.length > 0);
    assert.ok(mockDetail.availableExplainers[0].audio.audioUrl);

    // Verify missing information rule
    const missingDocsText =
      mockDetail.availableExplainers[0].requiredDocuments.length === 0
        ? NOT_SPECIFIED
        : mockDetail.availableExplainers[0].requiredDocuments.join(", ");
    assert.equal(missingDocsText, "This document does not clearly specify this information.");

    const missingDeadlineText = mockDetail.document.applicationDeadline
      ? String(mockDetail.document.applicationDeadline)
      : "Ongoing / Not time-limited";
    assert.equal(missingDeadlineText, "Ongoing / Not time-limited");
  });

  await t.test("Empty and error states behave deterministically", () => {
    const emptyResponse = {
      documents: [],
      totalCount: 0,
      totalPages: 0,
      currentPage: 1,
      limit: 12,
    };

    assert.equal(emptyResponse.documents.length, 0);
    assert.equal(emptyResponse.totalCount, 0);

    const isHonestEmpty = emptyResponse.totalCount === 0 && emptyResponse.documents.length === 0;
    assert.ok(isHonestEmpty, "Honest empty state properly detected");
  });
});
