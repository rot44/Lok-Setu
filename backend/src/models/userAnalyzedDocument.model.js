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
    fileType: {
      type: String,
      enum: ["pdf", "docx", "image"],
      required: true,
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
      keyRights: [String],
      citizenImpact: [String],
      businessImpact: [String],
      actionItems: [String],
    },

    // Alternative language breakdowns (e.g. English, Marathi, Tamil)
    secondaryExplanations: [
      {
        language: String,
        summary: String,
        keyRights: [String],
        citizenImpact: [String],
        businessImpact: [String],
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

