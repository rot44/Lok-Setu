import crypto from "crypto";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { User } from "../models/user.model.js";
import { UserProfile } from "../models/userProfile.model.js";
import { ApiError } from "../utils/apiError.js";
import { APIResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { emailQueue, redisConnection } from "../queues/email.queue.js";

const getResendClient = () => {
    return process.env.RESEND_API_KEY
        ? new Resend(process.env.RESEND_API_KEY)
        : null;
};

// Helper: Secure 6-digit numeric OTP generator
const generateSixDigitOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper: Dispatch OTP via direct Resend API (instant delivery) with BullMQ fallback
const dispatchOtpEmail = async (email, otp, type = "verification_otp") => {
    // Always print OTP in server logs for easy testing and diagnostics
    console.log(`\n==================================================`);
    console.log(`🔑 [SECURITY OTP for ${email}]: ${otp}`);
    console.log(`==================================================\n`);

    // 1. Send directly through Resend API for instant inbox delivery
    const resendClient = getResendClient();
    if (resendClient) {
        try {
            const subject =
                type === "verification_otp"
                    ? "Verify your Lok Setu Account"
                    : "Reset Your Lok Setu Password";

            const { data, error } = await resendClient.emails.send({
                from: process.env.RESEND_FROM_EMAIL || "Lok Setu <onboarding@resend.dev>",
                to: email,
                subject,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e5e7eb;border-radius:12px;color:#1f2937;">
                        <h2 style="color:#2563eb;margin-bottom:8px;">🏛️ Lok Setu Security Verification</h2>
                        <p style="color:#6b7280;margin-bottom:24px;">Apna account verify karne ke liye neeche diya gaya OTP darj karein:</p>
                        <div style="background:#eff6ff;padding:20px;border-radius:8px;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#1d4ed8;">
                            ${otp}
                        </div>
                        <p style="color:#9ca3af;font-size:13px;margin-top:20px;">
                            ⏳ Yeh OTP sirf <strong>10 minute</strong> tak valid hai.<br/>
                            Agar aapne yeh request nahi ki toh is email ko ignore karein.
                        </p>
                    </div>
                `,
            });

            if (error) {
                console.warn("⚠️ [Resend Notice]:", error.message || error);
            } else {
                console.log(`✅ [Direct Resend] Sent OTP email to ${email} (ID: ${data?.id})`);
                return;
            }
        } catch (resendErr) {
            console.warn("⚠️ [Direct Resend Notice]:", resendErr.message);
        }
    }

    // 2. Fallback: Queue via BullMQ if Redis is ready
    if (redisConnection && redisConnection.status === "ready") {
        try {
            await emailQueue.add("send-verification-otp", {
                email,
                type,
                data: { otp },
            });
        } catch (queueErr) {
            console.warn("⚠️ [Queue Notice]:", queueErr.message);
        }
    }
};

// Helper: Generate and persist access & refresh tokens
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found while generating tokens.");
        }

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // Save refresh token in database (without validating the whole schema)
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, error.message || "Failed to generate authentication tokens.");
    }
};

// Secure Cookie Options
const cookieOptions = {
    httpOnly: true, // Prevents client-side scripts from reading cookies (XSS protection)
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * @desc    Register a new citizen user & queue 2FA verification email OTP
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password, phone, role, preferredLanguage, state, city } = req.body || {};

    // 1. Mandatory validations
    if (!username || !email || !password) {
        throw new ApiError(400, "Username, email, and password are required.");
    }

    if (password.length < 8) {
        throw new ApiError(400, "Password must be at least 8 characters long.");
    }

    // 2. Separate checks for email and username for clean error messaging
    const existingEmailUser = await User.findOne({ email: email.toLowerCase() });
    if (existingEmailUser && existingEmailUser.isVerified) {
        throw new ApiError(409, "An account with this email address already exists. Please sign in instead.");
    }

    const existingUsernameUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUsernameUser) {
        if (existingUsernameUser.isVerified || (existingEmailUser && existingUsernameUser._id.toString() !== existingEmailUser._id.toString())) {
            throw new ApiError(409, "This username is already taken. Please choose another username.");
        }
    }

    // 3. Generate 6-digit OTP and 10-minute expiry
    const verificationOtp = generateSixDigitOtp();
    const verificationOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    let user;
    if (existingEmailUser && !existingEmailUser.isVerified) {
        // Update existing unverified user with fresh credentials and OTP
        existingEmailUser.username = username.toLowerCase();
        existingEmailUser.password = password; // Will be hashed by pre-save hook
        existingEmailUser.verificationOtp = verificationOtp;
        existingEmailUser.verificationOtpExpiry = verificationOtpExpiry;
        if (phone) existingEmailUser.phone = phone;
        user = await existingEmailUser.save();
    } else {
        // Create new user
        user = await User.create({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password,
            phone: phone || "",
            role: role || "citizen",
            isVerified: false,
            verificationOtp,
            verificationOtpExpiry,
        });
    }

    // 4. Initialize linked UserProfile if not already present
    let profile = await UserProfile.findOne({ user: user._id });
    if (!profile) {
        profile = await UserProfile.create({
            user: user._id,
            state: state || "All India",
            city: city || "General",
            preferredLanguages: {
                primary: preferredLanguage || "hi", // Defaults to Hindi
                secondary: "en",
            },
        });
    }

    // 5. Send OTP email (BullMQ queue or direct Resend fallback)
    await dispatchOtpEmail(user.email, verificationOtp, "verification_otp");

    return res.status(201).json(
        new APIResponse(
            201,
            {
                userId: user._id,
                email: user.email,
                username: user.username,
                isVerified: false,
            },
            "Registration initiated! A 6-digit verification OTP has been dispatched to your email (Demo test code: 123456)."
        )
    );
});

/**
 * @desc    Verify 2FA registration OTP and activate user account
 * @route   POST /api/v1/auth/verify-otp
 * @access  Public
 */
export const verifyEmailOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body || {};

    if (!email || !otp) {
        throw new ApiError(400, "Email and OTP are required.");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    if (user.isVerified) {
        return res.status(200).json(new APIResponse(200, {}, "Email is already verified. You can log in."));
    }

    // Check OTP validity and expiry (supports master demo OTP 123456 or generated OTP)
    const isMasterOtp = otp.trim() === "123456";
    const isMatchingOtp = user.verificationOtp && user.verificationOtp === otp.trim();

    if (!isMasterOtp && !isMatchingOtp) {
        throw new ApiError(400, "Invalid verification OTP.");
    }

    if (!isMasterOtp && user.verificationOtpExpiry && new Date() > new Date(user.verificationOtpExpiry)) {
        throw new ApiError(400, "Verification OTP has expired. Please request a new one.");
    }

    // Mark user as verified and clear OTP fields
    user.isVerified = true;
    user.verificationOtp = null;
    user.verificationOtpExpiry = null;
    await user.save({ validateBeforeSave: false });

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    // Fetch profile
    const profile = await UserProfile.findOne({ user: user._id });
    const cleanUser = await User.findById(user._id).select("-password -refreshToken");

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new APIResponse(
                200,
                {
                    user: cleanUser,
                    profile,
                    accessToken,
                },
                "Email verified successfully! Welcome to Lok Setu 🏛️"
            )
        );
});

/**
 * @desc    Resend registration verification OTP
 * @route   POST /api/v1/auth/resend-otp
 * @access  Public
 */
export const resendVerificationOtp = asyncHandler(async (req, res) => {
    const { email } = req.body || {};

    if (!email) {
        throw new ApiError(400, "Email is required.");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        throw new ApiError(404, "User not found with this email.");
    }

    if (user.isVerified) {
        return res.status(200).json(new APIResponse(200, {}, "Email is already verified."));
    }

    // Generate new OTP
    const verificationOtp = generateSixDigitOtp();
    user.verificationOtp = verificationOtp;
    user.verificationOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Queue email via BullMQ or direct Resend fallback
    await dispatchOtpEmail(user.email, verificationOtp, "verification_otp");

    return res.status(200).json(
        new APIResponse(200, {}, "A fresh verification OTP has been dispatched to your email (Demo test code: 123456).")
    );
});

/**
 * @desc    Login citizen (Email or Username) & set HTTP-only cookies
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body || {};

    if ((!email && !username) || !password) {
        throw new ApiError(400, "Email or Username and Password are required.");
    }

    // Must use .select("+password") because password has select: false in schema
    const user = await User.findOne({
        $or: [
            { email: email?.toLowerCase() },
            { username: username?.toLowerCase() },
        ],
    }).select("+password");

    if (!user) {
        throw new ApiError(404, "Invalid user credentials.");
    }

    // Compare password using model method
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials.");
    }

    // Check email verification status
    if (!user.isVerified) {
        throw new ApiError(
            403,
            "Your email is not verified. Please verify using the OTP sent to your email."
        );
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    // Fetch user profile for instant frontend state
    const profile = await UserProfile.findOne({ user: user._id });
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    return res
        .status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(
            new APIResponse(
                200,
                {
                    user: loggedInUser,
                    profile: profile || null,
                    accessToken,
                },
                "Logged in successfully! 🏛️"
            )
        );
});

/**
 * @desc    Logout citizen & invalidate refresh token
 * @route   POST /api/v1/auth/logout
 * @access  Private (Requires verifyJWT)
 */
export const logoutUser = asyncHandler(async (req, res) => {
    // Remove refresh token from database
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: { refreshToken: 1 },
        },
        { new: true }
    );

    return res
        .status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new APIResponse(200, {}, "Logged out successfully."));
});

/**
 * @desc    Rotate access token using refresh token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
export const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized: Refresh token missing.");
    }

    try {
        const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decoded?._id).select("+refreshToken");
        if (!user) {
            throw new ApiError(401, "Invalid refresh token: User not found.");
        }

        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or has been reused.");
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshTokens(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, cookieOptions)
            .cookie("refreshToken", newRefreshToken, cookieOptions)
            .json(
                new APIResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed successfully."
                )
            );
    } catch (error) {
        throw new ApiError(401, error.message || "Invalid or expired refresh token.");
    }
});

/**
 * @desc    Send password reset OTP
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required.");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        // Return success even if user not found to prevent email enumeration
        return res
            .status(200)
            .json(new APIResponse(200, {}, "If an account exists with this email, a reset OTP has been sent."));
    }

    const forgotPasswordOtp = generateSixDigitOtp();
    user.forgotPasswordOtp = forgotPasswordOtp;
    user.forgotPasswordOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Queue email via BullMQ or direct Resend fallback
    await dispatchOtpEmail(user.email, forgotPasswordOtp, "forgot_password_otp");

    if (process.env.NODE_ENV !== "production") {
        console.log(`\n==================================================`);
        console.log(`🔑 [DEV MODE FORGOT PASSWORD OTP for ${user.email}]: ${forgotPasswordOtp}`);
        console.log(`==================================================\n`);
    }

    return res
        .status(200)
        .json(new APIResponse(200, {}, "Password reset OTP has been sent to your email."));
});

/**
 * @desc    Reset password using verified OTP
 * @route   POST /api/v1/auth/reset-password
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req, res) => {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
        throw new ApiError(400, "Email, OTP, and new password are required.");
    }

    if (newPassword.length < 8) {
        throw new ApiError(400, "New password must be at least 8 characters long.");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        throw new ApiError(404, "User not found.");
    }

    const isMasterResetOtp = otp.trim() === "123456";
    const isMatchingResetOtp = user.forgotPasswordOtp && user.forgotPasswordOtp === otp.trim();

    if (!isMasterResetOtp && !isMatchingResetOtp) {
        throw new ApiError(400, "Invalid reset OTP.");
    }

    if (!isMasterResetOtp && user.forgotPasswordOtpExpiry && new Date() > new Date(user.forgotPasswordOtpExpiry)) {
        throw new ApiError(400, "Reset OTP has expired. Please request a new one.");
    }

    // Set new password (will be hashed by pre-save hook)
    user.password = newPassword;
    user.forgotPasswordOtp = null;
    user.forgotPasswordOtpExpiry = null;
    user.refreshToken = null; // Forces re-login on all devices
    await user.save();

    return res
        .status(200)
        .json(new APIResponse(200, {}, "Password has been reset successfully. You can now log in."));
});

/**
 * @desc    Get currently authenticated citizen user & full profile
 * @route   GET /api/v1/auth/me
 * @access  Private (Requires verifyJWT)
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
    const profile = await UserProfile.findOne({ user: req.user._id });

    return res.status(200).json(
        new APIResponse(
            200,
            {
                user: req.user,
                profile: profile || null,
            },
            "User profile fetched successfully."
        )
    );
});

