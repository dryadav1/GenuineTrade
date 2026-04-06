import Buyer from "../models/Buyer.js";
import Match from "../models/Match.js";
import RFQ from "../models/RFQ.js";
import { createAuditLog } from "../services/auditService.js";
import { rebuildMatchesForRFQ } from "../services/matchingService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizeCountry, normalizeValue } from "../utils/matchHelpers.js";
import { createPaginationMeta, parsePagination } from "../utils/pagination.js";
import { serializeMatch, serializeRFQ } from "../utils/serializers.js";

const getCappedPagination = ({ limit, skip, cap }) => {
  if (cap === null || cap === undefined) {
    return {
      queryLimit: limit,
      totalCap: null
    };
  }

  if (skip >= cap) {
    return {
      queryLimit: 0,
      totalCap: cap
    };
  }

  return {
    queryLimit: Math.max(Math.min(limit, cap - skip), 0),
    totalCap: cap
  };
};

export const createRFQ = asyncHandler(async (req, res) => {
  const { product, quantity, country, budget } = req.body;
  const parsedBudget =
    budget === null || budget === undefined || budget === ""
      ? null
      : Number(budget);

  if (!product || !quantity || !country) {
    res.status(400).json({
      message: "Product, quantity, and target country are required"
    });
    return;
  }

  const buyer = await Buyer.findOne({ userId: req.user._id });

  if (!buyer) {
    res.status(404).json({ message: "Buyer profile not found" });
    return;
  }

  const rfq = await RFQ.create({
    buyerId: buyer._id,
    product,
    quantity,
    country,
    budget: Number.isNaN(parsedBudget) ? null : parsedBudget
  });

  const matches = await rebuildMatchesForRFQ(rfq);
  await createAuditLog({
    actorId: req.user._id,
    actorRole: req.user.role,
    action: "rfq.created",
    entityType: "RFQ",
    entityId: rfq._id.toString(),
    metadata: {
      title: "New RFQ submitted",
      summary: `${buyer.companyName} requested ${product} for ${country}.`,
      country: normalizeCountry(country),
      countryLabel: country,
      product: normalizeValue(product),
      productLabel: product,
      status: `${matches.length} matches`,
      companyName: buyer.companyName
    },
    notification: {
      type: "rfq",
      title: "New RFQ submitted",
      body: `${buyer.companyName} created a new RFQ for ${product}.`,
      actionUrl: "/rfqs"
    }
  });

  res.status(201).json({
    message: "RFQ submitted successfully",
    rfq: serializeRFQ(await RFQ.findById(rfq._id)),
    matches: matches.map(serializeMatch),
    access: req.subscriptionAccess
      ? {
          planCode: req.subscriptionAccess.plan.code,
          planName: req.subscriptionAccess.plan.name,
          usage: req.subscriptionAccess.usage.rfqs
        }
      : null
  });
});

export const getMyRFQs = asyncHandler(async (req, res) => {
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

export const getRFQMatches = asyncHandler(async (req, res) => {
  const buyer = await Buyer.findOne({ userId: req.user._id });

  if (!buyer) {
    res.status(404).json({ message: "Buyer profile not found" });
    return;
  }

  const rfq = await RFQ.findOne({ _id: req.params.rfqId, buyerId: buyer._id });
  if (!rfq) {
    res.status(404).json({ message: "RFQ not found" });
    return;
  }

  const { page, limit, skip } = parsePagination(req.query);
  const matchCap = req.subscriptionAccess?.matchCap ?? null;
  const { queryLimit, totalCap } = getCappedPagination({
    limit,
    skip,
    cap: matchCap
  });
  const [matches, total] = await Promise.all([
    Match.find({ rfqId: rfq._id })
      .populate({
        path: "exporterId",
        populate: {
          path: "userId",
          select: "email phone role"
        }
      })
      .sort({ totalScore: -1, trustScore: -1, createdAt: 1 })
      .skip(skip)
      .limit(queryLimit),
    Match.countDocuments({ rfqId: rfq._id })
  ]);

  const accessibleTotal = totalCap === null ? total : Math.min(total, totalCap);

  res.json({
    rfq: serializeRFQ(rfq),
    items: matches.map(serializeMatch),
    access: req.subscriptionAccess
      ? {
          planCode: req.subscriptionAccess.plan.code,
          planName: req.subscriptionAccess.plan.name,
          usage: req.subscriptionAccess.usage.matches
        }
      : null,
    pagination: createPaginationMeta({ page, limit, total: accessibleTotal })
  });
});
