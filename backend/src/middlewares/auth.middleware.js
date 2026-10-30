import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";

// Verifies the json web token to authenticate users and attach user data to the request
const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            throw new ApiError(401, "Unauthorised Request\n");
        }
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken._id).select("-password -refreshToken");

        if (!user) {
            throw new ApiError(401, "Invalid Access Token\n");
        }
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access Token\n");
    }
});

// Verifies the role of the user using the verifyJWT middleware
const verifyRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        throw new ApiError(403, "Access denied. Insufficient permissions.");
    }
    next();
};

/**
 * Optional authentication middleware.
 * If a valid JWT is provided in headers/cookies, populates req.user.
 * Otherwise, sets req.user to null and allows guest requests to proceed safely.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        if (!token) {
            req.user = null;
            return next();
        }
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken._id).select("-password -refreshToken");
        req.user = user || null;
        next();
    } catch {
        req.user = null;
        next();
    }
});

export { verifyJWT, verifyRole, optionalAuth };
