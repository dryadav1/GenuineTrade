import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    planCode: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    duration: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "USD"
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    features: {
      type: [String],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isPopular: {
      type: Boolean,
      default: false
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

planSchema.index({ planCode: 1, duration: 1 }, { unique: true });
planSchema.index({ isActive: 1, sortOrder: 1, planCode: 1 });

const Plan = mongoose.model("Plan", planSchema);

export default Plan;
