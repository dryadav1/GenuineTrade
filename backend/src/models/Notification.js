import mongoose from "mongoose";

const channelDeliverySchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ["pending", "skipped", "sent", "failed"],
      default: "pending"
    },
    recipient: {
      type: String,
      trim: true,
      default: ""
    },
    attemptedAt: {
      type: Date,
      default: null
    },
    deliveredAt: {
      type: Date,
      default: null
    },
    error: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    _id: false
  }
);

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    type: {
      type: String,
      default: "system"
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "critical"],
      default: "normal"
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: String,
      required: true,
      trim: true
    },
    actionUrl: {
      type: String,
      default: ""
    },
    entityType: {
      type: String,
      default: ""
    },
    entityId: {
      type: String,
      default: ""
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    delivery: {
      inApp: {
        type: channelDeliverySchema,
        default: () => ({ enabled: true, status: "pending" })
      },
      email: {
        type: channelDeliverySchema,
        default: () => ({ enabled: false, status: "skipped" })
      },
      sms: {
        type: channelDeliverySchema,
        default: () => ({ enabled: false, status: "skipped" })
      }
    },
    audience: {
      type: String,
      trim: true,
      default: ""
    },
    isBroadcast: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ["unread", "read"],
      default: "unread"
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
