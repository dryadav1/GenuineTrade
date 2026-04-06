import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
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
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
      default: null
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      required: true,
      default: "USD"
    },
    baseCurrency: {
      type: String,
      default: "USD"
    },
    baseAmount: {
      type: Number,
      required: true
    },
    provider: {
      type: String,
      enum: ["stripe", "razorpay"],
      required: true
    },
    paymentMethod: {
      type: String,
      default: ""
    },
    providerReference: {
      type: String,
      default: ""
    },
    providerOrderId: {
      type: String,
      default: ""
    },
    providerPaymentId: {
      type: String,
      default: ""
    },
    status: {
      type: String,
      enum: [
        "pending",
        "payment_processing",
        "in_escrow",
        "released",
        "disputed",
        "failed",
        "cancelled"
      ],
      default: "pending"
    },
    escrowStatus: {
      type: String,
      enum: ["pending", "held", "released", "disputed", "refunded"],
      default: "pending"
    },
    shipmentMarkedAt: {
      type: Date,
      default: null
    },
    paymentConfirmedAt: {
      type: Date,
      default: null
    },
    releasedAt: {
      type: Date,
      default: null
    },
    disputedAt: {
      type: Date,
      default: null
    },
    disputeReason: {
      type: String,
      trim: true,
      default: ""
    },
    refundStatus: {
      type: String,
      enum: ["not_requested", "requested", "processing", "refunded", "rejected"],
      default: "not_requested"
    },
    refundedAt: {
      type: Date,
      default: null
    },
    refundReference: {
      type: String,
      trim: true,
      default: ""
    },
    refundReason: {
      type: String,
      trim: true,
      default: ""
    },
    providerPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

transactionSchema.index({ buyerId: 1, createdAt: -1 });
transactionSchema.index({ exporterId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, escrowStatus: 1, createdAt: -1 });
transactionSchema.index(
  { provider: 1, providerReference: 1 },
  { unique: true, sparse: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
