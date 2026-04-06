import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    planCode: {
      type: String,
      trim: true,
      required: true
    },
    planName: {
      type: String,
      trim: true,
      default: ""
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "annual", "yearly"],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: "USD"
    },
    provider: {
      type: String,
      default: "demo_gateway"
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "paid"
    },
    reference: {
      type: String,
      required: true,
      unique: true
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true
    },
    invoiceUrl: {
      type: String,
      trim: true,
      default: ""
    },
    providerPaymentId: {
      type: String,
      trim: true,
      default: ""
    },
    providerInvoiceId: {
      type: String,
      trim: true,
      default: ""
    },
    paidAt: {
      type: Date,
      default: Date.now
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

paymentSchema.index({ subscriptionId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
