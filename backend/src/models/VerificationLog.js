import mongoose from "mongoose";

const verificationLogSchema = new mongoose.Schema(
  {
    exporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exporter",
      required: true,
      index: true
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VerificationDocument",
      default: null
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    documentType: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      default: "",
      trim: true
    },
    remarks: {
      type: String,
      default: "",
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

verificationLogSchema.index({ exporterId: 1, createdAt: -1 });

const VerificationLog = mongoose.model("VerificationLog", verificationLogSchema);

export default VerificationLog;
