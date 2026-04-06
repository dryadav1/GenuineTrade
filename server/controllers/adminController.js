const Exporter = require("../models/Exporter");
const Payment = require("../models/Payment");
const RFQ = require("../models/RFQ");
const User = require("../models/User");
const { sanitizeUser, serializeExporter, serializePayment, serializeRfq } = require("../utils/serializers");

async function listAdminExporters(req, res) {
  const exporters = await Exporter.find().sort({ createdAt: -1 });
  return res.json(exporters.map((entry) => serializeExporter(entry)));
}

async function listAdminUsers(req, res) {
  const users = await User.find().populate("currentPlan").sort({ createdAt: -1 });
  return res.json(users.map((entry) => sanitizeUser(entry)));
}

async function listAdminRfqs(req, res) {
  const rfqs = await RFQ.find().sort({ createdAt: -1 });
  return res.json(rfqs.map((entry) => serializeRfq(entry)));
}

async function listAdminPayments(req, res) {
  const payments = await Payment.find().populate("planId").sort({ createdAt: -1 });
  return res.json(payments.map((entry) => serializePayment(entry)));
}

module.exports = {
  listAdminExporters,
  listAdminPayments,
  listAdminRfqs,
  listAdminUsers,
};
