import mongoose from "mongoose";

const reviewHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true
    },
    remarks: {
      type: String,
      trim: true,
      default: ""
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reviewedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    _id: false
  }
);

const verificationDocumentSchema = new mongoose.Schema(
  {
    exporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exporter",
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    documentType: {
      type: String,
      enum: ["iec", "gst", "bank_proof"],
      required: true,
      index: true
    },
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    storagePath: {
      type: String,
      required: true,
      trim: true
    },
    mimeType: {
      type: String,
      required: true,
      trim: true
    },
    sizeBytes: {
      type: Number,
      required: true
    },
    version: {
      type: Number,
      default: 1
    },
    isLatest: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ["uploaded", "under_review", "approved", "rejected", "changes_requested"],
      default: "uploaded",
      index: true
    },
    reviewRemarks: {
      type: String,
      trim: true,
      default: ""
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    validation: {
      formatValid: {
        type: Boolean,
        default: true
      },
      status: {
        type: String,
        enum: ["valid", "invalid", "not_applicable"],
        default: "not_applicable"
      },
      issues: {
        type: [String],
        default: []
      },
      fieldValue: {
        type: String,
        trim: true,
        default: ""
      }
    },
    reviewHistory: {
      type: [reviewHistorySchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

verificationDocumentSchema.index(
  { exporterId: 1, documentType: 1, isLatest: 1 },
  { unique: true, partialFilterExpression: { isLatest: true } }
);

const VerificationDocument = mongoose.model(
  "VerificationDocument",
  verificationDocumentSchema
);

export default VerificationDocument;
