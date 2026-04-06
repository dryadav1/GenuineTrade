const Exporter = require("../models/Exporter");
const Payment = require("../models/Payment");
const Plan = require("../models/Plan");
const RFQ = require("../models/RFQ");

async function getPlatformStats(req, res) {
  const [exporterCount, rfqCount, planCount, paidCount] = await Promise.all([
    Exporter.countDocuments(),
    RFQ.countDocuments(),
    Plan.countDocuments(),
    Payment.countDocuments({ status: "paid" }),
  ]);

  return res.json({
    exporterCount,
    rfqCount,
    planCount,
    paidCount,
  });
}

module.exports = {
  getPlatformStats,
};
