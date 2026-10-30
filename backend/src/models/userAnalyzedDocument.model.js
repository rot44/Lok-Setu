import mongoose from "mongoose";

const userAnalyzedDocumentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String, // Amazon S3 URL of citizen's uploaded document
      required: true,
    },
    s3Key: {
      type: String,
    },
    fileHash: {
      type: String, // SHA-256 for deduplication
      index: true,
    },
    status: {
      type: String,
      enum: ["uploaded", "processing", "analyzed", "failed", "requires_ocr"],
      default: "uploaded",
      index: true,
    },
    fileType: {
      type: String,
      enum: ["pdf", "docx", "image", "text"],
      required: true,
    },
    requiresOcr: {
      type: Boolean,
      default: false,
    },
    ocrNotice: {
      type: String,
    },
    analysisError: {
      type: String,
    },
    rawExtractedText: {
      type: String,
    },

    // Explanation in User's Primary Language
    primaryExplanation: {
      language: {
        type: String,
        default: "hi",
      },
      summary: {
        type: String,
      },
      noticeFacts: [String],
      datesAndDeadlines: [String],
      actionItems: [String],
      penalties: [String],
      keyRights: [String],
      citizenImpact: mongoose.Schema.Types.Mixed,
      businessImpact: mongoose.Schema.Types.Mixed,
      missingInformation: [String],
      citations: [mongoose.Schema.Types.Mixed],
      disclaimer: String,
      requiresOcr: Boolean,
    },

    // Alternative language breakdowns (e.g. English, Marathi, Tamil)
    secondaryExplanations: [
      {
        language: String,
        summary: String,
        keyRights: [String],
        citizenImpact: mongoose.Schema.Types.Mixed,
        businessImpact: mongoose.Schema.Types.Mixed,
        actionItems: [String],
        penalties: [String],
        citations: [mongoose.Schema.Types.Mixed],
      },
    ],

    // Generated Voice Audio on S3
    audioUrl: {
      type: String,
    },
    audioS3Key: {
      type: String,
    },
    voiceName: {
      type: String,
    },
  },
  { timestamps: true }
);

export const UserAnalyzedDocument = mongoose.model(
  "UserAnalyzedDocument",
  userAnalyzedDocumentSchema
);
