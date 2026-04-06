const Exporter = require("../models/Exporter");
const { serializeExporter } = require("../utils/serializers");

async function createExporter(req, res) {
  const { name, companyName, product, country, contact } = req.body || {};

  if (!name || !companyName || !product || !country || !contact) {
    return res
      .status(400)
      .json({ message: "Name, company name, product, country, and contact are required." });
  }

  const exporter = await Exporter.create({
    userId: req.user?.id || null,
    name: String(name).trim(),
    companyName: String(companyName).trim(),
    product: String(product).trim(),
    country: String(country).trim(),
    contact: String(contact).trim(),
  });

  return res.status(201).json({
    message: "Exporter profile submitted for verification.",
    exporter: serializeExporter(exporter),
  });
}

module.exports = {
  createExporter,
};
