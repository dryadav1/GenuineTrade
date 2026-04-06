import Exporter from "../models/Exporter.js";
import RFQ from "../models/RFQ.js";
import { cacheService } from "./cacheService.js";
import { createAuditLog } from "./auditService.js";
import { createNotification } from "./notificationService.js";
import { getActiveSubscriptionBoostMap } from "./subscriptionService.js";
import { createHttpError } from "../utils/httpErrors.js";
import {
  createProductSearchTerms,
  normalizeCountry,
  normalizeValue,
  parseProducts
} from "../utils/matchHelpers.js";

const discoveryResultCapByPlan = {
  free: 6,
  starter: 24,
  growth: 60,
  enterprise: 90,
  professional: 60,
  scale: 90
};

const uniqueValues = (values = []) => Array.from(new Set(values.filter(Boolean)));

const roundScore = (value) => Math.round(Number(value || 0) * 1000) / 1000;

const getDiscoveryCap = (planCode = "free") =>
  discoveryResultCapByPlan[planCode] || discoveryResultCapByPlan.free;

const getRecentBuyerSignals = async (buyer) => {
  const recentRfqs = await RFQ.find({ buyerId: buyer._id })
    .sort({ createdAt: -1 })
    .limit(8)
    .select("product country");

  return {
    products: uniqueValues(
      parseProducts(buyer.importProducts).concat(recentRfqs.map((rfq) => rfq.product || ""))
    ),
    countries: uniqueValues([buyer.country, ...recentRfqs.map((rfq) => rfq.country || "")]),
    recentRfqs
  };
};

const computeProductRelevance = ({ productSignals, exporter, explicitProduct }) => {
  const searchValues = explicitProduct
    ? [explicitProduct]
    : productSignals.length
      ? productSignals
      : [];

  if (!searchValues.length) {
    return {
      value: 0.22,
      reason: "Verified supplier in the marketplace"
    };
  }

  const buyerTerms = uniqueValues(
    createProductSearchTerms(searchValues).concat(searchValues.map((value) => normalizeValue(value)))
  );
  const exporterTerms = uniqueValues(
    (exporter.productTokens || []).concat(exporter.normalizedProducts || [])
  );
  const hasExactMatch = searchValues.some((value) =>
    exporter.normalizedProducts?.includes(normalizeValue(value))
  );

  if (hasExactMatch) {
    return {
      value: 1,
      reason: explicitProduct ? "Exact product search match" : "Matches buyer import interest"
    };
  }

  const overlap = buyerTerms.filter((term) => exporterTerms.includes(term)).length;
  if (!overlap) {
    return {
      value: explicitProduct ? 0 : 0.12,
      reason: explicitProduct ? "" : "Verified supplier outside current buyer focus"
    };
  }

  const score = overlap / Math.max(1, buyerTerms.length);
  return {
    value: Math.min(1, score),
    reason: score >= 0.55 ? "Strong product relevance" : "Partial product relevance"
  };
};

const computeCountryAffinity = ({ buyer, exporter, explicitCountry }) => {
  const buyerCountry = normalizeCountry(buyer.country);
  const exporterCountry = exporter.normalizedCountry || normalizeCountry(exporter.country);
  const requestedCountry = explicitCountry ? normalizeCountry(explicitCountry) : "";

  if (requestedCountry) {
    return {
      value: requestedCountry === exporterCountry ? 1 : 0,
      reason: requestedCountry === exporterCountry ? "Exporter country matched filter" : ""
    };
  }

  if (buyerCountry && buyerCountry === exporterCountry) {
    return {
      value: 0.45,
      reason: "Buyer and exporter share the same country"
    };
  }

  return {
    value: 0.16,
    reason: "Open for cross-border trade discovery"
  };
};

const computeCertificationFit = ({ certification, exporter }) => {
  if (!certification) {
    return {
      value: 0,
      reason: ""
    };
  }

  const normalizedCertification = normalizeValue(certification);
  if (exporter.normalizedCertifications?.includes(normalizedCertification)) {
    return {
      value: 1,
      reason: "Certification matched"
    };
  }

  return {
    value: 0,
    reason: ""
  };
};

const computeTrustFit = (exporter) => ({
  value: roundScore(exporter.trustScore || 0),
  reason:
    Number(exporter.trustScore || 0) >= 0.8
      ? "High trust exporter"
      : "Trust signal factored into ranking"
});

const scoreExporterDiscovery = ({
  buyer,
  exporter,
  productSignals,
  explicitProduct,
  explicitCountry,
  certification,
  boost
}) => {
  const productRelevance = computeProductRelevance({
    productSignals,
    exporter,
    explicitProduct
  });
  const countryAffinity = computeCountryAffinity({
    buyer,
    exporter,
    explicitCountry
  });
  const certificationFit = computeCertificationFit({
    certification,
    exporter
  });
  const trustFit = computeTrustFit(exporter);
  const subscriptionFit = roundScore(Math.min(1, Number(boost?.boost || 0) / 16));

  const totalScore = roundScore(
    productRelevance.value * 0.45 +
      trustFit.value * 0.35 +
      countryAffinity.value * 0.1 +
      certificationFit.value * 0.05 +
      subscriptionFit * 0.05
  );

  return {
    productRelevance,
    countryAffinity,
    certificationFit,
    trustFit,
    subscriptionFit,
    totalScore,
    rankingPriority: boost?.rankingPriority || 0
  };
};

const attachDiscoveryMetadata = ({
  buyer,
  exporters,
  productSignals,
  explicitProduct = "",
  explicitCountry = "",
  certification = ""
}) => {
  const savedSet = new Set((buyer.savedExporterIds || []).map((id) => id.toString()));

  return async (boostMap) =>
    exporters
      .map((exporter) => {
        const boost = boostMap[exporter.userId?._id?.toString?.() || ""] || {
          boost: 0,
          rankingPriority: 0
        };
        const scoring = scoreExporterDiscovery({
          buyer,
          exporter,
          productSignals,
          explicitProduct,
          explicitCountry,
          certification,
          boost
        });

        if (explicitProduct && scoring.productRelevance.value <= 0) {
          return null;
        }

        if (certification && scoring.certificationFit.value <= 0) {
          return null;
        }

        exporter.discoveryScore = scoring.totalScore;
        exporter.discoveryReasons = [
          scoring.productRelevance.reason,
          scoring.countryAffinity.reason,
          scoring.certificationFit.reason,
          scoring.trustFit.reason,
          boost.boost > 0 ? "Priority visibility from plan" : ""
        ].filter(Boolean);
        exporter.isSaved = savedSet.has(exporter._id.toString());
        exporter._discoveryMeta = scoring;
        return exporter;
      })
      .filter(Boolean)
      .sort((left, right) => {
        if ((right.discoveryScore || 0) !== (left.discoveryScore || 0)) {
          return (right.discoveryScore || 0) - (left.discoveryScore || 0);
        }

        if ((right.trustScore || 0) !== (left.trustScore || 0)) {
          return (right.trustScore || 0) - (left.trustScore || 0);
        }

        if (
          (right._discoveryMeta?.rankingPriority || 0) !==
          (left._discoveryMeta?.rankingPriority || 0)
        ) {
          return (right._discoveryMeta?.rankingPriority || 0) -
            (left._discoveryMeta?.rankingPriority || 0);
        }

        return new Date(right.verifiedAt || right.createdAt).getTime() -
          new Date(left.verifiedAt || left.createdAt).getTime();
      });
};

export const searchExportersForBuyer = async ({
  buyer,
  accessSnapshot,
  page = 1,
  limit = 8,
  filters = {}
}) => {
  const explicitProduct = String(filters.product || "").trim();
  const explicitCountry = String(filters.country || "").trim();
  const certification = String(filters.certification || "").trim();
  const verificationBadge = String(filters.verificationBadge || "").trim();
  const savedOnly = String(filters.savedOnly || "") === "true";
  const minimumTrustScore = Number(filters.minTrustScore || 0);

  const query = {
    approvalState: "approved",
    verificationStage: "verified",
    status: {
      $in: ["Verified", "Top Supplier"]
    }
  };

  if (explicitCountry) {
    query.normalizedCountry = normalizeCountry(explicitCountry);
  }

  if (verificationBadge) {
    query.status = verificationBadge;
  }

  if (minimumTrustScore > 0) {
    query.trustScore = {
      $gte: minimumTrustScore
    };
  }

  if (certification) {
    query.normalizedCertifications = normalizeValue(certification);
  }

  if (savedOnly) {
    query._id = {
      $in: buyer.savedExporterIds || []
    };
  }

  const [interestSignals, exporters] = await Promise.all([
    getRecentBuyerSignals(buyer),
    Exporter.find(query).populate("userId", "email phone role publicId")
  ]);

  const boostMap = await getActiveSubscriptionBoostMap(
    exporters.map((exporter) => exporter.userId?._id).filter(Boolean)
  );
  const rankedExporters = await attachDiscoveryMetadata({
    buyer,
    exporters,
    productSignals: interestSignals.products,
    explicitProduct,
    explicitCountry,
    certification
  })(boostMap);

  const skip = Math.max(0, (page - 1) * limit);
  const resultCap = getDiscoveryCap(accessSnapshot?.plan?.code || "free");
  const accessibleTotal = Math.min(rankedExporters.length, resultCap);
  const sliceLimit = Math.max(0, Math.min(limit, resultCap - skip));
  const items = sliceLimit > 0 ? rankedExporters.slice(skip, skip + sliceLimit) : [];

  return {
    items,
    total: accessibleTotal,
    access: {
      planCode: accessSnapshot?.plan?.code || "free",
      planName: accessSnapshot?.plan?.name || "Starter",
      fullSearchAccess: (accessSnapshot?.plan?.code || "free") !== "free",
      resultCap
    },
    signals: interestSignals
  };
};

export const getRecommendedExportersForBuyer = async ({
  buyer,
  accessSnapshot,
  limit = 5
}) => {
  const discovery = await searchExportersForBuyer({
    buyer,
    accessSnapshot,
    page: 1,
    limit
  });

  return discovery.items.slice(0, limit);
};

export const toggleSavedExporter = async ({ buyer, exporterId }) => {
  const exporter = await Exporter.findById(exporterId).populate("userId", "email phone role");

  if (!exporter || exporter.approvalState !== "approved") {
    throw createHttpError(404, "Exporter not found");
  }

  const exporterIdValue = exporter._id.toString();
  const currentSavedIds = (buyer.savedExporterIds || []).map((id) => id.toString());
  const isSaved = currentSavedIds.includes(exporterIdValue);

  buyer.savedExporterIds = isSaved
    ? (buyer.savedExporterIds || []).filter((id) => id.toString() !== exporterIdValue)
    : [...(buyer.savedExporterIds || []), exporter._id];

  await buyer.save();

  exporter.isSaved = !isSaved;

  return {
    exporter,
    isSaved: !isSaved,
    savedExporterCount: buyer.savedExporterIds.length
  };
};

export const getSavedExportersForBuyer = async ({ buyer }) => {
  const savedIds = buyer.savedExporterIds || [];
  if (!savedIds.length) {
    return [];
  }

  const exporters = await Exporter.find({
    _id: {
      $in: savedIds
    }
  }).populate("userId", "email phone role publicId");

  const exporterOrder = new Map(savedIds.map((id, index) => [id.toString(), index]));

  return exporters
    .map((exporter) => {
      exporter.isSaved = true;
      exporter.discoveryReasons = ["Saved by buyer"];
      exporter.discoveryScore = roundScore(exporter.trustScore || 0);
      return exporter;
    })
    .sort(
      (left, right) =>
        (exporterOrder.get(left._id.toString()) || 0) -
        (exporterOrder.get(right._id.toString()) || 0)
    );
};

export const getBuyerExporterProfile = async ({ buyer, buyerUser, exporterId }) => {
  const exporter = await Exporter.findById(exporterId).populate(
    "userId",
    "email phone role publicId"
  );

  if (!exporter || exporter.approvalState !== "approved") {
    throw createHttpError(404, "Exporter not found");
  }

  exporter.isSaved = (buyer.savedExporterIds || []).some(
    (savedId) => savedId.toString() === exporter._id.toString()
  );

  exporter.profileViews = Number(exporter.profileViews || 0) + 1;
  await exporter.save();

  const notificationCacheKey = `discovery:view:${buyer._id}:${exporter._id}`;
  const existingViewNotification = await cacheService.get(notificationCacheKey);

  if (!existingViewNotification && exporter.userId?._id) {
    await createNotification({
      recipientId: exporter.userId._id,
      senderId: buyerUser._id,
      type: "match",
      title: "Buyer viewed your profile",
      body: `${buyer.companyName} explored your exporter profile in discovery.`,
      actionUrl: "/dashboard",
      entityType: "Exporter",
      entityId: exporter._id.toString(),
      metadata: {
        buyerId: buyer._id.toString(),
        buyerCompanyName: buyer.companyName
      }
    });
    await cacheService.set(notificationCacheKey, true, 3600);
  }

  await createAuditLog({
    actorId: buyerUser._id,
    actorRole: buyerUser.role,
    action: "buyer.exporter.viewed",
    entityType: "Exporter",
    entityId: exporter._id.toString(),
    metadata: {
      title: "Buyer viewed exporter profile",
      summary: `${buyer.companyName} viewed ${exporter.companyName}.`,
      country: normalizeCountry(exporter.country),
      countryLabel: exporter.country,
      product: normalizeValue(exporter.products[0] || ""),
      productLabel: exporter.products[0] || "",
      companyName: exporter.companyName,
      status: exporter.status
    }
  });

  return exporter;
};
