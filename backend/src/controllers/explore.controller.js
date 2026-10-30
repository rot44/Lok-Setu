import { Document } from "../models/document.model.js";
import { Explainer } from "../models/explainer.model.js";
import { ApiError } from "../utils/apiError.js";
import { APIResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Helper to build Age Filter from UI Age Group ranges
 */
const buildAgeFilter = (ageGroup) => {
    switch (ageGroup) {
        case "below_18":
            return { "eligibilityRules.minAge": { $lte: 17 } };
        case "18_25":
            return {
                "eligibilityRules.minAge": { $lte: 25 },
                "eligibilityRules.maxAge": { $gte: 18 },
            };
        case "26_40":
            return {
                "eligibilityRules.minAge": { $lte: 40 },
                "eligibilityRules.maxAge": { $gte: 26 },
            };
        case "41_60":
            return {
                "eligibilityRules.minAge": { $lte: 60 },
                "eligibilityRules.maxAge": { $gte: 41 },
            };
        case "above_60":
            return { "eligibilityRules.maxAge": { $gte: 60 } };
        default:
            return {};
    }
};

/**
 * @desc    Explore schemes catalog with multi-filter, search, sorting & pagination
 * @route   GET /api/v1/explore
 * @access  Public
 */
export const getExploreSchemes = asyncHandler(async (req, res) => {
    const {
        search,              // Text keyword (e.g. "kisan", "scholarship")
        tab,                 // Quick Tabs: 'all' | 'schemes' | 'policies' | 'notifications'
        category,            // Education, Agriculture, Healthcare, MSME, Women & Child
        governmentLevel,     // 'all' | 'central' | 'state' | 'municipal'
        state,               // State/UT name (e.g. "Madhya Pradesh", "Maharashtra")
        gender,              // 'all' | 'female' | 'male' | 'other'
        ageGroup,            // 'below_18' | '18_25' | '26_40' | '41_60' | 'above_60'
        incomeRange,         // 'below_1_lakh' | '1_to_2.5_lakh' | '2.5_to_5_lakh' | '5_to_8_lakh' | 'above_8_lakh'
        religion,            // 'hindu' | 'muslim' | 'christian' | 'sikh' | 'buddhist' | 'jain'
        caste,               // 'general' | 'obc' | 'sc' | 'st' | 'ews'
        beneficiaryType,     // 'farmer' | 'student' | 'msme' | 'street_vendor' | 'women'
        isSpeciallyAbled,    // 'true' | 'false' (Disability)
        sortBy = "newest",   // 'relevance' | 'newest' | 'deadline' | 'title'
        page = 1,
        limit = 12,
    } = req.query;

    const query = { isActive: true };

    // ─── 1. Search Query (Title, Tags, or Keyword Regex) ────────────────────
    if (search && search.trim()) {
        const keyword = search.trim();
        query.$or = [
            { title: { $regex: keyword, $options: "i" } },
            { tags: { $in: [new RegExp(keyword, "i")] } },
            { issuingAuthority: { $regex: keyword, $options: "i" } },
        ];
    }

    // ─── 2. Top Quick Tabs (All / Schemes / Policies / Notifications) ───────
    if (tab && tab !== "all") {
        if (tab === "schemes") {
            query.documentType = { $in: ["welfare_policy", "subsidies_grants"] };
        } else if (tab === "policies") {
            query.documentType = { $in: ["government_notification", "municipal_law"] };
        } else if (tab === "notifications") {
            query.documentType = { $in: ["circular", "government_notification"] };
        }
    }

    // ─── 3. Category Filter (Agriculture, Education, Healthcare, MSME, etc.) 
    if (category && category !== "all") {
        query.tags = { $in: [new RegExp(category, "i")] };
    }

    // ─── 4. Government Level Filter (Central / State / Municipal) ───────────
    if (governmentLevel && governmentLevel !== "all") {
        query.jurisdictionLevel = governmentLevel.toLowerCase();
    }

    // ─── 5. State / UT Filter ───────────────────────────────────────────────
    // If state is selected (e.g. "Gujarat"), show Gujarat schemes + All-India Central schemes
    if (state && state !== "ALL") {
        const stateCondition = [{ applicableState: state }, { applicableState: "ALL" }];
        if (query.$or) {
            query.$and = [{ $or: query.$or }, { $or: stateCondition }];
            delete query.$or;
        } else {
            query.$or = stateCondition;
        }
    }

    // ─── 6. Gender Filter ───────────────────────────────────────────────────
    if (gender && gender !== "all") {
        query["eligibilityRules.genders"] = { $in: [gender.toLowerCase(), "ALL"] };
    }

    // ─── 7. Age Group Filter ────────────────────────────────────────────────
    if (ageGroup && ageGroup !== "all") {
        const ageFilter = buildAgeFilter(ageGroup);
        Object.assign(query, ageFilter);
    }

    // ─── 8. Annual Family Income Filter ─────────────────────────────────────
    if (incomeRange && incomeRange !== "any") {
        query["eligibilityRules.maxAnnualIncome"] = { $in: [incomeRange, "any"] };
    }

    // ─── 9. Religion Filter (Minority Welfare Schemes) ──────────────────────
    if (religion && religion !== "all") {
        query["eligibilityRules.religions"] = { $in: [religion.toLowerCase(), "ALL"] };
    }

    // ─── 10. Caste / Social Category Filter ─────────────────────────────────
    if (caste && caste !== "all") {
        query["eligibilityRules.castes"] = { $in: [caste.toLowerCase(), "ALL"] };
    }

    // ─── 11. Beneficiary Type / Occupation ──────────────────────────────────
    if (beneficiaryType && beneficiaryType !== "all") {
        query["eligibilityRules.occupations"] = { $in: [beneficiaryType.toLowerCase(), "ALL"] };
    }

    // ─── 12. Specially Abled / Disability Filter ────────────────────────────
    if (isSpeciallyAbled === "true") {
        query["eligibilityRules.requiresDisabilityStatus"] = true;
    }

    // ─── 13. Sorting Logic ──────────────────────────────────────────────────
    let sortOptions = { createdAt: -1 }; // Default: Newest first

    if (sortBy === "deadline") {
        // Schemes ending soon (excludes past deadlines or null)
        query.applicationDeadline = { $gte: new Date() };
        sortOptions = { applicationDeadline: 1 };
    } else if (sortBy === "title") {
        sortOptions = { title: 1 };
    } else if (sortBy === "relevance" && search) {
        // If search was executed, newest matching records come first
        sortOptions = { createdAt: -1 };
    }

    // ─── 14. Pagination Execution ───────────────────────────────────────────
    const parsedPage = Math.max(1, parseInt(page) || 1);
    const parsedLimit = Math.max(1, Math.min(50, parseInt(limit) || 12));
    const skip = (parsedPage - 1) * parsedLimit;

    const [documents, totalCount] = await Promise.all([
        Document.find(query)
            .select("title documentType jurisdictionLevel applicableState issuingAuthority applicationDeadline officialPortalUrl tags eligibilityRules createdAt")
            .sort(sortOptions)
            .skip(skip)
            .limit(parsedLimit),
        Document.countDocuments(query),
    ]);

    // ─── 15. Honest Empty State (Hackathon Rule) ────────────────────────────
    if (totalCount === 0) {
        return res.status(200).json(
            new APIResponse(
                200,
                {
                    documents: [],
                    totalCount: 0,
                    totalPages: 0,
                    currentPage: parsedPage,
                    limit: parsedLimit,
                    activeFilters: { ...req.query },
                },
                "No schemes found matching the selected filters."
            )
        );
    }

    return res.status(200).json(
        new APIResponse(
            200,
            {
                documents,
                totalCount,
                totalPages: Math.ceil(totalCount / parsedLimit),
                currentPage: parsedPage,
                limit: parsedLimit,
                activeFilters: { ...req.query },
            },
            `Found ${totalCount} schemes matching your criteria.`
        )
    );
});

/**
 * @desc    Get single scheme details with all cached voice explainers
 * @route   GET /api/v1/explore/:id
 * @access  Public
 */
export const getSchemeById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const document = await Document.findById(id);
    if (!document) {
        throw new ApiError(404, "Scheme or policy document not found.");
    }

    // Fetch pre-generated audio explainers & plain summaries across languages
    const explainers = await Explainer.find({ documentId: id }).select(
        "languageCode languageName plainSummary keyRights eligibilityCriteria citizenImpact businessImpact requiredDocuments howToApplySteps audio.audioUrl audio.durationSeconds"
    );

    return res.status(200).json(
        new APIResponse(
            200,
            {
                document,
                availableExplainers: explainers,
            },
            "Scheme details retrieved successfully."
        )
    );
});

/**
 * @desc    Get filter facet counts (powers the sidebar badges e.g. Education: 124, Central: 342)
 * @route   GET /api/v1/explore/filters-meta
 * @access  Public
 */
export const getFiltersMetadata = asyncHandler(async (req, res) => {
    const [
        totalActive,
        centralCount,
        stateCount,
        educationCount,
        agricultureCount,
        healthcareCount,
        msmeCount,
        womenCount,
    ] = await Promise.all([
        Document.countDocuments({ isActive: true }),
        Document.countDocuments({ isActive: true, jurisdictionLevel: "central" }),
        Document.countDocuments({ isActive: true, jurisdictionLevel: "state" }),
        Document.countDocuments({ isActive: true, tags: { $in: [/education/i] } }),
        Document.countDocuments({ isActive: true, tags: { $in: [/agriculture/i, /farmer/i] } }),
        Document.countDocuments({ isActive: true, tags: { $in: [/health/i] } }),
        Document.countDocuments({ isActive: true, tags: { $in: [/msme/i, /business/i] } }),
        Document.countDocuments({ isActive: true, tags: { $in: [/women/i, /child/i] } }),
    ]);

    return res.status(200).json(
        new APIResponse(
            200,
            {
                totalActive,
                levels: {
                    central: centralCount,
                    state: stateCount,
                },
                categories: {
                    education: educationCount,
                    agriculture: agricultureCount,
                    healthcare: healthcareCount,
                    msme: msmeCount,
                    womenAndChild: womenCount,
                },
            },
            "Filter metadata fetched successfully."
        )
    );
});

