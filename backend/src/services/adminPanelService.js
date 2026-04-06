import Buyer from "../models/Buyer.js";
import Exporter from "../models/Exporter.js";
import Match from "../models/Match.js";
import PlatformSetting from "../models/PlatformSetting.js";
import RFQ from "../models/RFQ.js";
import Subscription from "../models/Subscription.js";
import Transaction from "../models/Transaction.js";
import User from "../models/User.js";
import { createAdminLog } from "./adminLogService.js";
import { hydrateExportersVerification } from "./verificationService.js";
import { createPaginationMeta, parsePagination } from "../utils/pagination.js";

const revenueStatuses = ["payment_processing", "in_escrow", "released"];
const activeSubscriptionStatuses = ["active", "pending", "cancelled"];

const roundValue = (value, precision = 1) => {
  const multiplier = 10 ** precision;
  return Math.round(Number(value || 0) * multiplier) / multiplier;
};

const startOfMonth = (date = new Date()) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date, months) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createSearchRegex = (value = "") =>
  value ? new RegExp(escapeRegex(value), "i") : null;

const serializePagination = ({ page, limit, total }) =>
  createPaginationMeta({ page, limit, total });

const toSeriesBuckets = (months = 6, formatter = null) => {
  const now = startOfMonth();
  return Array.from({ length: months }).map((_, index) => {
    const date = addMonths(now, index - (months - 1));
    const label = formatter
      ? formatter(date)
      : date.toLocaleString("en-US", {
          month: "short"
        });

    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label,
      value: 0
    };
  });
};

const mergeAggregateIntoSeries = (series, items = [], valueKey = "value") => {
  const valueMap = items.reduce((map, item) => {
    const key = `${item._id.year}-${String(item._id.month).padStart(2, "0")}`;
    map[key] = Number(item[valueKey] || 0);
    return map;
  }, {});

  return series.map((bucket) => ({
    ...bucket,
    value: valueMap[bucket.key] || 0
  }));
};

const serializeOverviewUser = (user) => ({
  id: user._id,
  name: user.name || "",
  email: user.email || "",
  role: user.role || "",
  status: user.status || "pending",
  accountStatus: user.accountStatus || "active",
  company: user.company || "",
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt || null
});

const serializeAdminUser = (user) => ({
  id: user._id,
  name: user.name || "",
  email: user.email || "",
  role: user.role || "",
  status: user.status || "pending",
  badge: user.badge || "none",
  accountStatus: user.accountStatus || "active",
  company: user.company || "",
  country: user.country || "",
  phone: user.phone || "",
  subscriptionPlan: user.subscriptionPlan || "free",
  planExpiry: user.planExpiry || null,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt || null
});

const serializeVerificationItem = (exporter) => ({
  id: exporter._id,
  companyName: exporter.companyName,
  country: exporter.country,
  status: exporter.status,
  approvalState: exporter.approvalState,
  verificationStage: exporter.verificationStage,
  trustScore: exporter.trustScore || 0,
  uploadedCount: exporter.kycSummary?.uploadedCount || 0,
  approvedCount: exporter.kycSummary?.approvedCount || 0,
  missingDocumentTypes: exporter.kycSummary?.missingDocumentTypes || [],
  readyForReview: Boolean(exporter.kycSummary?.readyForReview),
  email: exporter.userId?.email || "",
  createdAt: exporter.createdAt,
  reviewedAt: exporter.reviewedAt || null
});

const serializeRFQItem = (rfq) => ({
  id: rfq._id,
  product: rfq.product,
  quantity: rfq.quantity,
  country: rfq.country,
  budget: Number(rfq.budget || 0),
  matchCount: Number(rfq.matchCount || 0),
  topMatchScore: roundValue(rfq.topMatchScore || 0, 2),
  buyerCompany: rfq.buyerId?.companyName || "",
  buyerCountry: rfq.buyerId?.country || "",
  buyerEmail: rfq.buyerId?.userId?.email || "",
  createdAt: rfq.createdAt
});

const serializeSubscriptionItem = (subscription) => ({
  id: subscription._id,
  userId: subscription.userId?._id || subscription.userId || null,
  userName: subscription.userId?.name || "",
  userEmail: subscription.userId?.email || "",
  userRole: subscription.userId?.role || subscription.role || "",
  planCode: subscription.planCode || "free",
  planName: subscription.planName || "Free",
  status: subscription.status || "active",
  billingCycle: subscription.billingCycle || "monthly",
  amount: Number(subscription.amount || 0),
  currency: subscription.currency || "USD",
  paymentProvider: subscription.paymentProvider || "free_tier",
  currentPeriodStart: subscription.currentPeriodStart || null,
  currentPeriodEnd: subscription.currentPeriodEnd || null,
  nextChargeAt: subscription.nextChargeAt || null,
  lastPaymentStatus: subscription.lastPaymentStatus || "none"
});

const serializeTransactionItem = (transaction) => ({
  id: transaction._id,
  amount: Number(transaction.amount || 0),
  currency: transaction.currency || "USD",
  baseAmount: Number(transaction.baseAmount || 0),
  baseCurrency: transaction.baseCurrency || "USD",
  provider: transaction.provider || "",
  status: transaction.status || "pending",
  escrowStatus: transaction.escrowStatus || "pending",
  refundStatus: transaction.refundStatus || "not_requested",
  buyerCompany: transaction.buyerId?.companyName || "",
  exporterCompany: transaction.exporterId?.companyName || "",
  product: transaction.rfqId?.product || "",
  createdAt: transaction.createdAt
});

const serializeDistribution = (items = []) =>
  items.map((item) => ({
    label: item._id || "Unknown",
    value: Number(item.total || 0)
  }));

const getOrCreatePlatformSetting = async () =>
  PlatformSetting.findOneAndUpdate(
    { singletonKey: "platform" },
    {
      $setOnInsert: {
        singletonKey: "platform"
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

export const getAdminOverview = async () => {
  const now = new Date();
  const currentMonth = startOfMonth(now);
  const previousMonth = addMonths(currentMonth, -1);
  const nextMonth = addMonths(currentMonth, 1);
  const activeRFQThreshold = new Date(now);
  activeRFQThreshold.setDate(activeRFQThreshold.getDate() - 30);

  const [
    userCount,
    activeRFQs,
    currentMonthUsers,
    previousMonthUsers,
    revenueSummary,
    revenueByMonth,
    recentUsers
  ] = await Promise.all([
    User.countDocuments({
      role: {
        $in: ["buyer", "exporter"]
      }
    }),
    RFQ.countDocuments({
      createdAt: {
        $gte: activeRFQThreshold
      }
    }),
    User.countDocuments({
      role: {
        $in: ["buyer", "exporter"]
      },
      createdAt: {
        $gte: currentMonth,
        $lt: nextMonth
      }
    }),
    User.countDocuments({
      role: {
        $in: ["buyer", "exporter"]
      },
      createdAt: {
        $gte: previousMonth,
        $lt: currentMonth
      }
    }),
    Transaction.aggregate([
      {
        $match: {
          status: {
            $in: revenueStatuses
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$baseAmount"
          }
        }
      }
    ]),
    Transaction.aggregate([
      {
        $match: {
          status: {
            $in: revenueStatuses
          },
          createdAt: {
            $gte: addMonths(currentMonth, -5)
          }
        }
      },
      {
        $group: {
          _id: {
            year: {
              $year: "$createdAt"
            },
            month: {
              $month: "$createdAt"
            }
          },
          value: {
            $sum: "$baseAmount"
          }
        }
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1
        }
      }
    ]),
    User.find({
      role: {
        $in: ["buyer", "exporter"]
      }
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .select(
        "name email role status accountStatus company createdAt lastLoginAt"
      )
      .lean()
  ]);

  const growthPercent =
    previousMonthUsers > 0
      ? roundValue(((currentMonthUsers - previousMonthUsers) / previousMonthUsers) * 100)
      : currentMonthUsers > 0
        ? 100
        : 0;

  return {
    metrics: {
      totalRevenue: Number(revenueSummary[0]?.totalRevenue || 0),
      totalUsers: userCount,
      activeRFQs,
      growthPercent
    },
    revenueSeries: mergeAggregateIntoSeries(toSeriesBuckets(6), revenueByMonth),
    recentUsers: recentUsers.map(serializeOverviewUser)
  };
};

export const listAdminUsers = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const searchRegex = createSearchRegex(query.search);
  const filters = {};

  if (query.role) {
    filters.role = query.role;
  }

  if (query.status) {
    filters.status = query.status;
  }

  if (query.accountStatus) {
    filters.accountStatus = query.accountStatus;
  }

  if (searchRegex) {
    filters.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { company: searchRegex }
    ];
  }

  const [items, total, summaryRows] = await Promise.all([
    User.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "name email role status badge accountStatus company country phone subscriptionPlan planExpiry createdAt lastLoginAt"
      )
      .lean(),
    User.countDocuments(filters),
    User.aggregate([
      {
        $match: filters
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: 1
          },
          active: {
            $sum: {
              $cond: [{ $eq: ["$accountStatus", "active"] }, 1, 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, 1, 0]
            }
          },
          verified: {
            $sum: {
              $cond: [{ $eq: ["$status", "verified"] }, 1, 0]
            }
          }
        }
      }
    ])
  ]);

  return {
    items: items.map(serializeAdminUser),
    pagination: serializePagination({ page, limit, total }),
    summary: {
      total: Number(summaryRows[0]?.total || 0),
      active: Number(summaryRows[0]?.active || 0),
      pending: Number(summaryRows[0]?.pending || 0),
      verified: Number(summaryRows[0]?.verified || 0)
    }
  };
};

export const listAdminVerification = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const searchRegex = createSearchRegex(query.search);
  const filters = {};

  if (query.stage) {
    filters.verificationStage = query.stage;
  }

  if (query.approvalState) {
    filters.approvalState = query.approvalState;
  }

  if (query.country) {
    filters.country = query.country;
  }

  if (searchRegex) {
    filters.$or = [
      { companyName: searchRegex },
      { gstNumber: searchRegex },
      { iecCode: searchRegex }
    ];
  }

  const [items, total, summaryRows] = await Promise.all([
    Exporter.find(filters)
      .populate("userId", "email phone role")
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Exporter.countDocuments(filters),
    Exporter.aggregate([
      {
        $match: filters
      },
      {
        $group: {
          _id: "$verificationStage",
          total: {
            $sum: 1
          }
        }
      }
    ])
  ]);

  const hydratedItems = await hydrateExportersVerification(items);

  return {
    items: hydratedItems.map(serializeVerificationItem),
    pagination: serializePagination({ page, limit, total }),
    summary: serializeDistribution(summaryRows)
  };
};

export const listAdminRFQs = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const searchRegex = createSearchRegex(query.search);
  const filters = {};

  if (query.country) {
    filters.country = query.country;
  }

  if (searchRegex) {
    filters.$or = [{ product: searchRegex }, { country: searchRegex }];
  }

  const [items, total, summaryRows] = await Promise.all([
    RFQ.find(filters)
      .populate({
        path: "buyerId",
        select: "companyName country userId",
        populate: {
          path: "userId",
          select: "email"
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RFQ.countDocuments(filters),
    RFQ.aggregate([
      {
        $match: filters
      },
      {
        $group: {
          _id: null,
          totalRFQs: {
            $sum: 1
          },
          totalMatches: {
            $sum: "$matchCount"
          },
          avgTopMatchScore: {
            $avg: "$topMatchScore"
          }
        }
      }
    ])
  ]);

  return {
    items: items.map(serializeRFQItem),
    pagination: serializePagination({ page, limit, total }),
    summary: {
      totalRFQs: Number(summaryRows[0]?.totalRFQs || 0),
      totalMatches: Number(summaryRows[0]?.totalMatches || 0),
      avgTopMatchScore: roundValue(summaryRows[0]?.avgTopMatchScore || 0, 2)
    }
  };
};

export const listAdminSubscriptions = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const filters = {};

  if (query.planCode) {
    filters.planCode = query.planCode;
  }

  if (query.status) {
    filters.status = query.status;
  }

  const now = new Date();
  const expiringThreshold = new Date(now);
  expiringThreshold.setDate(expiringThreshold.getDate() + 7);

  const [items, total, summaryRows] = await Promise.all([
    Subscription.find(filters)
      .populate("userId", "name email role company country")
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Subscription.countDocuments(filters),
    Subscription.aggregate([
      {
        $match: filters
      },
      {
        $group: {
          _id: null,
          activeCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "active"] }, 1, 0]
            }
          },
          paidCount: {
            $sum: {
              $cond: [{ $ne: ["$planCode", "free"] }, 1, 0]
            }
          },
          monthlyRevenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "active"] },
                    { $eq: ["$billingCycle", "monthly"] }
                  ]
                },
                "$amount",
                0
              ]
            }
          },
          expiringSoon: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lte: ["$currentPeriodEnd", expiringThreshold] },
                    { $gte: ["$currentPeriodEnd", now] },
                    { $in: ["$status", activeSubscriptionStatuses] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ])
  ]);

  return {
    items: items.map(serializeSubscriptionItem),
    pagination: serializePagination({ page, limit, total }),
    summary: {
      activeCount: Number(summaryRows[0]?.activeCount || 0),
      paidCount: Number(summaryRows[0]?.paidCount || 0),
      monthlyRevenue: Number(summaryRows[0]?.monthlyRevenue || 0),
      expiringSoon: Number(summaryRows[0]?.expiringSoon || 0)
    }
  };
};

export const listAdminTransactions = async (query = {}) => {
  const { page, limit, skip } = parsePagination(query);
  const filters = {};

  if (query.status) {
    filters.status = query.status;
  }

  if (query.provider) {
    filters.provider = query.provider;
  }

  const [items, total, summaryRows] = await Promise.all([
    Transaction.find(filters)
      .populate({
        path: "buyerId",
        select: "companyName country"
      })
      .populate({
        path: "exporterId",
        select: "companyName country"
      })
      .populate({
        path: "rfqId",
        select: "product"
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(filters),
    Transaction.aggregate([
      {
        $match: filters
      },
      {
        $group: {
          _id: null,
          totalVolume: {
            $sum: "$baseAmount"
          },
          releasedVolume: {
            $sum: {
              $cond: [{ $eq: ["$status", "released"] }, "$baseAmount", 0]
            }
          },
          disputes: {
            $sum: {
              $cond: [{ $eq: ["$status", "disputed"] }, 1, 0]
            }
          },
          averageOrderValue: {
            $avg: "$baseAmount"
          }
        }
      }
    ])
  ]);

  return {
    items: items.map(serializeTransactionItem),
    pagination: serializePagination({ page, limit, total }),
    summary: {
      totalVolume: Number(summaryRows[0]?.totalVolume || 0),
      releasedVolume: Number(summaryRows[0]?.releasedVolume || 0),
      disputes: Number(summaryRows[0]?.disputes || 0),
      averageOrderValue: Number(summaryRows[0]?.averageOrderValue || 0)
    }
  };
};

export const getAdminAnalytics = async () => {
  const currentMonth = startOfMonth();

  const [
    revenueByMonth,
    rfqByMonth,
    roleDistribution,
    planDistribution,
    providerDistribution,
    totalRevenueRow,
    totalRFQs,
    totalPaidSubscriptions,
    verifiedExporters
  ] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          status: {
            $in: revenueStatuses
          },
          createdAt: {
            $gte: addMonths(currentMonth, -5)
          }
        }
      },
      {
        $group: {
          _id: {
            year: {
              $year: "$createdAt"
            },
            month: {
              $month: "$createdAt"
            }
          },
          value: {
            $sum: "$baseAmount"
          }
        }
      }
    ]),
    RFQ.aggregate([
      {
        $match: {
          createdAt: {
            $gte: addMonths(currentMonth, -5)
          }
        }
      },
      {
        $group: {
          _id: {
            year: {
              $year: "$createdAt"
            },
            month: {
              $month: "$createdAt"
            }
          },
          value: {
            $sum: 1
          }
        }
      }
    ]),
    User.aggregate([
      {
        $match: {
          role: {
            $in: ["buyer", "exporter", "admin"]
          }
        }
      },
      {
        $group: {
          _id: "$role",
          total: {
            $sum: 1
          }
        }
      }
    ]),
    Subscription.aggregate([
      {
        $match: {
          status: "active"
        }
      },
      {
        $group: {
          _id: "$planCode",
          total: {
            $sum: 1
          }
        }
      }
    ]),
    Transaction.aggregate([
      {
        $group: {
          _id: "$provider",
          total: {
            $sum: 1
          }
        }
      }
    ]),
    Transaction.aggregate([
      {
        $match: {
          status: {
            $in: revenueStatuses
          }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$baseAmount"
          },
          averageOrderValue: {
            $avg: "$baseAmount"
          }
        }
      }
    ]),
    RFQ.countDocuments(),
    Subscription.countDocuments({
      status: "active",
      planCode: {
        $ne: "free"
      }
    }),
    Exporter.countDocuments({
      verificationStage: "verified"
    })
  ]);

  return {
    metrics: {
      totalRevenue: Number(totalRevenueRow[0]?.totalRevenue || 0),
      averageOrderValue: Number(totalRevenueRow[0]?.averageOrderValue || 0),
      totalRFQs,
      paidSubscriptions: totalPaidSubscriptions,
      verifiedExporters
    },
    charts: {
      revenue: mergeAggregateIntoSeries(toSeriesBuckets(6), revenueByMonth),
      rfqs: mergeAggregateIntoSeries(toSeriesBuckets(6), rfqByMonth)
    },
    distributions: {
      roles: serializeDistribution(roleDistribution),
      plans: serializeDistribution(planDistribution),
      providers: serializeDistribution(providerDistribution)
    }
  };
};

export const getAdminSettings = async () => {
  const [settings, featuredExporterOptions] = await Promise.all([
    getOrCreatePlatformSetting(),
    Exporter.find({
      approvalState: "approved"
    })
      .sort({ verifiedAt: -1, createdAt: -1 })
      .limit(50)
      .select("companyName country status")
      .lean()
  ]);

  return {
    settings: {
      homepage: settings.homepage,
      platform: settings.platform,
      featuredExporterIds: (settings.featuredExporterIds || []).map((id) =>
        id.toString()
      )
    },
    featuredExporterOptions: featuredExporterOptions.map((exporter) => ({
      id: exporter._id,
      companyName: exporter.companyName,
      country: exporter.country,
      status: exporter.status
    }))
  };
};

export const updateAdminSettings = async ({ actor, payload = {} }) => {
  const settings = await getOrCreatePlatformSetting();
  const nextFeaturedExporterIds = Array.isArray(payload.featuredExporterIds)
    ? payload.featuredExporterIds.filter(Boolean)
    : settings.featuredExporterIds.map((id) => id.toString());

  settings.homepage.heroTitle =
    payload.homepage?.heroTitle ?? settings.homepage.heroTitle;
  settings.homepage.heroSubtitle =
    payload.homepage?.heroSubtitle ?? settings.homepage.heroSubtitle;
  settings.homepage.announcement =
    payload.homepage?.announcement ?? settings.homepage.announcement;
  settings.platform.supportEmail =
    payload.platform?.supportEmail ?? settings.platform.supportEmail;
  settings.platform.maintenanceMode =
    payload.platform?.maintenanceMode ?? settings.platform.maintenanceMode;
  settings.platform.allowNewRegistrations =
    payload.platform?.allowNewRegistrations ??
    settings.platform.allowNewRegistrations;
  settings.featuredExporterIds = nextFeaturedExporterIds;
  await settings.save();

  await createAdminLog({
    actor,
    action: "admin.settings.updated",
    targetType: "PlatformSetting",
    targetId: settings._id.toString(),
    summary: "Platform settings updated from the admin panel.",
    metadata: {
      featuredExporterCount: nextFeaturedExporterIds.length
    }
  });

  return getAdminSettings();
};
