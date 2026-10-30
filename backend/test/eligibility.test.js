import assert from "node:assert";
import test from "node:test";
import mongoose from "mongoose";
import {
    evaluateEligibility,
    checkSingleSchemeEligibility,
    matchAllEligibleSchemes,
} from "../src/controllers/eligibility.controller.js";
import { Document } from "../src/models/document.model.js";
import { ApiError } from "../src/utils/apiError.js";

test("Eligibility Evaluation Engine Suite", async (t) => {
    await t.test("1. Age rule evaluation and missing answer protection", () => {
        const scheme = {
            applicableState: "ALL",
            eligibilityRules: { minAge: 18, maxAge: 60 },
        };

        // Within range
        const resValid = evaluateEligibility({ age: 25, state: "ALL" }, scheme);
        assert.equal(resValid.isEligible, true);
        assert.ok(resValid.passedCriteria.some((c) => c.includes("Age (25 yrs) satisfies criteria")));

        // Under min age
        const resUnder = evaluateEligibility({ age: 16, state: "ALL" }, scheme);
        assert.equal(resUnder.isEligible, false);
        assert.ok(resUnder.failedCriteria.some((c) => c.includes("below minimum required age of 18")));

        // Over max age
        const resOver = evaluateEligibility({ age: 65, state: "ALL" }, scheme);
        assert.equal(resOver.isEligible, false);
        assert.ok(resOver.failedCriteria.some((c) => c.includes("exceeds maximum eligible age of 60")));

        // Missing age on age-restricted scheme must fail rather than silently qualify
        const resMissingAge = evaluateEligibility({ state: "ALL" }, scheme);
        assert.equal(resMissingAge.isEligible, false);
        assert.ok(resMissingAge.failedCriteria.some((c) => c.includes("age not provided in questionnaire")));
    });

    await t.test("2. Gender rule evaluation and restriction semantics", () => {
        const schemeFemaleOnly = {
            applicableState: "ALL",
            eligibilityRules: { genders: ["female"] },
        };

        // Matches female (case-insensitive)
        const resFemale = evaluateEligibility({ gender: "Female", state: "ALL" }, schemeFemaleOnly);
        assert.equal(resFemale.isEligible, true);
        assert.ok(resFemale.passedCriteria.some((c) => c.includes("Gender (Female) matches")));

        // Fails male
        const resMale = evaluateEligibility({ gender: "male", state: "ALL" }, schemeFemaleOnly);
        assert.equal(resMale.isEligible, false);
        assert.ok(resMale.failedCriteria.some((c) => c.includes("exclusively for female applicants (your input: male)")));

        // Universal gender scheme allows any citizen gender
        const schemeAllGenders = {
            applicableState: "ALL",
            eligibilityRules: { genders: ["all"] },
        };
        const resAny = evaluateEligibility({ gender: "transgender", state: "ALL" }, schemeAllGenders);
        assert.equal(resAny.isEligible, true);
        assert.ok(resAny.passedCriteria.some((c) => c.includes("Open to all genders")));

        // Citizen selecting "all" / unspecified MUST NOT silently qualify for female-only scheme
        const resCitAll = evaluateEligibility({ gender: "all", state: "ALL" }, schemeFemaleOnly);
        assert.equal(resCitAll.isEligible, false);
        assert.ok(resCitAll.failedCriteria.some((c) => c.includes("specific gender not provided in questionnaire")));
    });

    await t.test("3. State and regional jurisdiction evaluation", () => {
        const mhScheme = {
            applicableState: "Maharashtra",
            eligibilityRules: {},
        };

        // Resident of Maharashtra matches
        const resMh = evaluateEligibility({ state: "Maharashtra" }, mhScheme);
        assert.equal(resMh.isEligible, true);
        assert.ok(resMh.passedCriteria.some((c) => c.includes("Resident state (Maharashtra) satisfies")));

        // Case-insensitive state matching
        const resMhLower = evaluateEligibility({ state: "maharashtra" }, mhScheme);
        assert.equal(resMhLower.isEligible, true);

        // Resident of another state fails
        const resBihar = evaluateEligibility({ state: "Bihar" }, mhScheme);
        assert.equal(resBihar.isEligible, false);
        assert.ok(resBihar.failedCriteria.some((c) => c.includes("restricted to residents of Maharashtra (your input: Bihar)")));

        // Citizen selecting "ALL" (All India) does NOT silently qualify as a resident of Maharashtra
        const resAllIndia = evaluateEligibility({ state: "ALL" }, mhScheme);
        assert.equal(resAllIndia.isEligible, false);
        assert.ok(resAllIndia.failedCriteria.some((c) => c.includes("state-specific jurisdiction not provided")));

        // Central / All-India scheme matches any resident or All India selection
        const centralScheme = {
            applicableState: "ALL",
            eligibilityRules: {},
        };
        const resCentralWithState = evaluateEligibility({ state: "Tamil Nadu" }, centralScheme);
        assert.equal(resCentralWithState.isEligible, true);
        assert.ok(resCentralWithState.passedCriteria.some((c) => c.includes("Central scheme applicable across All India")));
    });

    await t.test("4. Caste / Affirmative category evaluation", () => {
        const affirmativeScheme = {
            applicableState: "ALL",
            eligibilityRules: { castes: ["sc", "st"] },
        };

        const resSc = evaluateEligibility({ caste: "SC", state: "ALL" }, affirmativeScheme);
        assert.equal(resSc.isEligible, true);

        const resGen = evaluateEligibility({ caste: "general", state: "ALL" }, affirmativeScheme);
        assert.equal(resGen.isEligible, false);
        assert.ok(resGen.failedCriteria.some((c) => c.includes("Restricted to categories: sc, st (your input: general)")));

        // Unspecified caste does not silently satisfy affirmative action scheme
        const resUnspecified = evaluateEligibility({ caste: "all", state: "ALL" }, affirmativeScheme);
        assert.equal(resUnspecified.isEligible, false);
        assert.ok(resUnspecified.failedCriteria.some((c) => c.includes("specific category not provided in questionnaire")));
    });

    await t.test("5. Occupation / Livelihood evaluation and MSME synonyms", () => {
        const kisanScheme = {
            applicableState: "ALL",
            eligibilityRules: { occupations: ["farmer"] },
        };

        const resFarmer = evaluateEligibility({ occupation: "farmer", state: "ALL" }, kisanScheme);
        assert.equal(resFarmer.isEligible, true);

        const resStudent = evaluateEligibility({ occupation: "student", state: "ALL" }, kisanScheme);
        assert.equal(resStudent.isEligible, false);
        assert.ok(resStudent.failedCriteria.some((c) => c.includes("Targeted to occupations: farmer (your input: student)")));

        // MSME synonym matching (business/self_employed/msme/shopkeeper_msme)
        const msmeScheme = {
            applicableState: "ALL",
            eligibilityRules: { occupations: ["business", "self_employed"] },
        };
        const resMsme = evaluateEligibility({ occupation: "msme", state: "ALL" }, msmeScheme);
        assert.equal(resMsme.isEligible, true);
        assert.ok(resMsme.passedCriteria.some((c) => c.includes("Occupation (msme) meets scheme criteria")));

        const resShopkeeper = evaluateEligibility({ occupation: "shopkeeper_msme", state: "ALL" }, msmeScheme);
        assert.equal(resShopkeeper.isEligible, true);
    });

    await t.test("6. Specially Abled / Divyangjan condition", () => {
        const divyangScheme = {
            applicableState: "ALL",
            eligibilityRules: { requiresDisabilityStatus: true },
        };

        const resDisabled = evaluateEligibility({ isSpeciallyAbled: true, state: "ALL" }, divyangScheme);
        assert.equal(resDisabled.isEligible, true);
        assert.ok(resDisabled.passedCriteria.some((c) => c.includes("Divyangjan")));

        const resNotDisabled = evaluateEligibility({ isSpeciallyAbled: false, state: "ALL" }, divyangScheme);
        assert.equal(resNotDisabled.isEligible, false);
        assert.ok(resNotDisabled.failedCriteria.some((c) => c.includes("requires certified disability status")));
    });

    await t.test("7. Ration card and food security status", () => {
        const bplScheme = {
            applicableState: "ALL",
            eligibilityRules: { requiresRationCard: true },
        };

        const resBpl = evaluateEligibility({ rationCardType: "bpl", state: "ALL" }, bplScheme);
        assert.equal(resBpl.isEligible, true);

        const resAay = evaluateEligibility({ rationCardType: "aay_antyodaya", state: "ALL" }, bplScheme);
        assert.equal(resAay.isEligible, true);

        const resNone = evaluateEligibility({ rationCardType: "none", state: "ALL" }, bplScheme);
        assert.equal(resNone.isEligible, false);
        assert.ok(resNone.failedCriteria.some((c) => c.includes("requires an active ration card")));
    });

    await t.test("8. Composite calculation and match percentage", () => {
        const multiRuleScheme = {
            applicableState: "Maharashtra",
            eligibilityRules: {
                minAge: 18,
                maxAge: 35,
                genders: ["female"],
                occupations: ["student"],
            },
        };

        // Citizen matches 3 of 4 restricted criteria (age 22: pass, state MH: pass, student: pass, but gender male: fail)
        // Plus open caste: pass (total 4 passed, 1 failed) -> 4/5 = 80%
        const partialResult = evaluateEligibility(
            { age: 22, state: "Maharashtra", occupation: "student", gender: "male" },
            multiRuleScheme
        );
        assert.equal(partialResult.isEligible, false);
        assert.equal(partialResult.passedCriteria.length, 4);
        assert.equal(partialResult.failedCriteria.length, 1);
        assert.equal(partialResult.matchPercentage, 80);
    });

    await t.test("9. checkSingleSchemeEligibility controller behavior", async () => {
        const validId = new mongoose.Types.ObjectId().toString();

        // 9a: Invalid ObjectId format
        const badReq = { params: { documentId: "not-an-id" }, body: {} };
        const badRes = {};
        await assert.rejects(
            () => checkSingleSchemeEligibility(badReq, badRes),
            (err) => err instanceof ApiError && err.statusCode === 400
        );

        // 9b: Non-existent scheme
        const origFindById = Document.findById;
        try {
            Document.findById = () => ({
                exec: async () => null,
                then: (resolve) => resolve(null),
            });

            const notFoundReq = { params: { documentId: validId }, body: {} };
            await assert.rejects(
                () => checkSingleSchemeEligibility(notFoundReq, badRes),
                (err) => err instanceof ApiError && err.statusCode === 404
            );

            // 9c: Successful evaluation with cautious language
            const mockSchemeDoc = {
                _id: validId,
                title: "PM SVANidhi",
                isActive: true,
                issuingAuthority: "Ministry of Housing and Urban Affairs",
                applicableState: "ALL",
                officialPortalUrl: "https://pmsvanidhi.mohua.gov.in",
                eligibilityRules: {
                    minAge: 18,
                    occupations: ["street_vendor"],
                },
            };

            Document.findById = () => ({
                exec: async () => mockSchemeDoc,
                then: (resolve) => resolve(mockSchemeDoc),
            });

            let responseStatus = null;
            let responseBody = null;
            const resMock = {
                status(code) {
                    responseStatus = code;
                    return this;
                },
                json(payload) {
                    responseBody = payload;
                    return this;
                },
            };

            await checkSingleSchemeEligibility(
                {
                    params: { documentId: validId },
                    body: { age: 30, occupation: "street_vendor", state: "ALL" },
                },
                resMock
            );

            assert.equal(responseStatus, 200);
            assert.equal(responseBody.success, true);
            assert.equal(responseBody.data.isEligible, true);
            // Assert cautious preliminary language
            assert.equal(
                responseBody.message,
                "You may be eligible for this scheme based on preliminary criteria."
            );
        } finally {
            Document.findById = origFindById;
        }
    });

    await t.test("10. matchAllEligibleSchemes controller validation and categorization", async () => {
        // 10a: Throws 400 when missing all core identifiers
        const emptyReq = { body: {} };
        const resMock = {};
        await assert.rejects(
            () => matchAllEligibleSchemes(emptyReq, resMock),
            (err) => err instanceof ApiError && err.statusCode === 400
        );

        // 10b: Successfully runs and groups schemes into eligible & partial
        const origFind = Document.find;
        try {
            const mockSchemes = [
                {
                    _id: new mongoose.Types.ObjectId(),
                    title: "PM-Kisan Samman Nidhi",
                    isActive: true,
                    documentType: "scheme",
                    applicableState: "ALL",
                    issuingAuthority: "Ministry of Agriculture",
                    eligibilityRules: {
                        minAge: 18,
                        occupations: ["farmer"],
                    },
                },
                {
                    _id: new mongoose.Types.ObjectId(),
                    title: "Delhi Youth Apprenticeship",
                    isActive: true,
                    documentType: "scheme",
                    applicableState: "Delhi",
                    issuingAuthority: "Govt of NCT of Delhi",
                    eligibilityRules: {
                        minAge: 18,
                        maxAge: 25,
                        occupations: ["student"],
                    },
                },
            ];

            Document.find = () => ({
                select: () => ({
                    exec: async () => mockSchemes,
                    then: (resolve) => resolve(mockSchemes),
                }),
            });

            let responseStatus = null;
            let responseBody = null;
            const mockRes = {
                status(code) {
                    responseStatus = code;
                    return this;
                },
                json(payload) {
                    responseBody = payload;
                    return this;
                },
            };

            // Test citizen: Age 22, State ALL, Farmer
            // Matches PM-Kisan 100% (Eligible)
            // Matches Delhi scheme partially (Age 22 is in 18-25: pass, State ALL vs Delhi: fail, occupation farmer vs student: fail, open gender: pass, open caste: pass) -> 3/5 = 60% (Partially Eligible)
            await matchAllEligibleSchemes(
                {
                    body: {
                        age: 22,
                        state: "ALL",
                        occupation: "farmer",
                        gender: "male",
                    },
                },
                mockRes
            );

            assert.equal(responseStatus, 200);
            assert.equal(responseBody.success, true);
            assert.equal(responseBody.data.totalEligible, 1);
            assert.equal(responseBody.data.eligibleSchemes[0].title, "PM-Kisan Samman Nidhi");
            assert.equal(responseBody.data.totalPartiallyEligible, 1);
            assert.equal(responseBody.data.partiallyEligibleSchemes[0].title, "Delhi Youth Apprenticeship");

            // Verify cautious disclaimer notice presence
            assert.ok(
                responseBody.data.evaluationNotice.includes("Preliminary assessment only")
            );
            assert.ok(
                responseBody.message.includes("potential scheme matches")
            );
        } finally {
            Document.find = origFind;
        }
    });

    await t.test("11. Profile prefill with safe connection check", async () => {
        const origFind = Document.find;
        try {
            Document.find = () => ({
                select: () => ({
                    exec: async () => [],
                    then: (resolve) => resolve([]),
                }),
            });

            let responseStatus = null;
            let responseBody = null;
            const mockRes = {
                status(code) {
                    responseStatus = code;
                    return this;
                },
                json(payload) {
                    responseBody = payload;
                    return this;
                },
            };

            // Authenticated citizen with userProfile pre-attached on req
            const authReq = {
                user: { _id: "user123" },
                userProfile: {
                    age: 28,
                    state: "Gujarat",
                    gender: "male",
                    occupation: "farmer",
                },
                body: {}, // empty body, should inherit from userProfile
            };

            await matchAllEligibleSchemes(authReq, mockRes);
            assert.equal(responseStatus, 200);
            assert.equal(responseBody.success, true);
            assert.equal(responseBody.data.totalEligible, 0);
        } finally {
            Document.find = origFind;
        }
    });
});
