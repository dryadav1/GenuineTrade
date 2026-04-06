const Plan = require("../models/Plan");
const { serializePlan } = require("../utils/serializers");

function normalizeFeatures(features) {
  if (Array.isArray(features)) {
    return features.map((entry) => String(entry).trim()).filter(Boolean);
  }

  return String(features || "")
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function listPlans(req, res) {
  const plans = await Plan.find().sort({ price: 1, createdAt: 1 });
  return res.json(plans.map((plan) => serializePlan(plan)));
}

async function createPlan(req, res) {
  const { name, price, duration, features, isPopular } = req.body || {};

  if (!name || price == null || !duration) {
    return res.status(400).json({ message: "Name, price, and duration are required." });
  }

  const plan = await Plan.create({
    name: String(name).trim(),
    price: Number(price),
    duration,
    features: normalizeFeatures(features),
    isPopular: Boolean(isPopular),
  });

  return res.status(201).json({
    message: "Plan created.",
    plan: serializePlan(plan),
  });
}

async function updatePlan(req, res) {
  const plan = await Plan.findById(req.params.id);

  if (!plan) {
    return res.status(404).json({ message: "Plan not found." });
  }

  const { name, price, duration, features, isPopular } = req.body || {};

  if (name != null) plan.name = String(name).trim();
  if (price != null) plan.price = Number(price);
  if (duration != null) plan.duration = duration;
  if (features != null) plan.features = normalizeFeatures(features);
  if (isPopular != null) plan.isPopular = Boolean(isPopular);

  await plan.save();

  return res.json({
    message: "Plan updated.",
    plan: serializePlan(plan),
  });
}

async function deletePlan(req, res) {
  const plan = await Plan.findById(req.params.id);

  if (!plan) {
    return res.status(404).json({ message: "Plan not found." });
  }

  await plan.deleteOne();
  return res.json({ message: "Plan deleted." });
}

module.exports = {
  createPlan,
  deletePlan,
  listPlans,
  updatePlan,
};
