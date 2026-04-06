const monthlyEquivalent = (yearlyPrice) =>
  Math.round((Number(yearlyPrice || 0) / 12) * 100) / 100;

const normalizeLimit = (value) => (value === null ? "Unlimited" : value);

const staticPlanCatalog = {
  free: {
    code: "free",
    name: "Free",
    tier: "free",
    badge: "Free",
    defaultMonthlyPrice: 0,
    defaultYearlyPrice: 0,
    visibilityBoost: 0,
    rankingPriority: 0,
    defaultFeatures: [
      "3 RFQs per month",
      "Basic trade discovery",
      "Core messaging and onboarding",
      "Marketplace access for evaluation"
    ],
    limits: {
      rfqsPerMonth: 3,
      matchesPerMonth: 15
    },
    access: {
      analytics: false,
      advancedAnalytics: false,
      priorityRanking: false,
      prioritySupport: false,
      dedicatedAccountManager: false,
      apiAccess: false
    }
  },
  starter: {
    code: "starter",
    name: "Starter",
    tier: "paid",
    badge: "Starter",
    defaultMonthlyPrice: 29,
    defaultYearlyPrice: 290,
    visibilityBoost: 4,
    rankingPriority: 1,
    defaultFeatures: [
      "25 RFQs per month",
      "Expanded supplier discovery",
      "Core analytics",
      "Priority onboarding support",
      "Faster team collaboration"
    ],
    limits: {
      rfqsPerMonth: 25,
      matchesPerMonth: 120
    },
    access: {
      analytics: true,
      advancedAnalytics: false,
      priorityRanking: false,
      prioritySupport: true,
      dedicatedAccountManager: false,
      apiAccess: false
    }
  },
  growth: {
    code: "growth",
    name: "Growth",
    tier: "paid",
    badge: "Most Popular",
    defaultMonthlyPrice: 99,
    defaultYearlyPrice: 990,
    visibilityBoost: 10,
    rankingPriority: 2,
    defaultFeatures: [
      "Unlimited RFQs and matches",
      "Featured listing and priority ranking",
      "Advanced analytics and buyer insight",
      "Premium support response"
    ],
    limits: {
      rfqsPerMonth: null,
      matchesPerMonth: null
    },
    access: {
      analytics: true,
      advancedAnalytics: true,
      priorityRanking: true,
      prioritySupport: true,
      dedicatedAccountManager: false,
      apiAccess: false
    }
  },
  enterprise: {
    code: "enterprise",
    name: "Enterprise",
    tier: "paid",
    badge: "Enterprise",
    defaultMonthlyPrice: 249,
    defaultYearlyPrice: 2490,
    visibilityBoost: 18,
    rankingPriority: 3,
    defaultFeatures: [
      "Everything in Growth",
      "Dedicated account management",
      "Custom onboarding workflows",
      "API access and premium support"
    ],
    limits: {
      rfqsPerMonth: null,
      matchesPerMonth: null
    },
    access: {
      analytics: true,
      advancedAnalytics: true,
      priorityRanking: true,
      prioritySupport: true,
      dedicatedAccountManager: true,
      apiAccess: true
    }
  }
};

const legacyAliasMap = {
  professional: "growth",
  scale: "enterprise",
  advance: "growth",
  advanced: "growth"
};

const createGenericPaidPlan = (planCode) => ({
  code: planCode,
  name: planCode
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" "),
  tier: planCode === "free" ? "free" : "paid",
  badge: "Plan",
  defaultMonthlyPrice: 49,
  defaultYearlyPrice: 490,
  visibilityBoost: 6,
  rankingPriority: 1,
  defaultFeatures: [
    "Plan-managed RFQ access",
    "Dynamic pricing and plan controls",
    "Workspace upgrade eligibility"
  ],
  limits: {
    rfqsPerMonth: 50,
    matchesPerMonth: 200
  },
  access: {
    analytics: true,
    advancedAnalytics: false,
    priorityRanking: false,
    prioritySupport: true,
    dedicatedAccountManager: false,
    apiAccess: false
  }
});

export const normalizePlanCode = (planCode = "free") =>
  String(legacyAliasMap[planCode] || planCode || "free")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const isKnownPlanCode = (planCode) =>
  Boolean(staticPlanCatalog[normalizePlanCode(planCode)]);

export const getPlanByCode = (planCode = "free") => {
  const normalizedCode = normalizePlanCode(planCode);
  return staticPlanCatalog[normalizedCode] || createGenericPaidPlan(normalizedCode);
};

export const listPlans = () =>
  Object.values(staticPlanCatalog).map((plan) => ({
    code: plan.code,
    name: plan.name,
    tier: plan.tier,
    badge: plan.badge,
    monthlyPrice: plan.defaultMonthlyPrice,
    annualPrice: plan.defaultYearlyPrice,
    monthlyRecurringValue: monthlyEquivalent(plan.defaultYearlyPrice),
    visibilityBoost: plan.visibilityBoost,
    rankingPriority: plan.rankingPriority,
    features: plan.defaultFeatures,
    limits: {
      rfqsPerMonth: normalizeLimit(plan.limits.rfqsPerMonth),
      matchesPerMonth: normalizeLimit(plan.limits.matchesPerMonth)
    },
    rawLimits: plan.limits,
    access: plan.access
  }));

export const listPaidPlans = () =>
  listPlans().filter((plan) => plan.tier === "paid");

export const getPlanLimitValue = (planCode, limitKey) =>
  getPlanByCode(planCode).limits?.[limitKey] ?? null;

export const hasPlanFeature = (planCode, featureKey) =>
  Boolean(getPlanByCode(planCode).access?.[featureKey]);

export const getPlanPricingConfig = () => "";

export const normalizePlanDuration = (value = "monthly") =>
  value === "annual" || value === "yearly" ? "yearly" : "monthly";
