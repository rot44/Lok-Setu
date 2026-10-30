import mongoose from "mongoose";
import {
  GENDERS,
  MARITAL_STATUSES,
  RELIGIONS,
  CASTE_CATEGORIES,
  INCOME_RANGES,
  RATION_CARD_TYPES,
  OCCUPATIONS,
  LOCALITY_TYPES,
} from "../constants.js";

const userProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // 1-to-1 relationship with User
      index: true,
    },

    // --- Personal & Demographic Details ---
    dob: {
      type: Date,
    },
    age: {
      type: Number,
      min: [0, "Age cannot be negative"],
      max: [120, "Age cannot exceed 120"],
    },
    gender: {
      type: String,
      enum: Object.values(GENDERS),
      default: GENDERS.PREFER_NOT_TO_SAY,
    },
    maritalStatus: {
      type: String,
      enum: Object.values(MARITAL_STATUSES),
      default: MARITAL_STATUSES.SINGLE,
    },
    religion: {
      type: String,
      enum: Object.values(RELIGIONS),
      default: RELIGIONS.OTHER,
    },
    caste: {
      type: String,
      enum: Object.values(CASTE_CATEGORIES),
      default: CASTE_CATEGORIES.GENERAL,
      index: true,
    },

    // --- Divyangjan / Specially Abled Details ---
    isSpeciallyAbled: {
      type: Boolean,
      default: false,
    },
    disabilityPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // --- Location Details ---
    state: {
      type: String,
      required: [true, "State is required"],
      trim: true,
      index: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      index: true,
    },
    location: {
      area: {
        type: String,
        trim: true,
      },
      pincode: {
        type: String,
        trim: true,
      },
      localityType: {
        type: String,
        enum: Object.values(LOCALITY_TYPES),
        default: LOCALITY_TYPES.URBAN,
      },
    },

    // --- Financial & Welfare Bracket ---
    incomeRange: {
      type: String,
      enum: Object.values(INCOME_RANGES),
      default: INCOME_RANGES.BELOW_1_LAKH,
      index: true,
    },
    rationCardType: {
      type: String,
      enum: Object.values(RATION_CARD_TYPES),
      default: RATION_CARD_TYPES.NONE,
    },

    // --- Occupation & Livelihood Details ---
    occupation: {
      type: String,
      enum: Object.values(OCCUPATIONS),
      default: OCCUPATIONS.OTHER,
      index: true,
    },
    isBusinessOwner: {
      type: Boolean,
      default: false,
    },
    isFarmer: {
      type: Boolean,
      default: false,
    },

    // --- Preferred Languages (1, 2, and 3) ---
    preferredLanguages: {
      primary: {
        type: String,
        required: true,
        default: "hi", // Voice explainers and primary text default to this
      },
      secondary: {
        type: String,
        default: "en", // Alternative explanation option
      },
      tertiary: {
        type: String,
        default: null, // Additional regional dialect
      },
    },

    // --- Dashboard Tracking & Saved Schemes ---
    savedSchemes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Document",
      },
    ],
    audioHistory: [
      {
        documentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Document",
        },
        playedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    isProfileComplete: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index for fast Dashboard Scheme Matching
userProfileSchema.index({
  state: 1,
  caste: 1,
  occupation: 1,
  "location.localityType": 1,
});

export const UserProfile = mongoose.model("UserProfile", userProfileSchema);

