import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    PIB_REGIONAL_BUREAUS,
    GOV_SCHEME_NORMALIZATION_SCHEMA,
    NATIONAL_BASELINE_SCHEMES,
    computeContentHash,
} from "../src/services/governmentSync.service.js";

describe("Autonomous Government Scheme Synchronization Suite", () => {
    it("1. PIB regional bureau directory includes Central and key state bureaus", () => {
        assert.ok(PIB_REGIONAL_BUREAUS.length >= 20);

        const statesCovered = PIB_REGIONAL_BUREAUS.map((b) => b.state);
        assert.ok(statesCovered.includes("ALL"), "Missing central all-India bureau");
        assert.ok(statesCovered.includes("Maharashtra"), "Missing Maharashtra bureau");
        assert.ok(statesCovered.includes("Uttar Pradesh"), "Missing Uttar Pradesh bureau");
        assert.ok(statesCovered.includes("Karnataka"), "Missing Karnataka bureau");
        assert.ok(statesCovered.includes("Tamil Nadu"), "Missing Tamil Nadu bureau");
        assert.ok(statesCovered.includes("West Bengal"), "Missing West Bengal bureau");
        assert.ok(statesCovered.includes("Gujarat"), "Missing Gujarat bureau");
        assert.ok(statesCovered.includes("Bihar"), "Missing Bihar bureau");
        assert.ok(statesCovered.includes("Madhya Pradesh"), "Missing Madhya Pradesh bureau");
        assert.ok(statesCovered.includes("Rajasthan"), "Missing Rajasthan bureau");
        assert.ok(statesCovered.includes("Kerala"), "Missing Kerala bureau");

        // Verify valid RSS endpoints
        for (const bureau of PIB_REGIONAL_BUREAUS) {
            assert.ok(bureau.url.startsWith("https://www.pib.gov.in/RssMain.aspx?ModId=6"));
            assert.ok(bureau.code > 0);
        }
    });

    it("2. GOV_SCHEME_NORMALIZATION_SCHEMA enforces complete civic & demographic fields", () => {
        assert.equal(GOV_SCHEME_NORMALIZATION_SCHEMA.type, "OBJECT");
        const props = GOV_SCHEME_NORMALIZATION_SCHEMA.properties;

        assert.ok(props.isCivicPolicyOrWelfare);
        assert.ok(props.title);
        assert.ok(props.documentType);
        assert.ok(props.jurisdictionLevel);
        assert.ok(props.applicableState);
        assert.ok(props.issuingAuthority);
        assert.ok(props.summary);
        assert.ok(props.tags);
        assert.ok(props.eligibilityRules);

        const eligProps = props.eligibilityRules.properties;
        assert.ok(eligProps.minAge);
        assert.ok(eligProps.maxAge);
        assert.ok(eligProps.genders);
        assert.ok(eligProps.castes);
        assert.ok(eligProps.occupations);
        assert.ok(eligProps.maxAnnualIncome);
        assert.ok(eligProps.requiresRationCard);
        assert.ok(eligProps.requiresDisabilityStatus);
    });

    it("3. National baseline schemes cover targeted demographics and diverse Indian states", () => {
        assert.ok(NATIONAL_BASELINE_SCHEMES.length >= 12);

        // Check for Divyangjan (Specially Abled) schemes
        const divyangSchemes = NATIONAL_BASELINE_SCHEMES.filter(
            (s) => s.eligibilityRules?.requiresDisabilityStatus === true
        );
        assert.ok(divyangSchemes.length >= 2, "Must include Divyangjan schemes");

        // Check for Senior Citizens
        const seniorSchemes = NATIONAL_BASELINE_SCHEMES.filter(
            (s) => s.eligibilityRules?.minAge >= 60
        );
        assert.ok(seniorSchemes.length >= 1, "Must include Senior Citizen schemes");

        // Check for Women-exclusive schemes
        const womenSchemes = NATIONAL_BASELINE_SCHEMES.filter(
            (s) =>
                s.eligibilityRules?.genders?.length === 1 &&
                s.eligibilityRules.genders[0].toLowerCase() === "female"
        );
        assert.ok(womenSchemes.length >= 4, "Must include Women-specific schemes");

        // Check for Farmer-targeted schemes
        const farmerSchemes = NATIONAL_BASELINE_SCHEMES.filter(
            (s) => s.eligibilityRules?.occupations?.includes("farmer")
        );
        assert.ok(farmerSchemes.length >= 3, "Must include Farmer schemes");

        // Verify state diversity across India
        const statesRepresented = new Set(
            NATIONAL_BASELINE_SCHEMES.map((s) => s.applicableState)
        );
        assert.ok(statesRepresented.has("Madhya Pradesh"));
        assert.ok(statesRepresented.has("Rajasthan"));
        assert.ok(statesRepresented.has("West Bengal"));
        assert.ok(statesRepresented.has("Gujarat"));
        assert.ok(statesRepresented.has("Telangana"));
        assert.ok(statesRepresented.has("Andhra Pradesh"));
        assert.ok(statesRepresented.has("Kerala"));
        assert.ok(statesRepresented.has("Odisha"));
        assert.ok(statesRepresented.has("Haryana"));
        assert.ok(statesRepresented.has("Assam"));
    });

    it("4. computeContentHash produces deterministic SHA-256 strings", () => {
        const hash1 = computeContentHash("PM Kisan", "Annual financial support of 6000");
        const hash2 = computeContentHash("PM Kisan", "Annual financial support of 6000");
        const hash3 = computeContentHash("PM Kisan", "Different content");

        assert.equal(hash1, hash2);
        assert.notEqual(hash1, hash3);
        assert.equal(hash1.length, 64);
    });
});

