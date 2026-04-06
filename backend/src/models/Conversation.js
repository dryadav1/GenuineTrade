import mongoose from "mongoose";

const participantStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    unreadCount: {
      type: Number,
      default: 0
    },
    lastReadAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: false
  }
);

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        }
      ],
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2,
        message: "Conversation must include exactly two participants"
      }
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
    rfqId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RFQ",
      default: null
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null
    },
    conversationKey: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    lastMessage: {
      type: String,
      trim: true,
      default: ""
    },
    lastMessageAt: {
      type: Date,
      default: null
    },
    lastMessageSenderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    participantStates: {
      type: [participantStateSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });
conversationSchema.index({ buyerId: 1, exporterId: 1, updatedAt: -1 });
conversationSchema.index({ rfqId: 1, updatedAt: -1 });
conversationSchema.index({ transactionId: 1, updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
