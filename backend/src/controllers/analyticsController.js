import Buyer from "../models/Buyer.js";
import Exporter from "../models/Exporter.js";
import Match from "../models/Match.js";
import RFQ from "../models/RFQ.js";
import { getSubscriptionSnapshot } from "../services/subscriptionService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

export const getAnalyticsOverview = asyncHandler(async (req, res) => {
  const monthStart = startOfMonth();

  if (req.user.role === "buyer") {
    const buyer = await Buyer.findOne({ userId: req.user._id });

    if (!buyer) {
      res.status(404).json({ message: "Buyer profile not found" });
      return;
    }

    const [totalRFQs, totalMatches, rfqCountryBreakdown, avgTopMatch] = await Promise.all([
      RFQ.countDocuments({
        buyerId: buyer._id,
        createdAt: {
          $gte: monthStart
        }
      }),
      Match.countDocuments({
        buyerId: buyer._id,
        createdAt: {
          $gte: monthStart
        }
      }),
      RFQ.aggregate([
        {
          $match: {
            buyerId: buyer._id,
            createdAt: {
              $gte: monthStart
            }
          }
        },
        {
          $group: {
            _id: "$country",
            count: {
              $sum: 1
            }
          }
        },
        {
          $sort: {
            count: -1
          }
        },
        {
          $limit: 5
        }
      ]),
      RFQ.aggregate([
        {
          $match: {
            buyerId: buyer._id,
            createdAt: {
              $gte: monthStart
            }
          }
        },
        {
          $group: {
            _id: null,
            avgTopMatchScore: {
              $avg: "$topMatchScore"
            }
          }
        }
      ])
    ]);

    res.json({
      role: "buyer",
      subscription: await getSubscriptionSnapshot(req.user),
      summary: {
        totalRFQs,
        totalMatches,
        avgTopMatchScore: avgTopMatch[0]?.avgTopMatchScore || 0
      },
      insights: {
        topCountries: rfqCountryBreakdown.map((item) => ({
          label: item._id,
          value: item.count
        }))
      }
    });
    return;
  }

  const exporter = await Exporter.findOne({ userId: req.user._id });

  if (!exporter) {
    res.status(404).json({ message: "Exporter profile not found" });
    return;
  }

  const [totalMatches, avgFitScore, countryBreakdown, productBreakdown] = await Promise.all([
    Match.countDocuments({
      exporterId: exporter._id,
      createdAt: {
        $gte: monthStart
      }
    }),
    Match.aggregate([
      {
        $match: {
          exporterId: exporter._id,
          createdAt: {
            $gte: monthStart
          }
        }
      },
      {
        $group: {
          _id: null,
          avgFitScore: {
            $avg: "$totalScore"
          }
        }
      }
    ]),
    Match.aggregate([
      {
        $match: {
          exporterId: exporter._id,
          createdAt: {
            $gte: monthStart
          }
        }
      },
      {
        $lookup: {
          from: "rfqs",
          localField: "rfqId",
          foreignField: "_id",
          as: "rfq"
        }
      },
      {
        $unwind: "$rfq"
      },
      {
        $group: {
          _id: "$rfq.country",
          count: {
            $sum: 1
          }
        }
      },
      {
        $sort: {
          count: -1
        }
      },
      {
        $limit: 5
      }
    ]),
    Match.aggregate([
      {
        $match: {
          exporterId: exporter._id,
          createdAt: {
            $gte: monthStart
          }
        }
      },
      {
        $lookup: {
          from: "rfqs",
          localField: "rfqId",
          foreignField: "_id",
          as: "rfq"
        }
      },
      {
        $unwind: "$rfq"
      },
      {
        $group: {
          _id: "$rfq.product",
          count: {
            $sum: 1
          }
        }
      },
      {
        $sort: {
          count: -1
        }
      },
      {
        $limit: 5
      }
    ])
  ]);

  res.json({
    role: "exporter",
    subscription: await getSubscriptionSnapshot(req.user),
    summary: {
      totalMatches,
      avgFitScore: avgFitScore[0]?.avgFitScore || 0,
      trustScore: exporter.trustScore || 0
    },
    insights: {
      topCountries: countryBreakdown.map((item) => ({
        label: item._id,
        value: item.count
      })),
      topProducts: productBreakdown.map((item) => ({
        label: item._id,
        value: item.count
      }))
    }
  });
});
