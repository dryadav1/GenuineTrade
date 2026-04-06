const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
    orderId: { type: String, required: true, trim: true },
    paymentId: { type: String, default: "", trim: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Payment", paymentSchema);
