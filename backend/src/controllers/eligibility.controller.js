import mongoose from "mongoose";
import { Document } from "../models/document.model.js";
import { UserProfile } from "../models/userProfile.model.js";
import { APIResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Pure rule-evaluator comparing citizen profile against scheme eligibility criteria
 */
export const evaluateEligibility = (citizenData, scheme) => {
    const rules = scheme.eligibilityRules || {};
    const passedCriteria = [];
    const failedCriteria = [];

    // 1. Age Verification
    const age = Number(citizenData.age);
    if (!isNaN(age) && age > 0) {
        if (rules.minAge && age < rules.minAge) {
            failedCriteria.push(
                `Age ${age} is below minimum required age of ${rules.minAge} years.`
            );
        } else if (rules.maxAge && age > rules.maxAge) {
            failedCriteria.push(
                `Age ${age} exceeds maximum eligible age of ${rules.maxAge} years.`
            );
        } else {
            passedCriteria.push(
                `Age (${age} yrs) satisfies criteria (${rules.minAge || 0} - ${rules.maxAge || "No limit"}).`
            );
        }
    }

    // 2. Gender Verification
    if (citizenData.gender && rules.genders?.length) {
        const normalizedGender = citizenData.gender.toLowerCase();
        const allowedGenders = rules.genders.map((g) => g.toLowerCase());

        if (
            allowedGenders.includes("all") ||
            allowedGenders.includes(normalizedGender) ||
            normalizedGender === "all"
        ) {
            passedCriteria.push(`Gender (${citizenData.gender}) matches scheme criteria.`);
        } else {
            failedCriteria.push(`Scheme is exclusively for ${rules.genders.join(", ")} applicants.`);
        }
    }

    // 3. State / Regional Jurisdiction
    if (citizenData.state) {
        const citizenState = citizenData.state.toLowerCase();
        const schemeState = (scheme.applicableState || "ALL").toLowerCase();

        if (schemeState === "all" || schemeState === citizenState || citizenState === "all") {
            passedCriteria.push(`State (${citizenData.state}) is eligible.`);
        } else {
            failedCriteria.push(`Scheme is restricted to residents of ${scheme.applicableState}.`);
        }
    }

    // 4. Caste / Social Category
    if (citizenData.caste && rules.castes?.length) {
        const citizenCaste = citizenData.caste.toLowerCase();
        const allowedCastes = rules.castes.map((c) => c.toLowerCase());

        if (
            allowedCastes.includes("all") ||
            allowedCastes.includes(citizenCaste) ||
            citizenCaste === "all"
        ) {
            passedCriteria.push(`Category (${citizenData.caste}) is eligible.`);
        } else {
            failedCriteria.push(`Restricted to categories: ${rules.castes.join(", ")}.`);
        }
    }

    // 5. Occupation / Livelihood
    if (citizenData.occupation && rules.occupations?.length) {
        const citizenOcc = citizenData.occupation.toLowerCase();
        const allowedOcc = rules.occupations.map((o) => o.toLowerCase());

        if (
            allowedOcc.includes("all") ||
            allowedOcc.includes(citizenOcc) ||
            citizenOcc === "all"
        ) {
            passedCriteria.push(`Occupation (${citizenData.occupation}) meets scheme criteria.`);
        } else {
            failedCriteria.push(`Targeted to occupations: ${rules.occupations.join(", ")}.`);
        }
    }

    // 6. Disability / Divyangjan Status
    if (rules.requiresDisabilityStatus) {
        if (citizenData.isSpeciallyAbled) {
            passedCriteria.push("Specially abled (Divyangjan) eligibility condition met.");
        } else {
            failedCriteria.push("Scheme requires certified disability status (Divyangjan).");
        }
    }

    // 7. Ration Card / BPL Requirement
    if (rules.requiresRationCard) {
        if (citizenData.rationCardType && citizenData.rationCardType !== "none") {
            passedCriteria.push(`Possesses required ration card (${citizenData.rationCardType}).`);
        } else {
            failedCriteria.push("Scheme requires an active ration card (BPL / Antyodaya).");
        }
    }

    const isEligible = failedCriteria.length === 0;

    return {
        isEligible,
        passedCriteria,
        failedCriteria,
        matchPercentage: Math.round(
            (passedCriteria.length / (passedCriteria.length + failedCriteria.length || 1)) * 100
        ),
    };
};

/**
 * Safely fetches citizen profile without Mongoose buffering timeouts when offline or in tests.
 */
const safeFindProfile = async (req) => {
    if (req.userProfile !== undefined) {
        return req.userProfile;
    }
    if (req.user && mongoose.connection && mongoose.connection.readyState === 1) {
        return await UserProfile.findOne({ user: req.user._id }).catch(() => null);
    }
    return null;
};

/**
 * @desc    Check eligibility for a single scheme by ID
 * @route   POST /api/v1/eligibility/check/:documentId
 * @access  Public or Authenticated
 */
export const checkSingleSchemeEligibility = asyncHandler(async (req, res) => {
    const { documentId } = req.params;

    if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
        throw new ApiError(400, "Invalid scheme document ID format.");
    }

    const scheme = await Document.findById(documentId);
    if (!scheme || !scheme.isActive) {
        throw new ApiError(404, "Scheme not found or is currently inactive.");
    }

    // Extract citizen demographics: either from request body or authenticated profile
    let citizenData = req.body || {};

    if (req.user && (!citizenData.state || !citizenData.age)) {
        const profile = await safeFindProfile(req);
        if (profile) {
            citizenData = {
                age: citizenData.age ?? profile.age,
                gender: citizenData.gender ?? profile.gender,
                state: citizenData.state ?? profile.state,
                caste: citizenData.caste ?? profile.caste,
                occupation: citizenData.occupation ?? profile.occupation,
                isSpeciallyAbled: citizenData.isSpeciallyAbled ?? profile.isSpeciallyAbled,
                rationCardType: citizenData.rationCardType ?? profile.rationCardType,
            };
        }
    }

    const evaluation = evaluateEligibility(citizenData, scheme);

    return res.status(200).json(
        new APIResponse(
            200,
            {
                schemeId: scheme._id,
                title: scheme.title,
                issuingAuthority: scheme.issuingAuthority,
                applicationDeadline: scheme.applicationDeadline,
                officialPortalUrl: scheme.officialPortalUrl,
                ...evaluation,
            },
            evaluation.isEligible
                ? "You may be eligible for this scheme based on preliminary criteria."
                : "You do not meet all criteria for this scheme."
        )
    );
});

/**
 * @desc    Find all schemes the citizen is eligible for
 * @route   POST /api/v1/eligibility/match-all
 * @access  Public or Authenticated
 */
export const matchAllEligibleSchemes = asyncHandler(async (req, res) => {
    let citizenData = req.body || {};

    if (req.user && (!citizenData.state || !citizenData.age)) {
        const profile = await safeFindProfile(req);
        if (profile) {
            citizenData = {
                age: citizenData.age ?? profile.age,
                gender: citizenData.gender ?? profile.gender,
                state: citizenData.state ?? profile.state,
                caste: citizenData.caste ?? profile.caste,
                occupation: citizenData.occupation ?? profile.occupation,
                isSpeciallyAbled: citizenData.isSpeciallyAbled ?? profile.isSpeciallyAbled,
                rationCardType: citizenData.rationCardType ?? profile.rationCardType,
            };
        }
    }

    if (!citizenData.state && !citizenData.age && !citizenData.gender) {
        throw new ApiError(
            400,
            "Please provide at least state, age, or gender to check eligibility."
        );
    }

    // Fetch all active documents/schemes
    const schemes = await Document.find({ isActive: true }).select(
        "title documentType jurisdictionLevel applicableState issuingAuthority applicationDeadline officialPortalUrl eligibilityRules"
    );

    const eligibleSchemes = [];
    const partiallyEligibleSchemes = [];

    for (const scheme of schemes) {
        const evalResult = evaluateEligibility(citizenData, scheme);
        const schemeSummary = {
            _id: scheme._id,
            title: scheme.title,
            documentType: scheme.documentType,
            applicableState: scheme.applicableState,
            issuingAuthority: scheme.issuingAuthority,
            officialPortalUrl: scheme.officialPortalUrl,
            applicationDeadline: scheme.applicationDeadline,
            ...evalResult,
        };

        if (evalResult.isEligible) {
            eligibleSchemes.push(schemeSummary);
        } else if (evalResult.matchPercentage >= 50) {
            partiallyEligibleSchemes.push(schemeSummary);
        }
    }

    return res.status(200).json(
        new APIResponse(
            200,
            {
                totalEligible: eligibleSchemes.length,
                totalPartiallyEligible: partiallyEligibleSchemes.length,
                eligibleSchemes,
                partiallyEligibleSchemes,
                evaluationNotice: "Preliminary assessment only. Final eligibility is determined by the relevant government authority.",
            },
            `Found ${eligibleSchemes.length} potential scheme matches based on your criteria.`
        )
    );
});
