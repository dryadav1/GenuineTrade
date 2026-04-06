import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    actorEmail: {
      type: String,
      trim: true,
      default: ""
    },
    actorAccessLevel: {
      type: String,
      enum: ["super_admin", "sub_admin"],
      default: "sub_admin"
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    targetType: {
      type: String,
      required: true,
      trim: true
    },
    targetId: {
      type: String,
      required: true,
      trim: true
    },
    summary: {
      type: String,
      trim: true,
      default: ""
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

adminLogSchema.index({ action: 1, createdAt: -1 });
adminLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
adminLogSchema.index({ actorAccessLevel: 1, createdAt: -1 });

const AdminLog = mongoose.model("AdminLog", adminLogSchema);

export default AdminLog;
