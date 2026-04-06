import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: ""
    },
    url: {
      type: String,
      trim: true,
      default: ""
    },
    type: {
      type: String,
      trim: true,
      default: ""
    },
    mimeType: {
      type: String,
      trim: true,
      default: ""
    },
    size: {
      type: Number,
      default: 0
    }
  },
  {
    _id: false
  }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
      index: true
    },
    threadId: {
      type: String,
      required: true,
      trim: true
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
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    body: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000
    },
    attachments: {
      type: [attachmentSchema],
      default: []
    },
    readBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: []
    }
  },
  {
    timestamps: true
  }
);

messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ threadId: 1, createdAt: -1 });
messageSchema.index({ buyerId: 1, createdAt: -1 });
messageSchema.index({ exporterId: 1, createdAt: -1 });
messageSchema.index({ transactionId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
