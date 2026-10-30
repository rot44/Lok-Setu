import mongoose from "mongoose";
import { Document } from "../models/document.model.js";
import { UserProfile } from "../models/userProfile.model.js";
import { APIResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Pure rule-evaluator comparing citizen profile against scheme eligibility criteria.
 * Enforces strict government qualification: missing or unspecified citizen answers
 * do NOT silently satisfy restrictive criteria.
 */
export const evaluateEligibility = (citizenData = {}, scheme = {}) => {
    const rules = scheme.eligibilityRules || {};
    const passedCriteria = [];
    const failedCriteria = [];

    // 1. Age Verification
    const age = Number(citizenData.age);
    const hasAgeRestriction =
        (rules.minAge !== undefined && rules.minAge > 0) ||
        (rules.maxAge !== undefined && rules.maxAge < 120);

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
    } else if (hasAgeRestriction) {
        failedCriteria.push(
            `Scheme requires applicant age between ${rules.minAge || 0} and ${rules.maxAge || 120} years (age not provided in questionnaire).`
        );
    } else {
        passedCriteria.push("No age restrictions.");
    }

    // 2. Gender Verification
    const hasGenderRestriction =
        rules.genders?.length > 0 &&
        !rules.genders.map((g) => String(g).toLowerCase()).includes("all");
    const normalizedGender = citizenData.gender ? String(citizenData.gender).toLowerCase().trim() : "";

    if (hasGenderRestriction) {
        const allowedGenders = rules.genders.map((g) => String(g).toLowerCase());
        if (normalizedGender && normalizedGender !== "all" && allowedGenders.includes(normalizedGender)) {
            passedCriteria.push(`Gender (${citizenData.gender}) matches scheme criteria.`);
        } else {
            failedCriteria.push(
                `Scheme is exclusively for ${rules.genders.join(", ")} applicants${
                    normalizedGender && normalizedGender !== "all"
                        ? ` (your input: ${citizenData.gender})`
                        : " (specific gender not provided in questionnaire)"
                }.`
            );
        }
    } else {
        passedCriteria.push("Open to all genders.");
    }

    // 3. State / Regional Jurisdiction
    const schemeState = (scheme.applicableState || "ALL").toLowerCase().trim();
    const isCentralScheme = schemeState === "all";
    const citizenState = citizenData.state ? String(citizenData.state).toLowerCase().trim() : "";

    if (isCentralScheme) {
        passedCriteria.push(
            citizenState && citizenState !== "all"
                ? `Central scheme applicable across All India (including ${citizenData.state}).`
                : "Central scheme applicable across All India."
        );
    } else {
        // State-restricted scheme requires verified residence in that state
        if (citizenState && citizenState !== "all" && citizenState === schemeState) {
            passedCriteria.push(`Resident state (${citizenData.state}) satisfies jurisdiction criteria.`);
        } else {
            failedCriteria.push(
                `Scheme is restricted to residents of ${scheme.applicableState}${
                    citizenState && citizenState !== "all"
                        ? ` (your input: ${citizenData.state})`
                        : " (state-specific jurisdiction not provided)"
                }.`
            );
        }
    }

    // 4. Caste / Social Category
    const hasCasteRestriction =
        rules.castes?.length > 0 &&
        !rules.castes.map((c) => String(c).toLowerCase()).includes("all");
    const citizenCaste = citizenData.caste ? String(citizenData.caste).toLowerCase().trim() : "";

    if (hasCasteRestriction) {
        const allowedCastes = rules.castes.map((c) => String(c).toLowerCase());
        if (citizenCaste && citizenCaste !== "all" && allowedCastes.includes(citizenCaste)) {
            passedCriteria.push(`Social category (${citizenData.caste}) is eligible.`);
        } else {
            failedCriteria.push(
                `Restricted to categories: ${rules.castes.join(", ")}${
                    citizenCaste && citizenCaste !== "all"
                        ? ` (your input: ${citizenData.caste})`
                        : " (specific category not provided in questionnaire)"
                }.`
            );
        }
    } else {
        passedCriteria.push("Open to all social categories.");
    }

    // 5. Occupation / Livelihood
    const hasOccRestriction =
        rules.occupations?.length > 0 &&
        !rules.occupations.map((o) => String(o).toLowerCase()).includes("all");
    const citizenOcc = citizenData.occupation ? String(citizenData.occupation).toLowerCase().trim() : "";

    // Synonyms / aliases for MSME, business owners, and self-employed
    const msmeAliases = ["msme", "business", "self_employed", "shopkeeper_msme"];

    if (hasOccRestriction) {
        const allowedOcc = rules.occupations.map((o) => String(o).toLowerCase());
        const isMatch =
            citizenOcc &&
            citizenOcc !== "all" &&
            (allowedOcc.includes(citizenOcc) ||
                (msmeAliases.includes(citizenOcc) && allowedOcc.some((o) => msmeAliases.includes(o))));

        if (isMatch) {
            passedCriteria.push(`Occupation (${citizenData.occupation}) meets scheme criteria.`);
        } else {
            failedCriteria.push(
                `Targeted to occupations: ${rules.occupations.join(", ")}${
                    citizenOcc && citizenOcc !== "all"
                        ? ` (your input: ${citizenData.occupation})`
                        : " (occupation not provided in questionnaire)"
                }.`
            );
        }
    } else {
        passedCriteria.push("Open to all occupations.");
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
