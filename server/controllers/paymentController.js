const crypto = require("crypto");
const Payment = require("../models/Payment");
const Plan = require("../models/Plan");
const User = require("../models/User");
const { sanitizeUser, serializePayment, serializePlan } = require("../utils/serializers");

function getRazorpayConfig() {
  return {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
  };
}

function addPlanDuration(startDate, duration) {
  const next = new Date(startDate);

  if (duration === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
    return next;
  }

  next.setMonth(next.getMonth() + 1);
  return next;
}

async function createOrder(req, res) {
  const { keyId, keySecret } = getRazorpayConfig();

  if (!keyId || !keySecret) {
    return res.status(503).json({ message: "Razorpay is not configured on the server." });
  }

  const { planId } = req.body || {};
  const user = await User.findById(req.user.id);
  const plan = await Plan.findById(planId);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (!plan) {
    return res.status(404).json({ message: "Plan not found." });
  }

  const amount = Math.round(Number(plan.price || 0) * 100);
  const receipt = `gt_${user._id.toString().slice(-6)}_${Date.now()}`;
  const authToken = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      currency: "INR",
      receipt,
      notes: {
        userId: user._id.toString(),
        planId: plan._id.toString(),
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    return res.status(502).json({ message: "Failed to create Razorpay order.", details });
  }

  const order = await response.json();
  const payment = await Payment.create({
    userId: user._id,
    planId: plan._id,
    orderId: order.id,
    amount: Number(plan.price || 0),
    status: "created",
  });

  return res.status(201).json({
    keyId,
    order,
    plan: serializePlan(plan),
    payment: serializePayment(payment),
  });
}

async function verifyPayment(req, res) {
  const { keySecret } = getRazorpayConfig();

  if (!keySecret) {
    return res.status(503).json({ message: "Razorpay is not configured on the server." });
  }

  const { planId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!planId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ message: "Missing Razorpay payment confirmation fields." });
  }

  const generatedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (generatedSignature !== razorpay_signature) {
    return res.status(400).json({ message: "Invalid Razorpay signature." });
  }

  const [user, plan] = await Promise.all([
    User.findById(req.user.id).populate("currentPlan"),
    Plan.findById(planId),
  ]);

  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (!plan) {
    return res.status(404).json({ message: "Plan not found." });
  }

  let payment = await Payment.findOne({
    userId: user._id,
    orderId: razorpay_order_id,
  }).populate("planId");

  if (!payment) {
    payment = await Payment.create({
      userId: user._id,
      planId: plan._id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      amount: Number(plan.price || 0),
      status: "paid",
    });
    payment = await payment.populate("planId");
  } else {
    payment.planId = plan._id;
    payment.paymentId = razorpay_payment_id;
    payment.amount = Number(plan.price || 0);
    payment.status = "paid";
    await payment.save();
    payment = await payment.populate("planId");
  }

  user.currentPlan = plan._id;
  user.planExpiry = addPlanDuration(new Date(), plan.duration);
  await user.save();

  const updatedUser = await User.findById(user._id).populate("currentPlan");

  return res.json({
    message: "Payment verified successfully.",
    user: sanitizeUser(updatedUser),
    payment: serializePayment(payment),
  });
}

async function listMyPayments(req, res) {
  const payments = await Payment.find({ userId: req.user.id }).populate("planId").sort({ createdAt: -1 });
  return res.json(payments.map((payment) => serializePayment(payment)));
}

module.exports = {
  createOrder,
  listMyPayments,
  verifyPayment,
};
