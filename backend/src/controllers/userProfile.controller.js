import { UserProfile } from "../models/userProfile.model.js";
import { Document } from "../models/document.model.js";
import { APIResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * @desc    Get user's demographic profile
 * @route   GET /api/v1/profile
 * @access  Private (Requires verifyJWT)
 */
export const getProfile = asyncHandler(async (req, res) => {
    let profile = await UserProfile.findOne({ user: req.user._id }).populate(
        "user",
        "username email phone role isVerified"
    );

    // If profile doesn't exist yet, initialize a clean default profile for this user
    if (!profile) {
        profile = await UserProfile.create({
            user: req.user._id,
            state: "All India",
            city: "General",
        });

        // Re-populate user details
        profile = await UserProfile.findById(profile._id).populate(
            "user",
            "username email phone role isVerified"
        );
    }

    return res.status(200).json(
        new APIResponse(200, profile, "Profile retrieved successfully.")
    );
});

/**
 * @desc    Update citizen profile (Demographics, Location, Income, Occupation, 3 Preferred Languages)
 * @route   PUT /api/v1/profile
 * @access  Private (Requires verifyJWT)
 */
export const updateProfile = asyncHandler(async (req, res) => {
    const {
        dob,
        age,
        gender,
        maritalStatus,
        religion,
        caste,
        isSpeciallyAbled,
        disabilityPercentage,
        state,
        city,
        location,
        incomeRange,
        rationCardType,
        occupation,
        isBusinessOwner,
        isFarmer,
        preferredLanguages,
    } = req.body;

    let profile = await UserProfile.findOne({ user: req.user._id });

    if (!profile) {
        profile = new UserProfile({ user: req.user._id });
    }

    // Update fields if provided
    if (dob !== undefined) profile.dob = dob;
    if (age !== undefined) profile.age = Number(age);
    if (gender !== undefined) profile.gender = gender;
    if (maritalStatus !== undefined) profile.maritalStatus = maritalStatus;
    if (religion !== undefined) profile.religion = religion;
    if (caste !== undefined) profile.caste = caste;

    if (isSpeciallyAbled !== undefined) {
        profile.isSpeciallyAbled = Boolean(isSpeciallyAbled);
        profile.disabilityPercentage = isSpeciallyAbled
            ? Number(disabilityPercentage || 0)
            : 0;
    }

    if (state !== undefined) profile.state = state.trim();
    if (city !== undefined) profile.city = city.trim();

    if (location) {
        profile.location = {
            area: location.area !== undefined ? location.area : profile.location?.area,
            pincode: location.pincode !== undefined ? location.pincode : profile.location?.pincode,
            localityType: location.localityType || profile.location?.localityType || "urban",
        };
    }

    if (incomeRange !== undefined) profile.incomeRange = incomeRange;
    if (rationCardType !== undefined) profile.rationCardType = rationCardType;

    if (occupation !== undefined) profile.occupation = occupation;
    if (isBusinessOwner !== undefined) profile.isBusinessOwner = Boolean(isBusinessOwner);
    if (isFarmer !== undefined) profile.isFarmer = Boolean(isFarmer);

    if (preferredLanguages) {
        profile.preferredLanguages = {
            primary: preferredLanguages.primary || profile.preferredLanguages?.primary || "hi",
            secondary: preferredLanguages.secondary !== undefined ? preferredLanguages.secondary : profile.preferredLanguages?.secondary,
            tertiary: preferredLanguages.tertiary !== undefined ? preferredLanguages.tertiary : profile.preferredLanguages?.tertiary,
        };
    }

    // Check if essential profile details are filled to mark profile complete
    const isBasicDetailsFilled =
        Boolean(profile.state && profile.state !== "All India") &&
        Boolean(profile.city && profile.city !== "General") &&
        Boolean(profile.gender) &&
        Boolean(profile.occupation);

    profile.isProfileComplete = isBasicDetailsFilled;

    await profile.save();

    const populatedProfile = await UserProfile.findById(profile._id).populate(
        "user",
        "username email phone role isVerified"
    );

    return res.status(200).json(
        new APIResponse(200, populatedProfile, "Profile updated successfully! 🏛️")
    );
});

/**
 * @desc    Dashboard overview: Citizen snapshot + Profile-matched eligible schemes
 * @route   GET /api/v1/profile/dashboard
 * @access  Private (Requires verifyJWT)
 */
export const getDashboardSummary = asyncHandler(async (req, res) => {
    let profile = await UserProfile.findOne({ user: req.user._id }).populate(
        "user",
        "username email phone role isVerified"
    );

    if (!profile) {
        profile = await UserProfile.create({
            user: req.user._id,
            state: "All India",
            city: "General",
        });
    }

    // Dynamic criteria matching based on citizen's profile
    const query = { isActive: true };

    // 1. Match State (User's specific state or Central/All India schemes)
    if (profile.state && profile.state !== "All India") {
        query.$or = [{ applicableState: profile.state }, { applicableState: "ALL" }];
    }

    // 2. Match Occupation if specified
    if (profile.occupation && profile.occupation !== "other") {
        query["eligibilityRules.occupations"] = {
            $in: [profile.occupation, "ALL"],
        };
    }

    // 3. Match Caste if specified
    if (profile.caste && profile.caste !== "general") {
        query["eligibilityRules.castes"] = {
            $in: [profile.caste, "ALL"],
        };
    }

    // 4. Match Age if specified
    if (profile.age && profile.age > 0) {
        query["eligibilityRules.minAge"] = { $lte: profile.age };
        query["eligibilityRules.maxAge"] = { $gte: profile.age };
    }

    // Fetch matched schemes from real Document records
    const matchedSchemes = await Document.find(query)
        .select(
            "title documentType jurisdictionLevel applicableState issuingAuthority applicationDeadline officialPortalUrl createdAt"
        )
        .limit(6)
        .sort({ createdAt: -1 });

    const totalMatchedCount = await Document.countDocuments(query);

    return res.status(200).json(
        new APIResponse(
            200,
            {
                profile,
                dashboardMetrics: {
                    matchedSchemesCount: totalMatchedCount,
                    isProfileComplete: profile.isProfileComplete,
                    primaryLanguage: profile.preferredLanguages?.primary || "hi",
                },
                matchedSchemes,
            },
            "Dashboard overview fetched successfully."
        )
    );
});

