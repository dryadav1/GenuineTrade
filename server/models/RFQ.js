const mongoose = require("mongoose");

const rfqSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    name: { type: String, required: true, trim: true },
    product: { type: String, required: true, trim: true },
    quantity: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    contact: { type: String, required: true, trim: true },
    status: { type: String, enum: ["open", "reviewed"], default: "open" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RFQ", rfqSchema);
