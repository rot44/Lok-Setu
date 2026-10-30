import mongoose from "mongoose";
import { CHAT_SESSION_MODES } from "../constants.js";

const citationSchema = new mongoose.Schema(
  {
    chunkId: { type: String, required: true },
    documentId: { type: String, default: "" },
    title: { type: String, default: "" },
    issuingAuthority: { type: String, default: null },
    sectionHeading: { type: String, default: null },
    clauseNumber: { type: String, default: null },
    startOffset: { type: Number, default: 0 },
    endOffset: { type: Number, default: 0 },
    sourceUrl: { type: String, default: null },
  },
  { _id: false }
);

const groundedAnalysisSchema = new mongoose.Schema(
  {
    summary: { type: String, default: "" },
    sourceFacts: [{ type: String }],
    interpretation: { type: String, default: "" },
    limitations: [{ type: String }],
    citations: [citationSchema],
    insufficientEvidence: { type: Boolean, default: false },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ["user", "assistant", "system"],
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  // Card 3: File Attachment (PDF, Image, or DOCX uploaded by citizen)
  attachment: {
    fileUrl: {
      type: String, // S3 URL of uploaded file
    },
    fileName: {
      type: String,
    },
    fileType: {
      type: String,
      enum: ["pdf", "docx", "image", "text", null],
      default: null,
    },
    s3Key: {
      type: String,
    },
  },
  // Voice output (Assistant speaking in regional language)
  audioUrl: {
    type: String, // S3 link for generated assistant voice reply
  },
  languageUsed: {
    type: String,
    default: "en",
  },
  // Grounded analysis breakdown (Commit 8/9 structured output)
  analysis: {
    type: groundedAnalysisSchema,
    default: null,
  },
  // Citations / Scheme recommendations made by AI
  recommendedSchemes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
    },
  ],
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const aiChatSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Allows guest visitors to try without signing in
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Secure token hash for guest session authorization (SHA-256)
    guestTokenHash: {
      type: String,
      default: null,
      select: false, // Excluded from default queries for security
    },
    // Context mode derived from Home page card triggers
    sessionMode: {
      type: String,
      enum: Object.values(CHAT_SESSION_MODES),
      default: CHAT_SESSION_MODES.GENERAL_QUERY,
      index: true,
    },
    // Snapshot of user profile injected on Card 1 (Check Eligibility)
    injectedUserProfileContext: {
      type: Object,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    messages: [chatMessageSchema],
  },
  { timestamps: true }
);

export const AiChatSession = mongoose.model("AiChatSession", aiChatSessionSchema);
