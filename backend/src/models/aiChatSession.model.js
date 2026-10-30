import mongoose from "mongoose";
import { CHAT_SESSION_MODES } from "../constants.js";

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
    default: "hi",
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
    messages: [chatMessageSchema],
  },
  { timestamps: true }
);

export const AiChatSession = mongoose.model("AiChatSession", aiChatSessionSchema);

