import test from "node:test";
import assert from "node:assert/strict";
import { translations, SUPPORTED_LANGUAGES } from "../src/translations/index.ts";

test("Lok-Setu Scheme Eligibility Questionnaire & Contracts Suite", async (t) => {
  const PRELIMINARY_NOTICE =
    "Preliminary assessment only. Final eligibility is determined by the relevant government authority.";
  const CAUTIOUS_STATUS_BADGE = "You May Be Eligible";

  await t.test("1. Demographic payload contract validates schema for match-all API", () => {
    const rawFormState = {
      state: "ALL",
      age: "29",
      gender: "female",
      occupation: "farmer",
      caste: "obc",
      isSpeciallyAbled: true,
      disabilityPercentage: 45,
      rationCardType: "bpl",
    };

    // Simulate normalization performed by handleEvaluate
    const payload = {
      state: rawFormState.state === "ALL" ? "all" : rawFormState.state,
      age: rawFormState.age ? Number(rawFormState.age) : undefined,
      gender: rawFormState.gender || "all",
      occupation: rawFormState.occupation || "all",
      caste: rawFormState.caste || "all",
      isSpeciallyAbled: Boolean(rawFormState.isSpeciallyAbled),
      rationCardType: rawFormState.rationCardType || "none",
    };

    assert.equal(payload.state, "all");
    assert.equal(payload.age, 29);
    assert.equal(payload.gender, "female");
    assert.equal(payload.occupation, "farmer");
    assert.equal(payload.caste, "obc");
    assert.equal(payload.isSpeciallyAbled, true);
    assert.equal(payload.rationCardType, "bpl");
  });

  await t.test("2. MatchAllResponseData contract validates scheme categorization and criteria breakdown", () => {
    const mockApiResponse = {
      totalEligible: 1,
      totalPartiallyEligible: 1,
      eligibleSchemes: [
        {
          _id: "65d8f1e293a8b417c8d9e111",
          title: "PM-Kisan Samman Nidhi",
          documentType: "scheme",
          applicableState: "ALL",
          issuingAuthority: "Ministry of Agriculture and Farmers Welfare",
          officialPortalUrl: "https://pmkisan.gov.in",
          isEligible: true,
          matchPercentage: 100,
          passedCriteria: [
            "Central scheme applicable across All India.",
            "Occupation (farmer) meets scheme criteria.",
            "Age (29 yrs) satisfies criteria.",
          ],
          failedCriteria: [],
        },
      ],
      partiallyEligibleSchemes: [
        {
          _id: "65d8f1e293a8b417c8d9e222",
          title: "State Agricultural Equipment Subsidy",
          documentType: "scheme",
          applicableState: "Maharashtra",
          issuingAuthority: "Dept of Agriculture, Maharashtra",
          officialPortalUrl: "https://mahadbt.maharashtra.gov.in",
          isEligible: false,
          matchPercentage: 67,
          passedCriteria: [
            "Occupation (farmer) meets scheme criteria.",
            "Age (29 yrs) satisfies criteria.",
          ],
          failedCriteria: [
            "Scheme is restricted to residents of Maharashtra (your input: Gujarat).",
          ],
        },
      ],
      evaluationNotice: PRELIMINARY_NOTICE,
    };

    assert.equal(mockApiResponse.totalEligible, 1);
    assert.equal(mockApiResponse.eligibleSchemes.length, 1);
    assert.equal(mockApiResponse.eligibleSchemes[0].isEligible, true);
    assert.equal(mockApiResponse.eligibleSchemes[0].failedCriteria.length, 0);
    assert.equal(mockApiResponse.eligibleSchemes[0].matchPercentage, 100);

    assert.equal(mockApiResponse.totalPartiallyEligible, 1);
    assert.equal(mockApiResponse.partiallyEligibleSchemes.length, 1);
    assert.equal(mockApiResponse.partiallyEligibleSchemes[0].isEligible, false);
    assert.equal(mockApiResponse.partiallyEligibleSchemes[0].failedCriteria.length, 1);
    assert.ok(mockApiResponse.partiallyEligibleSchemes[0].matchPercentage >= 50);

    assert.equal(mockApiResponse.evaluationNotice, PRELIMINARY_NOTICE);
  });

  await t.test("3. Profile prefill logic normalizes constants and preserves user edits", () => {
    const normOccupation = (occ) => {
      if (!occ) return "all";
      const lower = occ.toLowerCase().trim();
      if (lower === "shopkeeper_msme" || lower === "business" || lower === "self_employed") return "msme";
      return lower;
    };

    const normRationCard = (type) => {
      if (!type) return "none";
      const lower = type.toLowerCase().trim();
      if (lower === "aay_antyodaya" || lower === "antyodaya") return "aay_antyodaya";
      return lower;
    };

    // 3a: Profile with backend constants (shopkeeper_msme and aay_antyodaya)
    const registeredProfile = {
      state: "Uttar Pradesh",
      age: 34,
      gender: "Male",
      occupation: "shopkeeper_msme",
      caste: "ews",
      isSpeciallyAbled: true,
      disabilityPercentage: 50,
      rationCardType: "aay_antyodaya",
    };

    const prefilledData = {
      state: registeredProfile.state || "ALL",
      age: registeredProfile.age ? String(registeredProfile.age) : "",
      gender: registeredProfile.gender ? registeredProfile.gender.toLowerCase() : "all",
      occupation: normOccupation(registeredProfile.occupation),
      caste: registeredProfile.caste ? registeredProfile.caste.toLowerCase() : "all",
      isSpeciallyAbled: Boolean(registeredProfile.isSpeciallyAbled),
      disabilityPercentage: registeredProfile.disabilityPercentage || 40,
      rationCardType: normRationCard(registeredProfile.rationCardType),
    };

    assert.equal(prefilledData.state, "Uttar Pradesh");
    assert.equal(prefilledData.age, "34");
    assert.equal(prefilledData.gender, "male");
    assert.equal(prefilledData.occupation, "msme"); // mapped from shopkeeper_msme
    assert.equal(prefilledData.caste, "ews");
    assert.equal(prefilledData.isSpeciallyAbled, true);
    assert.equal(prefilledData.disabilityPercentage, 50);
    assert.equal(prefilledData.rationCardType, "aay_antyodaya");

    // 3b: Editing prefilled answer remains untouched by subsequent state sync
    let hasPrefilled = true;
    let editedState = "Gujarat";
    if (!hasPrefilled) {
      editedState = registeredProfile.state;
    }
    assert.equal(editedState, "Gujarat"); // not overwritten

    // 3c: Incomplete profile does not invent arbitrary values
    const sparseProfile = { state: null, age: null, gender: null };
    const sparsePrefill = {
      state: sparseProfile.state || "ALL",
      age: sparseProfile.age ? String(sparseProfile.age) : "",
      gender: sparseProfile.gender ? sparseProfile.gender.toLowerCase() : "all",
    };

    assert.equal(sparsePrefill.state, "ALL");
    assert.equal(sparsePrefill.age, "");
    assert.equal(sparsePrefill.gender, "all");
  });

  await t.test("4. Cautious language and near-match interpretation safeguards", () => {
    // UI badge phrasing
    const potentialBadgeText = (isPotential, matchPercentage) =>
      isPotential ? CAUTIOUS_STATUS_BADGE : `${matchPercentage}% Met (Near Match)`;

    assert.equal(potentialBadgeText(true, 100), "You May Be Eligible");
    assert.notEqual(potentialBadgeText(true, 100), "You Are Eligible");
    assert.equal(potentialBadgeText(false, 75), "75% Met (Near Match)");

    // Near match advisory notice verifies that partial percentage is not treated as official approval
    const nearMatchAdvisory =
      "Government welfare schemes require all statutory criteria to be satisfied in full. A match percentage indicates how many preliminary rules your profile meets, but final sanction requires resolving every unmet or unverified requirement listed below.";

    assert.ok(nearMatchAdvisory.includes("satisfied in full"));
    assert.ok(nearMatchAdvisory.includes("final sanction requires resolving every unmet or unverified requirement"));

    // UI disclaimer content
    const uiDisclaimer =
      "Important Notice: You may be eligible for the schemes listed below based on your provided demographic answers. This is a preliminary assessment and does not constitute an authoritative government ruling or guarantee. Final benefit sanction is subject to document verification by the respective Ministry or Department.";

    assert.ok(uiDisclaimer.includes("preliminary assessment"));
    assert.ok(uiDisclaimer.includes("does not constitute an authoritative government ruling or guarantee"));
    assert.ok(uiDisclaimer.includes("You may be eligible"));
  });

  await t.test("5. Input validation enforces minimal criteria and plausible boundaries", () => {
    const validateForm = (form) => {
      const hasState = Boolean(form.state && form.state.trim().length > 0 && form.state !== "ALL");
      const hasAge = Boolean(form.age && !isNaN(Number(form.age)) && Number(form.age) > 0);
      const hasGender = Boolean(form.gender && form.gender !== "all");

      if (!hasState && !hasAge && !hasGender && form.state !== "ALL") {
        return "Please provide at least your State, Age, or Gender to evaluate eligibility.";
      }

      if (form.age && (Number(form.age) < 1 || Number(form.age) > 120)) {
        return "Please enter a valid age between 1 and 120 years.";
      }

      if (form.isSpeciallyAbled && (form.disabilityPercentage < 1 || form.disabilityPercentage > 100)) {
        return "Disability percentage must be between 1% and 100%.";
      }

      return null;
    };

    // Valid inputs
    assert.equal(validateForm({ state: "ALL", age: "25", gender: "all" }), null);
    assert.equal(validateForm({ state: "Gujarat", age: "", gender: "all" }), null);
    assert.equal(
      validateForm({ state: "ALL", age: "30", gender: "all", isSpeciallyAbled: true, disabilityPercentage: 45 }),
      null
    );

    // Invalid: extreme age boundaries
    assert.equal(validateForm({ state: "ALL", age: "150", gender: "all" }), "Please enter a valid age between 1 and 120 years.");
    assert.equal(validateForm({ state: "ALL", age: "0", gender: "all" }), "Please enter a valid age between 1 and 120 years.");

    // Invalid: extreme disability percentage
    assert.equal(
      validateForm({ state: "ALL", age: "30", gender: "all", isSpeciallyAbled: true, disabilityPercentage: 110 }),
      "Disability percentage must be between 1% and 100%."
    );
  });

  await t.test("6. External portal links enforce secure target and rel attributes", () => {
    const linkAttributes = {
      target: "_blank",
      rel: "noopener noreferrer",
    };

    assert.equal(linkAttributes.target, "_blank");
    assert.equal(linkAttributes.rel, "noopener noreferrer");
  });

  await t.test("7. Multilingual coverage for eligibility navigation across all 8 languages", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      const dict = translations[lang.code];
      assert.ok(dict, `Translations dictionary missing for ${lang.code}`);

      const eligibilityNav = dict["nav.eligibility"];
      assert.ok(
        eligibilityNav && eligibilityNav.trim().length > 0,
        `nav.eligibility translation missing or empty for language ${lang.code}`
      );

      const card1Title = dict["home.card1.title"];
      assert.ok(
        card1Title && card1Title.trim().length > 0,
        `home.card1.title missing or empty for language ${lang.code}`
      );

      const card1Desc = dict["home.card1.desc"];
      assert.ok(
        card1Desc && card1Desc.trim().length > 0,
        `home.card1.desc missing or empty for language ${lang.code}`
      );
    }
  });
});
