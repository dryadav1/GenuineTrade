const RFQ = require("../models/RFQ");
const { serializeRfq } = require("../utils/serializers");

async function createRfq(req, res) {
  const { name, product, quantity, country, contact } = req.body || {};

  if (!name || !product || !quantity || !country || !contact) {
    return res
      .status(400)
      .json({ message: "Name, product, quantity, country, and contact are required." });
  }

  const rfq = await RFQ.create({
    userId: req.user?.id || null,
    name: String(name).trim(),
    product: String(product).trim(),
    quantity: String(quantity).trim(),
    country: String(country).trim(),
    contact: String(contact).trim(),
  });

  return res.status(201).json({
    message: "Your quote request has been submitted.",
    rfq: serializeRfq(rfq),
  });
}

module.exports = {
  createRfq,
};
