import Buyer from "../models/Buyer.js";
import Exporter from "../models/Exporter.js";
import Match from "../models/Match.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createPaginationMeta, parsePagination } from "../utils/pagination.js";
import { serializeMatch } from "../utils/serializers.js";

const getCappedPagination = ({ page, limit, skip, cap }) => {
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

export const getMyMatches = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const matchCap = req.subscriptionAccess?.matchCap ?? null;
  const { queryLimit, totalCap } = getCappedPagination({
    page,
    limit,
    skip,
    cap: matchCap
  });

  if (req.user.role === "buyer") {
    const buyer = await Buyer.findOne({ userId: req.user._id });

    if (!buyer) {
      res.status(404).json({ message: "Buyer profile not found" });
      return;
    }

    const [matches, total] = await Promise.all([
      Match.find({ buyerId: buyer._id })
        .populate({
          path: "exporterId",
          populate: {
            path: "userId",
            select: "email phone role"
          }
        })
        .populate("rfqId")
        .sort({ createdAt: -1, totalScore: -1 })
        .skip(skip)
        .limit(queryLimit),
      Match.countDocuments({ buyerId: buyer._id })
    ]);

    const accessibleTotal = totalCap === null ? total : Math.min(total, totalCap);

    res.json({
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
    return;
  }

  const exporter = await Exporter.findOne({ userId: req.user._id });

  if (!exporter) {
    res.status(404).json({ message: "Exporter profile not found" });
    return;
  }

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
      .limit(queryLimit),
    Match.countDocuments({ exporterId: exporter._id })
  ]);

  const accessibleTotal = totalCap === null ? total : Math.min(total, totalCap);

  res.json({
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
