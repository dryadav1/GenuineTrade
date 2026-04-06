import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    role: {
      type: String,
      enum: ["exporter", "buyer"],
      required: true
    },
    planCode: {
      type: String,
      trim: true,
      default: "free"
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "annual", "yearly"],
      default: "monthly"
    },
    status: {
      type: String,
      enum: ["inactive", "pending", "active", "expired", "cancelled", "past_due"],
      default: "active"
    },
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: "USD"
    },
    paymentProvider: {
      type: String,
      default: "free_tier"
    },
    providerCustomerId: {
      type: String,
      trim: true,
      default: ""
    },
    providerSubscriptionId: {
      type: String,
      trim: true,
      default: ""
    },
    providerPriceId: {
      type: String,
      trim: true,
      default: ""
    },
    planName: {
      type: String,
      trim: true,
      default: ""
    },
    currentPeriodStart: {
      type: Date,
      default: Date.now
    },
    currentPeriodEnd: {
      type: Date,
      default: null
    },
    nextChargeAt: {
      type: Date,
      default: null
    },
    lastPaymentStatus: {
      type: String,
      enum: ["none", "pending", "paid", "failed", "refunded"],
      default: "none"
    },
    lastPaymentAt: {
      type: Date,
      default: null
    },
    lastReference: {
      type: String,
      trim: true,
      default: ""
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    },
    autoRenew: {
      type: Boolean,
      default: true
    },
    notificationState: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    notes: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

subscriptionSchema.index({ planCode: 1, status: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1, status: 1 });

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
