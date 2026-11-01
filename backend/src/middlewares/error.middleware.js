export const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";

    // 1. Handle MongoDB duplicate key error (code 11000)
    if (err.code === 11000) {
        statusCode = 409;
        const duplicateField = Object.keys(err.keyValue || {})[0] || (err.message.includes("email") ? "email" : "field");
        if (duplicateField === "email") {
            message = "An account with this email address already exists. Please sign in instead.";
        } else if (duplicateField === "username") {
            message = "This username is already taken. Please choose another username.";
        } else {
            message = `A record with this ${duplicateField} already exists. Please use different details.`;
        }
    }

    // 2. Handle Mongoose Validation Errors
    else if (err.name === "ValidationError") {
        statusCode = 400;
        message = Object.values(err.errors || {})
            .map((e) => e.message)
            .join(". ") || "Validation error occurred.";
    }

    // 3. Handle Mongoose CastError (e.g. invalid MongoDB ObjectId)
    else if (err.name === "CastError") {
        statusCode = 400;
        message = `Invalid format provided for ${err.path || "resource ID"}.`;
    }

    // 4. Handle JWT token errors
    else if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Authentication token is invalid. Please sign in again.";
    } else if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Session expired. Please sign in again.";
    }

    // 5. Capture vendor specific error descriptions (e.g., Razorpay)
    else if (err.error && err.error.description) {
        message = err.error.description;
    }

    return res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        errors: err.errors || [],
    });
};
