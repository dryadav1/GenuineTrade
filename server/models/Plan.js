const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    duration: { type: String, enum: ["monthly", "yearly"], required: true },
    features: { type: [String], default: [] },
    isPopular: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Plan", planSchema);
