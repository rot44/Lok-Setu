import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { USER_ROLES } from "../constants.js";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // Ensures password is never returned by default in queries
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.CITIZEN,
      index: true,
    },

    // Email verification (2FA registration OTP)
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationOtp: {
      type: String,
      default: null,
    },
    verificationOtpExpiry: {
      type: Date,
      default: null,
    },

    // Password reset OTP
    forgotPasswordOtp: {
      type: String,
      default: null,
    },
    forgotPasswordOtpExpiry: {
      type: Date,
      default: null,
    },

    refreshToken: {
      type: String,
      select: false,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next ? next() : undefined;
  this.password = await bcrypt.hash(this.password, 10);
  if (next) next();
});

// Compare entered password with hashed password
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Generate short-lived JWT Access Token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1d" }
  );
};

// Generate long-lived JWT Refresh Token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d" }
  );
};

export const User = mongoose.model("User", userSchema);

