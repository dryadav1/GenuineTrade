import Plan from "../models/Plan.js";
import {
  getPlanByCode,
  normalizePlanCode,
  normalizePlanDuration
} from "./subscriptionPlans.js";

const canonicalPlanCodes = ["free", "starter", "growth", "enterprise"];

const defaultSeeds = [
  {
    planCode: "free",
    name: "Free",
    duration: "monthly",
    price: 0,
    currency: "USD",
    description: "Explore the marketplace with limited monthly RFQs and core trade workflows.",
    features: [
      "3 RFQs per month",
      "Basic discovery access",
      "Core messaging",
      "Manual onboarding support"
    ],
    isActive: true,
    isPopular: false,
    sortOrder: 1
  },
  {
    planCode: "free",
    name: "Free",
    duration: "yearly",
    price: 0,
    currency: "USD",
    description: "Explore the marketplace with limited monthly RFQs and core trade workflows.",
    features: [
      "3 RFQs per month",
      "Basic discovery access",
      "Core messaging",
      "Manual onboarding support"
    ],
    isActive: true,
    isPopular: false,
    sortOrder: 1
  },
  {
    planCode: "starter",
    name: "Starter",
    duration: "monthly",
    price: 29,
    currency: "USD",
    description: "For growing trade teams that need more RFQ capacity and faster execution.",
    features: [
      "25 RFQs per month",
      "Core analytics",
      "Priority onboarding support",
      "Faster team collaboration"
    ],
    isActive: true,
    isPopular: false,
    sortOrder: 2
  },
  {
    planCode: "starter",
    name: "Starter",
    duration: "yearly",
    price: 290,
    currency: "USD",
    description: "For growing trade teams that need more RFQ capacity and faster execution.",
    features: [
      "25 RFQs per month",
      "Core analytics",
      "Priority onboarding support",
      "Faster team collaboration"
    ],
    isActive: true,
    isPopular: false,
    sortOrder: 2
  },
  {
    planCode: "growth",
    name: "Growth",
    duration: "monthly",
    price: 99,
    currency: "USD",
    description: "The most popular plan for teams that want unlimited workflow capacity and featured visibility.",
    features: [
      "Unlimited RFQs and matches",
      "Featured listing and priority ranking",
      "Advanced analytics",
      "Premium support response"
    ],
    isActive: true,
    isPopular: true,
    sortOrder: 3
  },
  {
    planCode: "growth",
    name: "Growth",
    duration: "yearly",
    price: 990,
    currency: "USD",
    description: "The most popular plan for teams that want unlimited workflow capacity and featured visibility.",
    features: [
      "Unlimited RFQs and matches",
      "Featured listing and priority ranking",
      "Advanced analytics",
      "Premium support response"
    ],
    isActive: true,
    isPopular: true,
    sortOrder: 3
  },
  {
    planCode: "enterprise",
    name: "Enterprise",
    duration: "monthly",
    price: 249,
    currency: "USD",
    description: "Full-access infrastructure for serious global trade teams with complex workflows.",
    features: [
      "Everything in Growth",
      "Dedicated account management",
      "Premium support SLA",
      "API readiness"
    ],
    isActive: true,
    isPopular: false,
    sortOrder: 4
  },
  {
    planCode: "enterprise",
    name: "Enterprise",
    duration: "yearly",
    price: 2490,
    currency: "USD",
    description: "Full-access infrastructure for serious global trade teams with complex workflows.",
    features: [
      "Everything in Growth",
      "Dedicated account management",
      "Premium support SLA",
      "API readiness"
    ],
    isActive: true,
    isPopular: false,
    sortOrder: 4
  }
];

const monthlyEquivalent = (yearlyPrice) =>
  Math.round((Number(yearlyPrice || 0) / 12) * 100) / 100;

const getCanonicalSortOrder = (planCode) => {
  const index = canonicalPlanCodes.indexOf(normalizePlanCode(planCode));
  return index >= 0 ? index + 1 : 99;
};

const toTitle = (planCode) =>
  String(planCode || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const toFeatureArray = (features = []) =>
  Array.isArray(features)
    ? features.map((feature) => String(feature).trim()).filter(Boolean)
    : String(features || "")
        .split(/\r?\n|,/)
        .map((feature) => feature.trim())
        .filter(Boolean);

const serializePlanVariant = (plan) => ({
  id: plan._id?.toString?.() || "",
  planCode: plan.planCode,
  name: plan.name,
  duration: plan.duration,
  price: plan.price,
  currency: plan.currency,
  description: plan.description || "",
  features: plan.features || [],
  isActive: plan.isActive,
  isPopular: plan.isPopular,
  sortOrder: plan.sortOrder
});

const createFallbackVariant = (planCode, duration) => {
  const staticPlan = getPlanByCode(planCode);
  return {
    id: `${planCode}-${duration}`,
    planCode: staticPlan.code,
    name: staticPlan.name,
    duration,
    price: duration === "yearly" ? staticPlan.defaultYearlyPrice : staticPlan.defaultMonthlyPrice,
    currency: "USD",
    description: "",
    features: staticPlan.defaultFeatures,
    isActive: true,
    isPopular: staticPlan.code === "growth",
    sortOrder:
      {
        free: 1,
        starter: 2,
        growth: 3,
        enterprise: 4
      }[staticPlan.code] || 99
  };
};

const createCatalogEntry = (planCode, monthlyVariant, yearlyVariant) => {
  const staticPlan = getPlanByCode(planCode);
  const monthly = monthlyVariant || createFallbackVariant(planCode, "monthly");
  const yearly = yearlyVariant || createFallbackVariant(planCode, "yearly");

  return {
    code: normalizePlanCode(planCode),
    name: staticPlan.name,
    tier: staticPlan.tier,
    badge: staticPlan.badge,
    monthlyPrice: monthly.price,
    annualPrice: yearly.price,
    monthlyRecurringValue: monthlyEquivalent(yearly.price),
    visibilityBoost: staticPlan.visibilityBoost,
    rankingPriority: staticPlan.rankingPriority,
    features:
      (monthly.features && monthly.features.length
        ? monthly.features
        : yearly.features && yearly.features.length
          ? yearly.features
          : staticPlan.defaultFeatures),
    description: monthly.description || yearly.description || staticPlan.description || "",
    limits: {
      rfqsPerMonth:
        staticPlan.limits.rfqsPerMonth === null ? "Unlimited" : staticPlan.limits.rfqsPerMonth,
      matchesPerMonth:
        staticPlan.limits.matchesPerMonth === null
          ? "Unlimited"
          : staticPlan.limits.matchesPerMonth
    },
    rawLimits: staticPlan.limits,
    access: staticPlan.access,
    isActive: Boolean(monthly.isActive || yearly.isActive),
    isPopular: Boolean(monthly.isPopular || yearly.isPopular),
    variants: {
      monthly: serializePlanVariant(monthly),
      yearly: serializePlanVariant(yearly)
    }
  };
};

export const ensureDefaultPlans = async () => {
  await Promise.all(
    defaultSeeds.map((seed) =>
      Plan.findOneAndUpdate(
        {
          planCode: seed.planCode,
          duration: seed.duration
        },
        {
          $setOnInsert: seed
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      )
    )
  );
};

export const listPricingPlans = async ({
  includeInactive = false,
  includeCustom = false
} = {}) => {
  await ensureDefaultPlans();

  const query = includeInactive ? {} : { isActive: true };
  const documents = await Plan.find(query).sort({ sortOrder: 1, planCode: 1, duration: 1 });

  if (!documents.length) {
    return [];
  }

  const variantsByCode = documents.reduce((map, document) => {
    const planCode = normalizePlanCode(document.planCode);
    map[planCode] = map[planCode] || {};
    map[planCode][normalizePlanDuration(document.duration)] = serializePlanVariant(document);
    return map;
  }, {});

  const selectedCodes = includeCustom ? Object.keys(variantsByCode) : canonicalPlanCodes;

  return selectedCodes
    .map((planCode) =>
      createCatalogEntry(
        planCode,
        variantsByCode[planCode]?.monthly,
        variantsByCode[planCode]?.yearly
      )
    )
    .filter((plan) => includeInactive || plan.isActive)
    .sort((left, right) => {
      const leftOrder = includeCustom
        ? left.variants.monthly.sortOrder || left.variants.yearly.sortOrder || 99
        : getCanonicalSortOrder(left.code);
      const rightOrder = includeCustom
        ? right.variants.monthly.sortOrder || right.variants.yearly.sortOrder || 99
        : getCanonicalSortOrder(right.code);
      return leftOrder - rightOrder;
    });
};

export const getPlanCatalogEntry = async (planCode) => {
  const catalog = await listPricingPlans({ includeInactive: true, includeCustom: true });
  return catalog.find((plan) => plan.code === normalizePlanCode(planCode)) || null;
};

export const getPlanVariant = async (
  planCode,
  duration = "monthly",
  { includeInactive = false } = {}
) => {
  await ensureDefaultPlans();

  const normalizedCode = normalizePlanCode(planCode);
  const normalizedDuration = normalizePlanDuration(duration);
  const document = await Plan.findOne({
    planCode: normalizedCode,
    duration: normalizedDuration,
    ...(includeInactive ? {} : { isActive: true })
  });

  if (document) {
    return serializePlanVariant(document);
  }

  if (includeInactive) {
    const inactiveDocument = await Plan.findOne({
      planCode: normalizedCode,
      duration: normalizedDuration
    });

    if (inactiveDocument) {
      return serializePlanVariant(inactiveDocument);
    }
  }

  return null;
};

export const listAdminPlans = async () => {
  const catalog = await listPricingPlans({ includeInactive: true, includeCustom: true });

  return catalog.map((plan) => ({
    planCode: plan.code,
    name: plan.name,
    description: plan.description,
    features: plan.features,
    isActive: plan.isActive,
    isPopular: plan.isPopular,
    monthly: plan.variants.monthly,
    yearly: plan.variants.yearly
  }));
};

export const upsertAdminPlan = async ({
  planCode,
  name,
  monthlyPrice,
  yearlyPrice,
  currency = "USD",
  description = "",
  features = [],
  isActive = true,
  isPopular = false
}) => {
  await ensureDefaultPlans();

  const normalizedCode = normalizePlanCode(planCode || name);
  if (!normalizedCode) {
    throw new Error("Plan code is required");
  }

  const normalizedName = String(name || toTitle(normalizedCode)).trim();
  const featureList = toFeatureArray(features);
  const currentCatalog = await getPlanCatalogEntry(normalizedCode);
  const sortOrder =
    currentCatalog?.variants?.monthly?.sortOrder ||
    currentCatalog?.variants?.yearly?.sortOrder ||
    {
      free: 1,
      starter: 2,
      growth: 3,
      enterprise: 4
    }[normalizedCode] ||
    50;

  const variants = [
    {
      duration: "monthly",
      price: Number(monthlyPrice)
    },
    {
      duration: "yearly",
      price: Number(yearlyPrice)
    }
  ];

  await Promise.all(
    variants.map(async (variant) => {
      if (Number.isNaN(variant.price) || variant.price < 0) {
        throw new Error(`${variant.duration} price must be a valid positive number`);
      }

      await Plan.findOneAndUpdate(
        {
          planCode: normalizedCode,
          duration: variant.duration
        },
        {
          planCode: normalizedCode,
          name: normalizedName,
          duration: variant.duration,
          price: variant.price,
          currency: String(currency || "USD").toUpperCase(),
          description: String(description || "").trim(),
          features: featureList,
          isActive: Boolean(isActive),
          isPopular: Boolean(isPopular),
          sortOrder
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
    })
  );

  return getPlanCatalogEntry(normalizedCode);
};

export const deleteAdminPlan = async (planCode) => {
  const normalizedCode = normalizePlanCode(planCode);
  await Plan.deleteMany({ planCode: normalizedCode });
};
