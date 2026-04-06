import Buyer from "../models/Buyer.js";
import Match from "../models/Match.js";
import RFQ from "../models/RFQ.js";
import {
  getBuyerExporterProfile,
  getRecommendedExportersForBuyer,
  getSavedExportersForBuyer,
  searchExportersForBuyer,
  toggleSavedExporter
} from "../services/buyerDiscoveryService.js";
import {
  getSubscriptionAccessSnapshot,
  getSubscriptionSnapshot,
  getUserPayments,
  serializePlanCatalog
} from "../services/subscriptionService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseProducts } from "../utils/matchHelpers.js";
import { createPaginationMeta, parsePagination } from "../utils/pagination.js";
import { serializeBuyer, serializeExporter, serializeMatch, serializeRFQ } from "../utils/serializers.js";

const getBuyerForUser = (userId) =>
  Buyer.findOne({ userId }).populate("userId", "email phone role publicId");

export const getBuyerDashboard = asyncHandler(async (req, res) => {
  const buyer = await getBuyerForUser(req.user._id);

  if (!buyer) {
    res.status(404).json({ message: "Buyer profile not found" });
    return;
  }

  const accessSnapshot = await getSubscriptionAccessSnapshot(req.user);

  const [recentRFQs, recentMatches, totalRFQs, totalMatches, recommendedExporters, savedExporters] =
    await Promise.all([
      RFQ.find({ buyerId: buyer._id }).sort({ createdAt: -1 }).limit(5),
      Match.find({ buyerId: buyer._id })
        .populate({
          path: "exporterId",
          populate: {
            path: "userId",
            select: "email phone role publicId"
          }
        })
        .populate("rfqId")
        .sort({ createdAt: -1, totalScore: -1 })
        .limit(5),
      RFQ.countDocuments({ buyerId: buyer._id }),
      Match.countDocuments({ buyerId: buyer._id }),
      getRecommendedExportersForBuyer({
        buyer,
        accessSnapshot,
        limit: 5
      }),
      getSavedExportersForBuyer({ buyer })
    ]);

  res.json({
    buyer: serializeBuyer(buyer),
    stats: {
      totalRFQs,
      totalMatches,
      savedExporters: buyer.savedExporterIds?.length || 0
    },
    recentRFQs: recentRFQs.map(serializeRFQ),
    recentMatches: recentMatches.map(serializeMatch),
    suggestedExporters: recommendedExporters.map(serializeExporter),
    savedExporters: savedExporters.map(serializeExporter),
    subscription: await getSubscriptionSnapshot(req.user),
    discoveryAccess: accessSnapshot
      ? {
          planCode: accessSnapshot.plan.code,
          planName: accessSnapshot.plan.name
        }
      : null,
    payments: await getUserPayments(req.user._id),
    plans: await serializePlanCatalog()
  });
});

export const updateBuyerProfile = asyncHandler(async (req, res) => {
  const buyer = await getBuyerForUser(req.user._id);

  if (!buyer) {
    res.status(404).json({ message: "Buyer profile not found" });
    return;
  }

  const {
    companyName,
    country,
    businessId,
    businessType,
    importProducts,
    certifications
  } = req.body;

  if (typeof companyName === "string" && companyName.trim()) {
    buyer.companyName = companyName.trim();
  }

  if (typeof country === "string" && country.trim()) {
    buyer.country = country.trim();
  }

  if (typeof businessId === "string") {
    buyer.businessId = businessId.trim();
  }

  if (typeof businessType === "string") {
    buyer.businessType = businessType.trim();
  }

  if (importProducts !== undefined) {
    buyer.importProducts = parseProducts(importProducts);
  }

  if (certifications !== undefined) {
    buyer.certifications = parseProducts(certifications);
  }

  await buyer.save();

  res.json({
    message: "Buyer profile updated successfully",
    buyer: serializeBuyer(buyer)
  });
});

export const getBuyerExporterDiscovery = asyncHandler(async (req, res) => {
  const buyer = await getBuyerForUser(req.user._id);

  if (!buyer) {
    res.status(404).json({ message: "Buyer profile not found" });
    return;
  }

  const { page, limit } = parsePagination(req.query);
  const discovery = await searchExportersForBuyer({
    buyer,
    accessSnapshot: req.subscriptionAccess || (await getSubscriptionAccessSnapshot(req.user)),
    page,
    limit,
    filters: req.query
  });

  res.json({
    items: discovery.items.map(serializeExporter),
    access: discovery.access,
    pagination: createPaginationMeta({
      page,
      limit,
      total: discovery.total
    })
  });
});

export const getBuyerSavedExporters = asyncHandler(async (req, res) => {
  const buyer = await getBuyerForUser(req.user._id);

  if (!buyer) {
    res.status(404).json({ message: "Buyer profile not found" });
    return;
  }

  const exporters = await getSavedExportersForBuyer({ buyer });

  res.json({
    items: exporters.map(serializeExporter)
  });
});

export const getBuyerExporterProfileDetail = asyncHandler(async (req, res) => {
  const buyer = await getBuyerForUser(req.user._id);

  if (!buyer) {
    res.status(404).json({ message: "Buyer profile not found" });
    return;
  }

  const exporter = await getBuyerExporterProfile({
    buyer,
    buyerUser: req.user,
    exporterId: req.params.exporterId
  });

  res.json({
    exporter: serializeExporter(exporter)
  });
});

export const toggleSavedExporterForBuyer = asyncHandler(async (req, res) => {
  const buyer = await getBuyerForUser(req.user._id);

  if (!buyer) {
    res.status(404).json({ message: "Buyer profile not found" });
    return;
  }

  const result = await toggleSavedExporter({
    buyer,
    exporterId: req.params.exporterId
  });

  res.json({
    message: result.isSaved
      ? "Exporter saved successfully"
      : "Exporter removed from saved list",
    isSaved: result.isSaved,
    savedExporterCount: result.savedExporterCount,
    exporter: serializeExporter(result.exporter)
  });
});

export const getBuyerRFQs = asyncHandler(async (req, res) => {
  const buyer = await Buyer.findOne({ userId: req.user._id });

  if (!buyer) {
    res.status(404).json({ message: "Buyer profile not found" });
    return;
  }

  const { page, limit, skip } = parsePagination(req.query);
  const [rfqs, total] = await Promise.all([
    RFQ.find({ buyerId: buyer._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    RFQ.countDocuments({ buyerId: buyer._id })
  ]);

  res.json({
    items: rfqs.map(serializeRFQ),
    pagination: createPaginationMeta({ page, limit, total })
  });
});
