const mongoose = require("mongoose");

const exporterSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    product: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    status: { type: String, enum: ["pending", "verified"], default: "pending" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Exporter", exporterSchema);
