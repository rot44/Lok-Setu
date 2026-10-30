import mongoose from "mongoose";
import {
  DOCUMENT_TYPES,
  JURISDICTION_LEVELS,
} from "../constants.js";

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Document / Scheme title is required"],
      trim: true,
      index: "text", // Enables full-text search on Card 2 (Explore Schemes)
    },
    documentType: {
      type: String,
      required: [true, "Document type is required"],
      enum: Object.values(DOCUMENT_TYPES),
      index: true,
    },
    jurisdictionLevel: {
      type: String,
      enum: Object.values(JURISDICTION_LEVELS),
      required: true,
      index: true,
    },
    applicableState: {
      type: String,
      default: "ALL", // "ALL" for Central, or specific state like "Uttar Pradesh"
      index: true,
    },
    applicableDistrict: {
      type: String,
      default: "ALL", // "ALL" or specific district like "Varanasi"
    },
    issuingAuthority: {
      type: String,
      required: [true, "Issuing authority is required"],
      trim: true,
    },

    // --- Eligibility Rules (Enables Card 1: Check Eligibility Matching) ---
    eligibilityRules: {
      minAge: {
        type: Number,
        default: 0,
      },
      maxAge: {
        type: Number,
        default: 120,
      },
      genders: [
        {
          type: String,
          default: ["ALL"],
        },
      ],
      castes: [
        {
          type: String,
          default: ["ALL"],
        },
      ],
      religions: [
        {
          type: String,
          default: ["ALL"],
        },
      ],
      occupations: [
        {
          type: String,
          default: ["ALL"],
        },
      ],
      maxAnnualIncome: {
        type: String,
        default: "any",
      },
      requiresRationCard: {
        type: Boolean,
        default: false,
      },
      requiresDisabilityStatus: {
        type: Boolean,
        default: false,
      },
    },

    // --- Original Content & S3 Storage Links ---
    originalPdfUrl: {
      type: String, // Amazon S3 or CDN link to original government gazette / circular
    },
    rawExtractedText: {
      type: String,
      required: [true, "Raw extracted text is required for Gemini AI analysis"],
    },
    officialPortalUrl: {
      type: String, // Direct government application portal URL
    },

    // --- Dates & Timelines ---
    notificationDate: {
      type: Date,
      default: Date.now,
    },
    applicationDeadline: {
      type: Date,
      default: null, // Null indicates ongoing / permanent policy
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // --- Indexing & Vector Search Metadata (Commit 5) ---
    indexingStatus: {
      type: String,
      enum: ["unindexed", "indexing", "indexed", "failed"],
      default: "unindexed",
      index: true,
    },
    indexedChunkCount: {
      type: Number,
      default: 0,
    },
    lastIndexedAt: {
      type: Date,
      default: null,
    },
    indexingError: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound Index for Card 4: Stay Notified (Within 1 week query & sorting)
documentSchema.index({ createdAt: -1, isActive: 1 });

// Compound Index for Card 2: Explore Schemes (Jurisdiction + State + Document Type filtering)
documentSchema.index({
  jurisdictionLevel: 1,
  applicableState: 1,
  documentType: 1,
});

export const Document = mongoose.model("Document", documentSchema);
