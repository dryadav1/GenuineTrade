import Exporter from "../models/Exporter.js";
import Match from "../models/Match.js";
import {
  getVerificationDocumentForActor,
  hydrateExporterVerification,
  submitExporterKycForReview,
  uploadVerificationDocument
} from "../services/verificationService.js";
import {
  getSubscriptionSnapshot,
  getUserPayments,
  serializePlanCatalog
} from "../services/subscriptionService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseProducts } from "../utils/matchHelpers.js";
import { createPaginationMeta, parsePagination } from "../utils/pagination.js";
import {
  serializeExporter,
  serializeMatch,
  serializeVerificationDocument
} from "../utils/serializers.js";

const getExporterForUser = (userId) =>
  Exporter.findOne({ userId }).populate("userId", "email phone role publicId");

export const getExporterDashboard = asyncHandler(async (req, res) => {
  const exporter = await getExporterForUser(req.user._id);

  if (!exporter) {
    res.status(404).json({ message: "Exporter profile not found" });
    return;
  }

  await hydrateExporterVerification(exporter);

  const [incomingMatches, matchedRFQCount] = await Promise.all([
    Match.find({ exporterId: exporter._id })
      .populate({
        path: "buyerId",
        populate: {
          path: "userId",
          select: "email phone role publicId"
        }
      })
      .populate("rfqId")
      .sort({ createdAt: -1 })
      .limit(5),
    Match.countDocuments({ exporterId: exporter._id })
  ]);

  res.json({
    exporter: serializeExporter(exporter),
    stats: {
      matchedRFQs: matchedRFQCount,
      profileViews: exporter.profileViews || 0,
      trustScore: exporter.trustScore
    },
    incomingMatches: incomingMatches.map(serializeMatch),
    subscription: await getSubscriptionSnapshot(req.user),
    payments: await getUserPayments(req.user._id),
    plans: await serializePlanCatalog()
  });
});

export const getExporterMatches = asyncHandler(async (req, res) => {
  const exporter = await Exporter.findOne({ userId: req.user._id });

  if (!exporter) {
    res.status(404).json({ message: "Exporter profile not found" });
    return;
  }

  const { page, limit, skip } = parsePagination(req.query);
  const [matches, total] = await Promise.all([
    Match.find({ exporterId: exporter._id })
      .populate({
        path: "buyerId",
        populate: {
          path: "userId",
          select: "email phone role publicId"
        }
      })
      .populate("rfqId")
      .sort({ totalScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Match.countDocuments({ exporterId: exporter._id })
  ]);

  res.json({
    items: matches.map(serializeMatch),
    pagination: createPaginationMeta({ page, limit, total })
  });
});

export const updateExporterProfile = asyncHandler(async (req, res) => {
  const exporter = await getExporterForUser(req.user._id);

  if (!exporter) {
    res.status(404).json({ message: "Exporter profile not found" });
    return;
  }

  const {
    companyName,
    country,
    gstNumber,
    iecCode,
    products,
    certifications
  } = req.body;

  if (typeof companyName === "string" && companyName.trim()) {
    exporter.companyName = companyName.trim();
  }

  if (typeof country === "string" && country.trim()) {
    exporter.country = country.trim();
  }

  if (typeof gstNumber === "string" && gstNumber.trim()) {
    exporter.gstNumber = gstNumber.trim();
  }

  if (typeof iecCode === "string" && iecCode.trim()) {
    exporter.iecCode = iecCode.trim();
  }

  if (products !== undefined) {
    exporter.products = parseProducts(products);
  }

  if (certifications !== undefined) {
    exporter.certifications = parseProducts(certifications);
  }

  await exporter.save();
  await hydrateExporterVerification(exporter);

  res.json({
    message: "Exporter profile updated successfully",
    exporter: serializeExporter(exporter)
  });
});

export const uploadMyVerificationDocument = asyncHandler(async (req, res) => {
  const exporter = await getExporterForUser(req.user._id);

  if (!exporter) {
    res.status(404).json({ message: "Exporter profile not found" });
    return;
  }

  const { documentType, fileName, mimeType, fileBase64 } = req.body;
  const document = await uploadVerificationDocument({
    user: req.user,
    exporter,
    documentType,
    fileName,
    mimeType,
    fileBase64
  });

  const hydratedExporter = await hydrateExporterVerification(exporter);
  const latestDocument =
    hydratedExporter.verificationDocuments.find(
      (item) => item._id.toString() === document._id.toString()
    ) || document;

  res.status(201).json({
    message: "Verification document uploaded",
    document: serializeVerificationDocument(latestDocument),
    exporter: serializeExporter(hydratedExporter)
  });
});

export const submitMyKycForReview = asyncHandler(async (req, res) => {
  const exporter = await getExporterForUser(req.user._id);

  if (!exporter) {
    res.status(404).json({ message: "Exporter profile not found" });
    return;
  }

  const hydratedExporter = await submitExporterKycForReview({
    user: req.user,
    exporter
  });

  res.json({
    message: "KYC submitted for admin review",
    exporter: serializeExporter(hydratedExporter)
  });
});

export const downloadVerificationDocument = asyncHandler(async (req, res) => {
  const { document, absolutePath } = await getVerificationDocumentForActor({
    actor: req.user,
    documentId: req.params.documentId
  });

  res.type(document.mimeType);
  res.download(absolutePath, document.fileName);
});
