import mongoose from "mongoose";

const paymentIntentSchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      required: true
    },
    provider: {
      type: String,
      enum: ["stripe", "razorpay"],
      required: true
    },
    country: {
      type: String,
      default: ""
    },
    amount: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      required: true
    },
    supportedMethods: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ["created", "requires_action", "succeeded", "failed"],
      default: "created"
    },
    clientSecret: {
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
    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    expiresAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

paymentIntentSchema.index({ transactionId: 1, createdAt: -1 });
paymentIntentSchema.index(
  { provider: 1, providerReference: 1 },
  { unique: true, sparse: true }
);

const PaymentIntent = mongoose.model("PaymentIntent", paymentIntentSchema);

export default PaymentIntent;
