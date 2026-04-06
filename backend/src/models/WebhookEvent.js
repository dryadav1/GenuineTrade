import mongoose from "mongoose";

const webhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["stripe", "razorpay"],
      required: true
    },
    providerEventId: {
      type: String,
      required: true
    },
    eventType: {
      type: String,
      required: true
    },
    signature: {
      type: String,
      default: ""
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    processingStatus: {
      type: String,
      enum: ["received", "processed", "failed", "ignored"],
      default: "received"
    },
    processedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

webhookEventSchema.index(
  { provider: 1, providerEventId: 1 },
  { unique: true }
);

const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);

export default WebhookEvent;
