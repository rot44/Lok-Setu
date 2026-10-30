import mongoose from "mongoose";

const documentChunkSchema = new mongoose.Schema(
  {
    chunkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    totalChunks: {
      type: Number,
      required: true,
      min: 1,
    },
    content: {
      type: String,
      required: [true, "Chunk content text is required"],
      trim: true,
    },
    contentHash: {
      type: String,
      required: true,
      trim: true,
    },
    evidence: {
      startOffset: {
        type: Number,
        default: 0,
      },
      endOffset: {
        type: Number,
        default: 0,
      },
      sectionHeading: {
        type: String,
        default: "",
        trim: true,
      },
      clauseNumber: {
        type: String,
        default: "",
        trim: true,
      },
    },
    metadata: {
      title: {
        type: String,
        default: "",
        trim: true,
      },
      documentType: {
        type: String,
        default: "",
        trim: true,
      },
      jurisdictionLevel: {
        type: String,
        default: "",
        trim: true,
      },
      applicableState: {
        type: String,
        default: "ALL",
        trim: true,
      },
      applicableDistrict: {
        type: String,
        default: "ALL",
        trim: true,
      },
      issuingAuthority: {
        type: String,
        default: "",
        trim: true,
      },
      officialPortalUrl: {
        type: String,
        default: "",
        trim: true,
      },
      originalPdfUrl: {
        type: String,
        default: "",
        trim: true,
      },
      tags: [
        {
          type: String,
          trim: true,
        },
      ],
    },
    embedding: {
      values: {
        type: [Number],
        required: true,
      },
      model: {
        type: String,
        default: "gemini-embedding-001",
        trim: true,
      },
      dimensions: {
        type: Number,
        required: true,
      },
    },
    indexingStatus: {
      type: String,
      enum: ["pending", "indexed", "failed"],
      default: "indexed",
      index: true,
    },
    indexingError: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound uniqueness: guarantees no duplicate chunk sequence for a document
documentChunkSchema.index({ documentId: 1, chunkIndex: 1 }, { unique: true });

// Text index for keyword lookup & hybrid retrieval
documentChunkSchema.index({ content: "text", "metadata.title": "text" });

// Filter indexes for regional & jurisdictional filtering
documentChunkSchema.index({
  "metadata.jurisdictionLevel": 1,
  "metadata.applicableState": 1,
  "metadata.documentType": 1,
});

export const DocumentChunk = mongoose.model("DocumentChunk", documentChunkSchema);
