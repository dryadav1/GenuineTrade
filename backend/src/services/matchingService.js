import Buyer from "../models/Buyer.js";
import Match from "../models/Match.js";
import RFQ from "../models/RFQ.js";
import Exporter from "../models/Exporter.js";
import { createAuditLog } from "./auditService.js";
import { createNotification } from "./notificationService.js";
import { getActiveSubscriptionBoostMap } from "./subscriptionService.js";
import {
  expandSynonyms,
  normalizeCountry,
  normalizeValue,
  tokenizeValue
} from "../utils/matchHelpers.js";

const roundScore = (value) => Math.round(value * 1000) / 1000;

const uniqueValues = (values = []) => Array.from(new Set(values.filter(Boolean)));

const computeProductMatch = (rfqProduct, exporter) => {
  const rfqNormalized = normalizeValue(rfqProduct);
  const rfqSynonyms = uniqueValues(expandSynonyms(rfqProduct));
  const rfqTokens = uniqueValues(
    rfqSynonyms.flatMap((term) => tokenizeValue(term)).concat(rfqSynonyms)
  );
  const exporterTerms = uniqueValues(
    (exporter.productTokens || []).concat(exporter.normalizedProducts || [])
  );

  if (exporter.normalizedProducts?.includes(rfqNormalized)) {
    return {
      value: 1,
      reason: "Exact product match"
    };
  }

  const overlap = rfqTokens.filter((token) => exporterTerms.includes(token)).length;
  const denominator = Math.max(1, rfqTokens.length);
  const score = overlap / denominator;

  if (!score) {
    return {
      value: 0,
      reason: ""
    };
  }

  return {
    value: Math.min(1, score),
    reason: score >= 0.6 ? "Strong product overlap" : "Partial product overlap"
  };
};

const computeCountryMatch = (rfqCountry, exporter) => {
  const requestedCountry = normalizeCountry(rfqCountry);
  const exporterCountry = exporter.normalizedCountry || normalizeCountry(exporter.country);

  if (!requestedCountry || !exporterCountry) {
    return {
      value: 0,
      reason: ""
    };
  }

  if (requestedCountry === exporterCountry) {
    return {
      value: 1,
      reason: "Country aligned"
    };
  }

  if (
    requestedCountry.includes(exporterCountry) ||
    exporterCountry.includes(requestedCountry)
  ) {
    return {
      value: 0.5,
      reason: "Country partially aligned"
    };
  }

  return {
    value: 0,
    reason: ""
  };
};

const computeTrustScore = (exporter) => {
  const trustScore = Number(exporter.trustScore || 0);

  if (trustScore >= 0.95) {
    return {
      value: 1,
      reason: "Top supplier trust signal"
    };
  }

  if (trustScore >= 0.75) {
    return {
      value: trustScore,
      reason: "Verified trust signal"
    };
  }

  if (trustScore > 0) {
    return {
      value: trustScore,
      reason: "Developing trust profile"
    };
  }

  return {
    value: 0,
    reason: ""
  };
};

const computeWeightedScore = ({ productMatch, countryMatch, trustScore }) =>
  roundScore(
    productMatch.value * 0.4 + countryMatch.value * 0.2 + trustScore.value * 0.4
  );

export const rankExportersForRFQ = async (rfq) => {
  const exporters = await Exporter.find({
    approvalState: "approved",
    verificationStage: "verified",
    status: {
      $in: ["Verified", "Top Supplier"]
    }
  }).populate("userId", "email phone");
  const boostMap = await getActiveSubscriptionBoostMap(
    exporters.map((exporter) => exporter.userId?._id).filter(Boolean)
  );

  return exporters
    .map((exporter) => {
      const productMatch = computeProductMatch(rfq.product, exporter);
      const countryMatch = computeCountryMatch(rfq.country, exporter);
      const trustScore = computeTrustScore(exporter);
      const totalScore = computeWeightedScore({
        productMatch,
        countryMatch,
        trustScore
      });
      const subscriptionBoost = boostMap[exporter.userId?._id?.toString?.() || ""] || {
        boost: 0,
        rankingPriority: 0
      };

      return {
        exporter,
        productScore: roundScore(productMatch.value),
        countryScore: roundScore(countryMatch.value),
        trustScore: roundScore(trustScore.value),
        totalScore,
        visibilityBoost: subscriptionBoost.boost,
        rankingPriority: subscriptionBoost.rankingPriority,
        reasons: [
          productMatch.reason,
          countryMatch.reason,
          trustScore.reason,
          subscriptionBoost.boost > 0 ? "Enhanced marketplace visibility" : ""
        ].filter(Boolean)
      };
    })
    .filter((match) => match.productScore > 0 && match.totalScore > 0)
    .sort((left, right) => {
      if (right.totalScore !== left.totalScore) {
        return right.totalScore - left.totalScore;
      }

      if (right.trustScore !== left.trustScore) {
        return right.trustScore - left.trustScore;
      }

      if (right.rankingPriority !== left.rankingPriority) {
        return right.rankingPriority - left.rankingPriority;
      }

      const leftVerifiedAt = left.exporter.verifiedAt
        ? new Date(left.exporter.verifiedAt).getTime()
        : 0;
      const rightVerifiedAt = right.exporter.verifiedAt
        ? new Date(right.exporter.verifiedAt).getTime()
        : 0;

      if (rightVerifiedAt !== leftVerifiedAt) {
        return rightVerifiedAt - leftVerifiedAt;
      }

      return new Date(left.exporter.createdAt).getTime() -
        new Date(right.exporter.createdAt).getTime();
    })
    .slice(0, 5);
};

export const rebuildMatchesForRFQ = async (rfq) => {
  const rankedMatches = await rankExportersForRFQ(rfq);

  await Match.deleteMany({ rfqId: rfq._id });

  if (!rankedMatches.length) {
    await RFQ.findByIdAndUpdate(rfq._id, {
      matchCount: 0,
      topMatchScore: 0
    });

    return [];
  }

  const matchDocuments = await Match.insertMany(
    rankedMatches.map((match) => ({
      rfqId: rfq._id,
      buyerId: rfq.buyerId,
      exporterId: match.exporter._id,
      productScore: match.productScore,
      countryScore: match.countryScore,
      trustScore: match.trustScore,
      totalScore: match.totalScore,
      exporterStatusSnapshot: match.exporter.status,
      trustBadgeSnapshot: match.exporter.status,
      reasons: match.reasons,
      assignmentSource: "auto"
    }))
  );

  await RFQ.findByIdAndUpdate(rfq._id, {
    matchCount: matchDocuments.length,
    topMatchScore: matchDocuments[0]?.totalScore || 0
  });

  await createAuditLog({
    action: "rfq.matches.rebuilt",
    entityType: "RFQ",
    entityId: rfq._id.toString(),
    metadata: {
      matchCount: matchDocuments.length
    }
  });

  const [buyer, hydratedMatches] = await Promise.all([
    Buyer.findById(rfq.buyerId).populate("userId", "email phone role"),
    Match.find({ rfqId: rfq._id })
      .populate({
        path: "exporterId",
        populate: {
          path: "userId",
          select: "email phone role"
        }
      })
      .sort({ totalScore: -1, trustScore: -1, createdAt: 1 })
  ]);

  await Promise.all(
    hydratedMatches.map((match) =>
      createNotification({
        recipientId: match.exporterId.userId._id,
        type: "rfq",
        title: "New RFQ received",
        body: `A buyer RFQ for ${rfq.product} matched your exporter profile.`,
        actionUrl: "/matches",
        entityType: "Match",
        entityId: match._id.toString(),
        priority: "high"
      })
    )
  );

  if (buyer?.userId?._id) {
    await createNotification({
      recipientId: buyer.userId._id,
      type: "match",
      title: "New matches found",
      body: `${hydratedMatches.length} exporters matched your RFQ for ${rfq.product}.`,
      actionUrl: "/rfqs",
      entityType: "RFQ",
      entityId: rfq._id.toString(),
      priority: "high"
    });
  }

  return hydratedMatches;
};
