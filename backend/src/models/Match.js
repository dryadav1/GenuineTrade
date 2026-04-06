import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
  {
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
      required: true
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Buyer",
      required: true
    },
    exporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exporter",
      required: true
    },
    productScore: {
      type: Number,
      required: true
    },
    countryScore: {
      type: Number,
      required: true
    },
    trustScore: {
      type: Number,
      required: true
    },
    totalScore: {
      type: Number,
      required: true
    },
    exporterStatusSnapshot: {
      type: String,
      default: ""
    },
    trustBadgeSnapshot: {
      type: String,
      default: ""
    },
    reasons: {
      type: [String],
      default: []
    },
    assignmentSource: {
      type: String,
      enum: ["auto", "manual"],
      default: "auto"
    },
    leadStatus: {
      type: String,
      enum: ["new", "contacted", "quoted", "converted", "lost"],
      default: "new"
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    lastStatusUpdatedAt: {
      type: Date,
      default: null
    },
    lastStatusUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    scoreVersion: {
      type: String,
      default: "phase-1"
    }
  },
  {
    timestamps: true
  }
);

matchSchema.index({ rfqId: 1, totalScore: -1, _id: 1 });
matchSchema.index({ exporterId: 1, createdAt: -1 });
matchSchema.index({ countryScore: -1, trustScore: -1, totalScore: -1 });
matchSchema.index({ leadStatus: 1, createdAt: -1 });

const Match = mongoose.model("Match", matchSchema);

export default Match;
