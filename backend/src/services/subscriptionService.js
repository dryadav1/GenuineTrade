import Buyer from "../models/Buyer.js";
import Exporter from "../models/Exporter.js";
import Match from "../models/Match.js";
import Payment from "../models/Payment.js";
import RFQ from "../models/RFQ.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import WebhookEvent from "../models/WebhookEvent.js";
import { createHttpError } from "../utils/httpErrors.js";
import { createAuditLog } from "./auditService.js";
import { createNotification } from "./notificationService.js";
import {
  getPaymentProvider,
  listPaymentProviders,
  normalizePaymentProvider,
  resolvePaymentMethods
} from "./paymentMethodService.js";
import { getProfileByUser } from "./profileService.js";
import {
  createRazorpaySubscriptionCheckout,
  validateRazorpayWebhookSignature,
  verifyRazorpayPaymentSignature
} from "./payments/razorpayProvider.js";
import {
  constructStripeWebhookEvent,
  createStripeSubscriptionCheckoutSession,
  retrieveStripeCheckoutSession
} from "./payments/stripeProvider.js";
import {
  getPlanCatalogEntry,
  getPlanVariant,
  listPricingPlans
} from "./planService.js";
import {
  getPlanByCode,
  hasPlanFeature,
  normalizePlanCode,
  normalizePlanDuration
} from "./subscriptionPlans.js";
import { toMinorUnits } from "../utils/currency.js";

const DEFAULT_SUCCESS_URL =
  process.env.STRIPE_CHECKOUT_SUCCESS_URL || "http://localhost:3000/pricing/success";
const DEFAULT_CANCEL_URL =
  process.env.STRIPE_CHECKOUT_CANCEL_URL || "http://localhost:3000/pricing";

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const addYears = (date, years) => {
  const nextDate = new Date(date);
  nextDate.setFullYear(nextDate.getFullYear() + years);
  return nextDate;
};

const getCurrentPeriodEnd = (now, billingCycle) =>
  billingCycle === "annual" ? addYears(now, 1) : addDays(now, 30);

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const currentUsagePeriodKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const createReference = () =>
  `GT-SUB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const createInvoiceNumber = () =>
  `INV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;

const normalizeBillingCycle = (billingCycle = "monthly") =>
  normalizePlanDuration(billingCycle) === "yearly" ? "yearly" : "monthly";

const normalizeCurrencyCode = (currency = "USD") =>
  String(currency || "USD").trim().toUpperCase() || "USD";

const buildCheckoutUrl = (url, params = {}) => {
  try {
    const parsed = new URL(url);
    Object.entries(params).forEach(([key, value]) => {
      parsed.searchParams.set(key, value);
    });
    return parsed.toString();
  } catch (error) {
    const query = new URLSearchParams(params).toString();
    return `${url}${url.includes("?") ? "&" : "?"}${query}`;
  }
};

const isPaymentProviderConfigured = (provider) => {
  if (provider === "stripe") {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  if (provider === "razorpay") {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  }

  return false;
};

const serializePaymentProviderOptions = (country = "") =>
  listPaymentProviders(country).map((provider) => ({
    ...provider,
    availability: isPaymentProviderConfigured(provider.provider)
      ? "live"
      : "test_fallback"
  }));

const resolveCheckoutProvider = ({
  requestedProvider,
  recommendedProvider
}) => {
  const normalizedRequestedProvider = normalizePaymentProvider(requestedProvider);

  if (normalizedRequestedProvider) {
    return normalizedRequestedProvider;
  }

  const normalizedRecommendedProvider = normalizePaymentProvider(recommendedProvider);
  return normalizedRecommendedProvider || "stripe";
};

const syncUserPlanFields = async ({
  userId,
  planCode,
  planStartDate = null,
  planExpiry
}) => {
  await User.findByIdAndUpdate(userId, {
    subscriptionPlan: normalizePlanCode(planCode),
    planStartDate: planStartDate || null,
    planExpiry: planExpiry || null
  });
};

const recordWebhookEvent = async ({
  provider,
  providerEventId,
  eventType,
  signature,
  payload
}) =>
  WebhookEvent.findOneAndUpdate(
    {
      provider,
      providerEventId
    },
    {
      provider,
      providerEventId,
      eventType,
      signature,
      payload,
      processingStatus: "received"
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

const getEmptyNotificationState = () => ({
  usageAlerts: {},
  expiryReminderKey: ""
});

const ensureNotificationState = (subscription) => {
  subscription.notificationState = {
    ...getEmptyNotificationState(),
    ...(subscription.notificationState || {})
  };

  return subscription.notificationState;
};

const hasActiveEntitlement = (subscription) => {
  if (!subscription) {
    return false;
  }

  if (subscription.status === "active") {
    return true;
  }

  return (
    subscription.status === "cancelled" &&
    subscription.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd).getTime() > Date.now()
  );
};

const getAccessPlanCode = (subscription) =>
  hasActiveEntitlement(subscription) ? normalizePlanCode(subscription.planCode) : "free";

export const serializePlanCatalog = async () => listPricingPlans();

export const serializePayment = (payment) => ({
  id: payment._id,
  planCode: normalizePlanCode(payment.planCode),
  planName: payment.planName || getPlanByCode(payment.planCode).name,
  billingCycle: normalizeBillingCycle(payment.billingCycle),
  amount: payment.amount,
  currency: normalizeCurrencyCode(payment.currency),
  provider: payment.provider,
  status: payment.status,
  reference: payment.reference,
  invoiceNumber: payment.invoiceNumber,
  invoiceUrl: payment.invoiceUrl,
  paidAt: payment.paidAt
});

const serializeUsageBucket = (used, limit) => {
  const unlimited = limit === null;
  const remaining = unlimited ? null : Math.max(limit - used, 0);
  const usageRatio = unlimited || limit === 0 ? 0 : used / limit;

  return {
    used,
    limit,
    limitLabel: unlimited ? "Unlimited" : limit,
    remaining,
    unlimited,
    usageRatio
  };
};

export const serializeSubscription = (subscription, usage = null) => {
  const plan = getPlanByCode(subscription?.planCode || "free");

  return {
    planCode: plan.code,
    planType: plan.code.toUpperCase(),
    planName: subscription?.planName || plan.name,
    tier: plan.tier,
    badge: plan.badge,
    status: subscription?.status || "active",
    billingCycle: normalizeBillingCycle(subscription?.billingCycle || "monthly"),
    amount: plan.code === "free" ? 0 : subscription?.amount || 0,
    currency: normalizeCurrencyCode(subscription?.currency || "USD"),
    paymentProvider: subscription?.paymentProvider || "free_tier",
    currentPeriodStart: subscription?.currentPeriodStart || null,
    currentPeriodEnd: subscription?.currentPeriodEnd || null,
    nextChargeAt: subscription?.nextChargeAt || null,
    lastPaymentStatus: subscription?.lastPaymentStatus || "none",
    lastPaymentAt: subscription?.lastPaymentAt || null,
    lastReference: subscription?.lastReference || "",
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd || false,
    autoRenew: subscription?.autoRenew ?? true,
    visibilityBoost: plan.visibilityBoost,
    rankingPriority: plan.rankingPriority,
    features: plan.defaultFeatures || plan.features || [],
    limits: {
      rfqsPerMonth:
        plan.limits.rfqsPerMonth === null ? "Unlimited" : plan.limits.rfqsPerMonth,
      matchesPerMonth:
        plan.limits.matchesPerMonth === null
          ? "Unlimited"
          : plan.limits.matchesPerMonth
    },
    rawLimits: plan.limits,
    access: plan.access,
    usage
  };
};

const decorateSubscriptionSnapshot = async (subscription, usage = null) => {
  const snapshot = serializeSubscription(subscription, usage);
  const catalogEntry = await getPlanCatalogEntry(snapshot.planCode);
  const activeVariant = await getPlanVariant(snapshot.planCode, snapshot.billingCycle, {
    includeInactive: true
  });

  if (!catalogEntry) {
    return snapshot;
  }

  return {
    ...snapshot,
    planName: activeVariant?.name || catalogEntry.name || snapshot.planName,
    badge:
      catalogEntry.isPopular && snapshot.planCode !== "enterprise"
        ? "Most Popular"
        : snapshot.badge,
    description: catalogEntry.description || "",
    features:
      catalogEntry.features && catalogEntry.features.length
        ? catalogEntry.features
        : snapshot.features,
    isPopular: Boolean(catalogEntry.isPopular),
    amount:
      snapshot.planCode === "free"
        ? 0
        : subscription?.amount ?? activeVariant?.price ?? snapshot.amount,
    currency: normalizeCurrencyCode(
      subscription?.currency || activeVariant?.currency || snapshot.currency
    ),
    currentPlan: activeVariant
      ? {
          id: activeVariant.id,
          duration: activeVariant.duration,
          price: activeVariant.price,
          currency: normalizeCurrencyCode(activeVariant.currency),
          isActive: activeVariant.isActive
        }
      : null
  };
};

const buildUserUsage = async (user) => {
  const monthStart = startOfMonth();
  const usagePeriod = currentUsagePeriodKey();

  if (user.role === "buyer") {
    const buyer = await Buyer.findOne({ userId: user._id });
    const [rfqsUsed, matchesUsed] = await Promise.all([
      RFQ.countDocuments({
        buyerId: buyer?._id,
        createdAt: {
          $gte: monthStart
        }
      }),
      Match.countDocuments({
        buyerId: buyer?._id,
        createdAt: {
          $gte: monthStart
        }
      })
    ]);

    return {
      period: usagePeriod,
      rfqsUsed,
      matchesUsed
    };
  }

  if (user.role === "exporter") {
    const exporter = await Exporter.findOne({ userId: user._id });
    const matchesUsed = await Match.countDocuments({
      exporterId: exporter?._id,
      createdAt: {
        $gte: monthStart
      }
    });

    return {
      period: usagePeriod,
      rfqsUsed: 0,
      matchesUsed
    };
  }

  return {
    period: usagePeriod,
    rfqsUsed: 0,
    matchesUsed: 0
  };
};

export const calculateSubscriptionUsage = async (user, subscription) => {
  const usage = await buildUserUsage(user);
  const plan = getPlanByCode(getAccessPlanCode(subscription));

  return {
    period: usage.period,
    rfqs: serializeUsageBucket(usage.rfqsUsed, plan.limits.rfqsPerMonth),
    matches: serializeUsageBucket(usage.matchesUsed, plan.limits.matchesPerMonth)
  };
};

const maybeSendUsageAlert = async ({
  user,
  subscription,
  metricKey,
  usageEntry,
  plan
}) => {
  if (usageEntry.unlimited || user.role === "admin") {
    return;
  }

  const notificationState = ensureNotificationState(subscription);
  const usageAlerts = notificationState.usageAlerts || {};
  const periodKey = currentUsagePeriodKey();
  let nextAlertLevel = "";

  if (usageEntry.remaining <= 0) {
    nextAlertLevel = "limit_reached";
  } else if (usageEntry.usageRatio >= 0.8) {
    nextAlertLevel = "approaching_limit";
  }

  if (!nextAlertLevel) {
    return;
  }

  const stateKey = `${metricKey}:${periodKey}`;
  if (usageAlerts[stateKey] === nextAlertLevel) {
    return;
  }

  usageAlerts[stateKey] = nextAlertLevel;
  subscription.notificationState = {
    ...notificationState,
    usageAlerts
  };
  await subscription.save();

  const humanMetric = metricKey === "rfqs" ? "RFQs" : "matches";
  const body =
    nextAlertLevel === "limit_reached"
      ? `You have reached your ${humanMetric} limit for this month on the ${plan.name} plan.`
      : `You have used ${Math.round(
          usageEntry.usageRatio * 100
        )}% of your monthly ${humanMetric} quota.`;

  await createNotification({
    recipientId: user._id,
    type: "subscription",
    title:
      nextAlertLevel === "limit_reached"
        ? `${humanMetric} limit reached`
        : `${humanMetric} limit warning`,
    body: `${body} Upgrade to unlock more capacity and higher visibility.`,
    actionUrl: "/profile",
    entityType: "Subscription",
    entityId: subscription._id.toString(),
    metadata: {
      metric: metricKey,
      alertLevel: nextAlertLevel
    }
  });
};

const maybeSendExpiryReminder = async ({ user, subscription }) => {
  const plan = getPlanByCode(getAccessPlanCode(subscription));

  if (plan.tier !== "paid" || !subscription.currentPeriodEnd) {
    return;
  }

  const msUntilExpiry =
    new Date(subscription.currentPeriodEnd).getTime() - Date.now();
  const daysUntilExpiry = Math.ceil(msUntilExpiry / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry > 7 || daysUntilExpiry < 0) {
    return;
  }

  const notificationState = ensureNotificationState(subscription);
  const reminderKey = `expiry:${new Date(subscription.currentPeriodEnd).toISOString()}`;

  if (notificationState.expiryReminderKey === reminderKey) {
    return;
  }

  subscription.notificationState = {
    ...notificationState,
    expiryReminderKey: reminderKey
  };
  await subscription.save();

  await createNotification({
    recipientId: user._id,
    type: "subscription",
    title: "Subscription renewal coming up",
    body: `Your ${plan.name} plan renews on ${new Date(
      subscription.currentPeriodEnd
    ).toLocaleDateString()}.`,
    actionUrl: "/profile",
    entityType: "Subscription",
    entityId: subscription._id.toString(),
    metadata: {
      planCode: plan.code
    }
  });
};

const createFreeSubscriptionPayload = (user) => ({
  userId: user._id,
  role: user.role,
  planCode: "free",
  planName: "Free",
  billingCycle: "monthly",
  status: "active",
  amount: 0,
  currency: "USD",
  paymentProvider: "free_tier",
  currentPeriodStart: new Date(),
  currentPeriodEnd: null,
  nextChargeAt: null,
  lastPaymentStatus: "none",
  lastPaymentAt: null,
  lastReference: "",
  cancelAtPeriodEnd: false,
  autoRenew: true
});

export const ensureFreeSubscription = async (user) => {
  let subscription;

  try {
    subscription = await Subscription.findOneAndUpdate(
      {
        userId: user._id
      },
      {
        $setOnInsert: createFreeSubscriptionPayload(user)
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
  } catch (error) {
    if (error?.code !== 11000) {
      throw error;
    }

    subscription = await Subscription.findOne({ userId: user._id });
  }

  if (!subscription) {
    throw createHttpError("Unable to load subscription for this account.", 500);
  }

  const normalizedPlanCode = normalizePlanCode(subscription.planCode);
  const updates = {};

  if (subscription.planCode !== normalizedPlanCode) {
    updates.planCode = normalizedPlanCode;
  }

  if (!subscription.planName) {
    updates.planName = getPlanByCode(normalizedPlanCode).name;
  }

  if (!subscription.status) {
    updates.status = "active";
  }

  if (
    normalizedPlanCode === "free" &&
    subscription.status !== "active"
  ) {
    updates.status = "active";
    updates.amount = 0;
    updates.paymentProvider = "free_tier";
    updates.currentPeriodStart = subscription.currentPeriodStart || new Date();
    updates.currentPeriodEnd = null;
    updates.nextChargeAt = null;
    updates.planName = "Free";
  }

  if (Object.keys(updates).length) {
    subscription = await Subscription.findOneAndUpdate(
      { _id: subscription._id },
      updates,
      { new: true }
    );
  }

  await syncUserPlanFields({
    userId: user._id,
    planCode: subscription.planCode || "free",
    planStartDate: subscription.currentPeriodStart || null,
    planExpiry: subscription.currentPeriodEnd
  });

  return subscription;
};

export const getOrCreateSubscription = async (user) => ensureFreeSubscription(user);

const createPaymentRecord = async ({
  subscription,
  user,
  planCode,
  planName,
  billingCycle,
  amount,
  currency,
  provider,
  reference,
  status,
  providerPaymentId = "",
  providerInvoiceId = "",
  invoiceUrl = "",
  metadata = {}
}) => {
  const existingPayment = await Payment.findOne({ reference });

  if (existingPayment) {
    existingPayment.planCode = planCode;
    existingPayment.planName = planName || existingPayment.planName;
    existingPayment.billingCycle = normalizeBillingCycle(billingCycle);
    existingPayment.amount = amount;
    existingPayment.currency = normalizeCurrencyCode(currency);
    existingPayment.provider = provider;
    existingPayment.status = status;
    existingPayment.invoiceUrl = invoiceUrl || existingPayment.invoiceUrl;
    existingPayment.providerPaymentId =
      providerPaymentId || existingPayment.providerPaymentId;
    existingPayment.providerInvoiceId =
      providerInvoiceId || existingPayment.providerInvoiceId;
    existingPayment.paidAt =
      status === "paid" ? existingPayment.paidAt || new Date() : existingPayment.paidAt;
    existingPayment.metadata = {
      ...(existingPayment.metadata || {}),
      ...metadata
    };
    await existingPayment.save();
    return existingPayment;
  }

  return Payment.create({
    subscriptionId: subscription._id,
    userId: user._id,
    planCode,
    planName,
    billingCycle: normalizeBillingCycle(billingCycle),
    amount,
    currency: normalizeCurrencyCode(currency),
    provider,
    status,
    reference,
    invoiceNumber: createInvoiceNumber(),
    invoiceUrl,
    providerPaymentId,
    providerInvoiceId,
    paidAt: status === "paid" ? new Date() : null,
    metadata
  });
};

const activateSubscriptionRecord = async ({
  user,
  subscription,
  planCode,
  planName = "",
  billingCycle,
  amount,
  currency,
  provider,
  providerCustomerId = "",
  providerSubscriptionId = "",
  providerPriceId = "",
  reference = createReference(),
  paymentStatus = "paid",
  note = "",
  actor = user,
  source = "self_service"
}) => {
  const normalizedPlan = getPlanByCode(planCode);
  const catalogEntry = await getPlanCatalogEntry(normalizedPlan.code);
  const resolvedPlanName = planName || catalogEntry?.name || normalizedPlan.name;
  const now = new Date();
  const currentPeriodEnd =
    normalizedPlan.code === "free" ? null : getCurrentPeriodEnd(now, billingCycle);

  subscription.planCode = normalizedPlan.code;
  subscription.planName = resolvedPlanName;
  subscription.billingCycle = normalizeBillingCycle(billingCycle);
  subscription.status = "active";
  subscription.amount = normalizedPlan.code === "free" ? 0 : amount;
  subscription.currency = normalizeCurrencyCode(currency);
  subscription.paymentProvider = normalizedPlan.code === "free" ? "free_tier" : provider;
  subscription.providerCustomerId = providerCustomerId || subscription.providerCustomerId;
  subscription.providerSubscriptionId =
    providerSubscriptionId || subscription.providerSubscriptionId;
  subscription.providerPriceId = providerPriceId || subscription.providerPriceId;
  subscription.currentPeriodStart = now;
  subscription.currentPeriodEnd = currentPeriodEnd;
  subscription.nextChargeAt = currentPeriodEnd;
  subscription.lastPaymentStatus = normalizedPlan.code === "free" ? "none" : paymentStatus;
  subscription.lastPaymentAt =
    normalizedPlan.code === "free" || paymentStatus !== "paid" ? null : now;
  subscription.lastReference = normalizedPlan.code === "free" ? "" : reference;
  subscription.cancelAtPeriodEnd = false;
  subscription.autoRenew = true;
  subscription.notes = note || subscription.notes;
  await subscription.save();

  await syncUserPlanFields({
    userId: user._id,
    planCode: normalizedPlan.code,
    planStartDate: now,
    planExpiry: currentPeriodEnd
  });

  let payment = null;

  if (normalizedPlan.code !== "free") {
    payment = await createPaymentRecord({
      subscription,
      user,
      planCode: normalizedPlan.code,
      planName: resolvedPlanName,
      billingCycle,
      amount,
      currency,
      provider,
      reference,
      status: paymentStatus,
      metadata: {
        source
      }
    });
  }

  await createAuditLog({
    actorId: actor?._id || null,
    actorRole: actor?.role || "system",
    action: "subscription.updated",
    entityType: "Subscription",
    entityId: subscription._id.toString(),
    metadata: {
      title: "Subscription updated",
      summary: `${user.email} moved to the ${resolvedPlanName} plan.`,
      status: subscription.status,
      planCode: normalizedPlan.code,
      billingCycle,
      amount: subscription.amount,
      source
    }
  });

  await createNotification({
    recipientId: user._id,
    type: "subscription",
    title: "Subscription updated",
    body:
      normalizedPlan.code === "free"
        ? "Your account is now on the Free plan."
        : `Your ${resolvedPlanName} plan is now active.`,
    actionUrl: "/profile",
    entityType: "Subscription",
    entityId: subscription._id.toString(),
    metadata: {
      planCode: normalizedPlan.code
    }
  });

  return {
    subscription,
    payment
  };
};

const createPendingSubscriptionRecord = async ({
  user,
  subscription,
  planCode,
  planName = "",
  billingCycle,
  amount,
  currency,
  provider,
  reference,
  providerPriceId = ""
}) => {
  subscription.paymentProvider = provider;
  subscription.providerPriceId = providerPriceId;
  subscription.lastPaymentStatus = "pending";
  subscription.lastReference = reference;
  subscription.cancelAtPeriodEnd = false;
  await subscription.save();

  const payment = await createPaymentRecord({
    subscription,
    user,
    planCode: subscription.planCode,
    planName: subscription.planName,
    billingCycle,
    amount,
    currency,
    provider,
    reference,
    status: "pending",
    metadata: {
      stage: "checkout_created",
      targetPlanCode: normalizePlanCode(planCode),
      targetPlanName: planName || getPlanByCode(planCode).name,
      targetBillingCycle: normalizeBillingCycle(billingCycle),
      targetAmount: amount,
      targetCurrency: normalizeCurrencyCode(currency)
    }
  });

  return {
    subscription,
    payment
  };
};

const getUserBillingProfile = async (user) => {
  const profile = await getProfileByUser(user);
  const country = profile?.country || user?.country || "";

  return {
    profile,
    country,
    routing: resolvePaymentMethods(country)
  };
};

export const getAvailableCheckoutProviders = async (user) => {
  const { country } = await getUserBillingProfile(user);

  return {
    country,
    items: serializePaymentProviderOptions(country)
  };
};

export const getSubscriptionSnapshot = async (user) => {
  const subscription = await getOrCreateSubscription(user);
  const usage = await calculateSubscriptionUsage(user, subscription);

  await maybeSendUsageAlert({
    user,
    subscription,
    metricKey: "rfqs",
    usageEntry: usage.rfqs,
    plan: getPlanByCode(getAccessPlanCode(subscription))
  });
  await maybeSendUsageAlert({
    user,
    subscription,
    metricKey: "matches",
    usageEntry: usage.matches,
    plan: getPlanByCode(getAccessPlanCode(subscription))
  });
  await maybeSendExpiryReminder({ user, subscription });

  return decorateSubscriptionSnapshot(subscription, usage);
};

export const getUserPayments = async (userId) => {
  const payments = await Payment.find({ userId }).sort({ createdAt: -1 });
  return payments.map(serializePayment);
};

export const getSubscriptionAccessSnapshot = async (user) => {
  const subscription = await getOrCreateSubscription(user);
  const usage = await calculateSubscriptionUsage(user, subscription);
  const plan = getPlanByCode(getAccessPlanCode(subscription));

  return {
    subscription,
    plan,
    usage,
    access: plan.access,
    features: plan.access
  };
};

const getCheckoutPlanSelection = async (
  planCode,
  billingCycle,
  { includeInactive = false } = {}
) => {
  const normalizedPlanCode = normalizePlanCode(planCode);
  const normalizedBillingCycle = normalizeBillingCycle(billingCycle);

  if (normalizedPlanCode === "free") {
    return {
      plan: getPlanByCode("free"),
      planCatalog: await getPlanCatalogEntry("free"),
      planVariant: await getPlanVariant("free", "monthly", { includeInactive: true }),
      normalizedPlanCode,
      normalizedBillingCycle: "monthly"
    };
  }

  const planCatalog = await getPlanCatalogEntry(normalizedPlanCode);
  const planVariant = await getPlanVariant(normalizedPlanCode, normalizedBillingCycle, {
    includeInactive: true
  });

  if (!planCatalog || !planVariant) {
    throw new Error("Invalid plan selected");
  }

  if (!includeInactive && (!planCatalog.isActive || !planVariant.isActive)) {
    throw new Error("Selected plan is currently inactive");
  }

  return {
    plan: getPlanByCode(normalizedPlanCode),
    planCatalog,
    planVariant,
    normalizedPlanCode,
    normalizedBillingCycle
  };
};

const serializeCheckoutState = async ({
  user,
  subscription,
  payment = null,
  checkout
}) => ({
  subscription: await decorateSubscriptionSnapshot(
    subscription,
    await calculateSubscriptionUsage(user, subscription)
  ),
  payment: payment ? serializePayment(payment) : null,
  checkout
});

const buildPlanDisplayName = ({ planCatalog, planVariant, fallbackPlan }) =>
  planVariant?.name || planCatalog?.name || fallbackPlan?.name || "Plan";

const updatePendingSubscriptionFailure = async ({
  subscription,
  user,
  reference,
  status = "failed",
  metadata = {}
}) => {
  subscription.lastPaymentStatus = status;
  subscription.lastReference = reference || subscription.lastReference;
  await subscription.save();

  await createPaymentRecord({
    subscription,
    user,
    planCode: subscription.planCode,
    planName: subscription.planName || getPlanByCode(subscription.planCode).name,
    billingCycle: subscription.billingCycle,
    amount: subscription.amount || 0,
    currency: subscription.currency || "USD",
    provider: subscription.paymentProvider || "stripe",
    reference: reference || subscription.lastReference || createReference(),
    status,
    metadata
  });
};

export const createSubscriptionCheckout = async ({
  user,
  planCode,
  billingCycle,
  paymentProvider,
  successUrl = DEFAULT_SUCCESS_URL,
  cancelUrl = DEFAULT_CANCEL_URL
}) => {
  const subscription = await getOrCreateSubscription(user);
  const {
    plan,
    planCatalog,
    planVariant,
    normalizedPlanCode,
    normalizedBillingCycle
  } = await getCheckoutPlanSelection(planCode, billingCycle);

  if (plan.code === "free") {
    const result = await activateSubscriptionRecord({
      user,
      subscription,
      planCode: "free",
      planName: "Free",
      billingCycle: "monthly",
      amount: 0,
      currency: "USD",
      provider: "free_tier",
      paymentStatus: "none",
      source: "self_service_downgrade"
    });

    return serializeCheckoutState({
      user,
      subscription: result.subscription,
      payment: result.payment,
      checkout: {
        mode: "instant",
        provider: "free_tier"
      }
    });
  }

  if (
    hasActiveEntitlement(subscription) &&
    normalizePlanCode(subscription.planCode) === normalizedPlanCode &&
    normalizeBillingCycle(subscription.billingCycle) === normalizedBillingCycle
  ) {
    return serializeCheckoutState({
      user,
      subscription,
      checkout: {
        mode: "already_active",
        provider: subscription.paymentProvider || "existing_plan"
      }
    });
  }

  const { country, profile, routing } = await getUserBillingProfile(user);
  const selectedProvider = resolveCheckoutProvider({
    requestedProvider: paymentProvider,
    recommendedProvider: routing.provider
  });
  const selectedProviderDetails = getPaymentProvider(selectedProvider);

  if (!selectedProviderDetails) {
    throw createHttpError(400, "Select a valid payment provider");
  }

  const amount = Number(planVariant.price || 0);
  const planName = buildPlanDisplayName({
    planCatalog,
    planVariant,
    fallbackPlan: plan
  });

  if (selectedProvider === "stripe" && isPaymentProviderConfigured("stripe")) {
    const checkoutSession = await createStripeSubscriptionCheckoutSession({
      planName,
      description: planVariant.description || planCatalog?.description || "",
      amount,
      currency: normalizeCurrencyCode(planVariant.currency || "USD"),
      customerEmail: user.email,
      successUrl: buildCheckoutUrl(successUrl, {
        session_id: "{CHECKOUT_SESSION_ID}"
      }),
      cancelUrl,
      userId: user._id,
      planId: planVariant.id || normalizedPlanCode,
      planCode: plan.code,
      billingCycle: normalizedBillingCycle
    });

    const pending = await createPendingSubscriptionRecord({
      user,
      subscription,
      planCode: plan.code,
      planName,
      billingCycle: normalizedBillingCycle,
      amount,
      currency: normalizeCurrencyCode(planVariant.currency || "USD"),
      provider: "stripe",
      reference: checkoutSession.providerReference,
      providerPriceId: planVariant.id || ""
    });

    await createNotification({
      recipientId: user._id,
      type: "subscription",
      title: "Complete your checkout",
      body: `Finish checkout to activate the ${planName} plan.`,
      actionUrl: checkoutSession.checkoutUrl || "/pricing",
      entityType: "Subscription",
      entityId: pending.subscription._id.toString()
    });

    return serializeCheckoutState({
      user,
      subscription: pending.subscription,
      payment: pending.payment,
      checkout: {
        mode: checkoutSession.checkoutMode,
        provider: "stripe",
        url: checkoutSession.checkoutUrl,
        reference: checkoutSession.providerReference,
        country,
        sessionId: checkoutSession.providerReference,
        recommendedProvider: routing.provider
      }
    });
  }

  if (selectedProvider === "razorpay" && isPaymentProviderConfigured("razorpay")) {
    const razorpayCurrency = "INR";
    const razorpayCheckout = await createRazorpaySubscriptionCheckout({
      amount,
      currency: razorpayCurrency,
      customerEmail: user.email,
      customerName: user.name,
      customerPhone: profile?.phone || user.phone || "",
      userId: user._id,
      planId: planVariant.id || normalizedPlanCode,
      planName,
      planCode: plan.code,
      billingCycle: normalizedBillingCycle
    });

    const pending = await createPendingSubscriptionRecord({
      user,
      subscription,
      planCode: plan.code,
      planName,
      billingCycle: normalizedBillingCycle,
      amount,
      currency: razorpayCurrency,
      provider: "razorpay",
      reference: razorpayCheckout.providerReference,
      providerPriceId: planVariant.id || ""
    });

    return serializeCheckoutState({
      user,
      subscription: pending.subscription,
      payment: pending.payment,
      checkout: {
        mode: razorpayCheckout.checkoutMode,
        provider: "razorpay",
        url: razorpayCheckout.checkoutUrl,
        keyId: process.env.RAZORPAY_KEY_ID || "",
        reference: razorpayCheckout.providerReference,
        country,
        recommendedProvider: routing.provider,
        checkoutConfig: razorpayCheckout.checkoutConfig
      }
    });
  }

  const result = await activateSubscriptionRecord({
    user,
    subscription,
    planCode: plan.code,
    planName,
    billingCycle: normalizedBillingCycle,
    amount,
    currency:
      selectedProvider === "razorpay"
        ? "INR"
        : normalizeCurrencyCode(planVariant.currency || "USD"),
    provider: "test_mode",
    paymentStatus: "paid",
    source: "local_test_checkout"
  });

  return serializeCheckoutState({
    user,
    subscription: result.subscription,
    payment: result.payment,
    checkout: {
      mode: "instant",
      provider: "test_mode",
      country,
      selectedProvider
    }
  });
};

const assertStripeCheckoutMatchesPlan = ({ session, amount, currency }) => {
  const expectedAmount = toMinorUnits(amount, currency);
  const actualAmount = Number(session.amount_total || session.amount_subtotal || 0);
  const actualCurrency = normalizeCurrencyCode(session.currency || currency);

  if (actualAmount && actualAmount !== expectedAmount) {
    throw new Error("Stripe checkout amount mismatch");
  }

  if (actualCurrency !== normalizeCurrencyCode(currency)) {
    throw new Error("Stripe checkout currency mismatch");
  }
};

export const confirmStripeSubscriptionCheckout = async ({ user, sessionId }) => {
  if (!sessionId) {
    throw new Error("Stripe session ID is required");
  }

  const session = await retrieveStripeCheckoutSession(sessionId);
  const metadata = session.metadata || {};

  if (String(metadata.userId || "") !== user._id.toString()) {
    throw new Error("This checkout session does not belong to the current user");
  }

  if (!["paid", "no_payment_required"].includes(session.payment_status || "")) {
    throw new Error("Stripe checkout has not been paid yet");
  }

  const subscription =
    (await Subscription.findOne({ userId: user._id, lastReference: session.id })) ||
    (await getOrCreateSubscription(user));

  if (
    hasActiveEntitlement(subscription) &&
    subscription.lastReference === session.id &&
    subscription.lastPaymentStatus === "paid"
  ) {
    return serializeCheckoutState({
      user,
      subscription,
      checkout: {
        mode: "confirmed",
        provider: "stripe",
        reference: session.id
      }
    });
  }

  const {
    plan,
    planCatalog,
    planVariant,
    normalizedBillingCycle
  } = await getCheckoutPlanSelection(
    metadata.planCode || subscription.planCode,
    metadata.billingCycle || subscription.billingCycle,
    { includeInactive: true }
  );
  const amount = Number(planVariant?.price ?? subscription.amount ?? 0);
  const currency = normalizeCurrencyCode(planVariant?.currency || subscription.currency || "USD");
  const planName = buildPlanDisplayName({
    planCatalog,
    planVariant,
    fallbackPlan: plan
  });

  assertStripeCheckoutMatchesPlan({
    session,
    amount,
    currency
  });

  const result = await activateSubscriptionRecord({
    user,
    subscription,
    planCode: plan.code,
    planName,
    billingCycle: normalizedBillingCycle,
    amount,
    currency,
    provider: "stripe",
    providerCustomerId: session.customer?.toString?.() || "",
    providerPriceId: subscription.providerPriceId || planVariant?.id || "",
    reference: session.id,
    providerSubscriptionId: "",
    paymentStatus: "paid",
    source: "stripe_checkout_confirmation"
  });

  if (session.payment_intent) {
    await createPaymentRecord({
      subscription: result.subscription,
      user,
      planCode: plan.code,
      planName,
      billingCycle: normalizedBillingCycle,
      amount,
      currency,
      provider: "stripe",
      reference: session.id,
      status: "paid",
      providerPaymentId: session.payment_intent.toString(),
      metadata: {
        source: "stripe_checkout_confirmation"
      }
    });
  }

  return serializeCheckoutState({
    user,
    subscription: result.subscription,
    payment: result.payment,
    checkout: {
      mode: "confirmed",
      provider: "stripe",
      reference: session.id
    }
  });
};

export const confirmRazorpaySubscriptionCheckout = async ({
  user,
  orderId,
  paymentId,
  signature
}) => {
  if (!orderId || !paymentId || !signature) {
    throw new Error("Razorpay payment details are required");
  }

  const isValid = verifyRazorpayPaymentSignature({
    orderId,
    paymentId,
    signature
  });

  if (!isValid) {
    throw new Error("Invalid Razorpay payment signature");
  }

  const pendingPayment = await Payment.findOne({
    userId: user._id,
    reference: orderId
  });
  const subscription = await Subscription.findOne({
    userId: user._id,
    lastReference: orderId
  });

  if (!subscription || !pendingPayment) {
    throw new Error("Pending subscription not found for this Razorpay order");
  }

  if (
    hasActiveEntitlement(subscription) &&
    subscription.lastReference === orderId &&
    subscription.lastPaymentStatus === "paid"
  ) {
    return serializeCheckoutState({
      user,
      subscription,
      checkout: {
        mode: "confirmed",
        provider: "razorpay",
        reference: orderId
      }
    });
  }

  const {
    plan,
    planCatalog,
    planVariant,
    normalizedBillingCycle
  } = await getCheckoutPlanSelection(
    pendingPayment.metadata?.targetPlanCode || subscription.planCode,
    pendingPayment.metadata?.targetBillingCycle || subscription.billingCycle,
    {
      includeInactive: true
    }
  );
  const amount = Number(
    pendingPayment.metadata?.targetAmount ?? subscription.amount ?? planVariant?.price ?? 0
  );
  const currency = normalizeCurrencyCode(
    pendingPayment.metadata?.targetCurrency || "INR"
  );
  const planName = buildPlanDisplayName({
    planCatalog,
    planVariant,
    fallbackPlan: plan
  });

  const result = await activateSubscriptionRecord({
    user,
    subscription,
    planCode: plan.code,
    planName,
    billingCycle: normalizedBillingCycle,
    amount,
    currency,
    provider: "razorpay",
    providerPriceId: subscription.providerPriceId || planVariant?.id || "",
    reference: orderId,
    providerSubscriptionId: "",
    paymentStatus: "paid",
    source: "razorpay_signature_confirmation"
  });

  await createPaymentRecord({
    subscription: result.subscription,
    user,
    planCode: plan.code,
    planName,
    billingCycle: normalizedBillingCycle,
    amount,
    currency,
    provider: "razorpay",
    reference: orderId,
    status: "paid",
    providerPaymentId: paymentId,
    metadata: {
      signatureVerified: true,
      source: "razorpay_signature_confirmation"
    }
  });

  return serializeCheckoutState({
    user,
    subscription: result.subscription,
    payment: result.payment,
    checkout: {
      mode: "confirmed",
      provider: "razorpay",
      reference: orderId
    }
  });
};

export const handleStripeSubscriptionWebhook = async ({
  payloadBuffer,
  signature
}) => {
  const event = constructStripeWebhookEvent(payloadBuffer, signature);
  const webhookEvent = await recordWebhookEvent({
    provider: "stripe",
    providerEventId: event.id,
    eventType: event.type,
    signature,
    payload: event
  });
  const session = event.data?.object || {};
  const metadata = session.metadata || {};

  if (metadata.paymentContext !== "subscription_plan") {
    webhookEvent.processingStatus = "ignored";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return webhookEvent;
  }

  const user = await User.findById(metadata.userId);
  if (!user) {
    webhookEvent.processingStatus = "failed";
    await webhookEvent.save();
    throw new Error("User not found for Stripe subscription webhook");
  }

  if (
    event.type === "checkout.session.expired" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const pendingSubscription = await Subscription.findOne({
      userId: user._id,
      lastReference: session.id
    });

    if (pendingSubscription) {
      await updatePendingSubscriptionFailure({
        subscription: pendingSubscription,
        user,
        reference: session.id,
        metadata: {
          eventType: event.type,
          source: "stripe_webhook"
        }
      });
    }

    webhookEvent.processingStatus = "processed";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return webhookEvent;
  }

  if (
    !["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(
      event.type
    ) ||
    !["paid", "no_payment_required"].includes(session.payment_status || "")
  ) {
    webhookEvent.processingStatus = "ignored";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return webhookEvent;
  }

  await confirmStripeSubscriptionCheckout({
    user,
    sessionId: session.id
  });

  webhookEvent.processingStatus = "processed";
  webhookEvent.processedAt = new Date();
  await webhookEvent.save();

  return webhookEvent;
};

export const handleRazorpaySubscriptionWebhook = async ({
  rawBody,
  signature,
  payload
}) => {
  const signatureValid = validateRazorpayWebhookSignature(rawBody, signature);

  if (!signatureValid) {
    throw new Error("Invalid Razorpay webhook signature");
  }

  const orderId = payload?.payload?.order?.entity?.id;
  const paymentEntity = payload?.payload?.payment?.entity;
  const notes =
    payload?.payload?.order?.entity?.notes || paymentEntity?.notes || {};
  const providerEventId =
    paymentEntity?.id || orderId || `${payload?.event || "razorpay"}-${Date.now()}`;

  const webhookEvent = await recordWebhookEvent({
    provider: "razorpay",
    providerEventId,
    eventType: payload?.event || "unknown",
    signature,
    payload
  });

  if (notes.paymentContext !== "subscription_plan") {
    webhookEvent.processingStatus = "ignored";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return webhookEvent;
  }

  if (!orderId || !paymentEntity?.id) {
    webhookEvent.processingStatus = "ignored";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return webhookEvent;
  }

  const user = await User.findById(notes.userId);
  if (!user) {
    webhookEvent.processingStatus = "failed";
    await webhookEvent.save();
    throw new Error("User not found for Razorpay subscription webhook");
  }

  if (payload.event === "payment.failed") {
    const pendingSubscription = await Subscription.findOne({
      userId: user._id,
      lastReference: orderId
    });

    if (pendingSubscription) {
      await updatePendingSubscriptionFailure({
        subscription: pendingSubscription,
        user,
        reference: orderId,
        metadata: {
          eventType: payload.event,
          source: "razorpay_webhook"
        }
      });
    }

    webhookEvent.processingStatus = "processed";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return webhookEvent;
  }

  if (payload.event !== "payment.captured") {
    webhookEvent.processingStatus = "ignored";
    webhookEvent.processedAt = new Date();
    await webhookEvent.save();
    return webhookEvent;
  }

  const pendingPayment = await Payment.findOne({
    userId: user._id,
    reference: orderId
  });
  const subscription = await Subscription.findOne({
    userId: user._id,
    lastReference: orderId
  });

  if (!subscription || !pendingPayment) {
    webhookEvent.processingStatus = "failed";
    await webhookEvent.save();
    throw new Error("Pending subscription not found for Razorpay webhook");
  }

  const {
    plan,
    planCatalog,
    planVariant,
    normalizedBillingCycle
  } = await getCheckoutPlanSelection(
    pendingPayment.metadata?.targetPlanCode || subscription.planCode,
    pendingPayment.metadata?.targetBillingCycle || subscription.billingCycle,
    {
      includeInactive: true
    }
  );
  const amount = Number(
    pendingPayment.metadata?.targetAmount ?? subscription.amount ?? planVariant?.price ?? 0
  );
  const currency = normalizeCurrencyCode(
    pendingPayment.metadata?.targetCurrency || "INR"
  );
  const planName = buildPlanDisplayName({
    planCatalog,
    planVariant,
    fallbackPlan: plan
  });

  const result = await activateSubscriptionRecord({
    user,
    subscription,
    planCode: plan.code,
    planName,
    billingCycle: normalizedBillingCycle,
    amount,
    currency,
    provider: "razorpay",
    providerPriceId: subscription.providerPriceId || planVariant?.id || "",
    reference: orderId,
    providerSubscriptionId: "",
    paymentStatus: "paid",
    source: "razorpay_webhook"
  });

  await createPaymentRecord({
    subscription: result.subscription,
    user,
    planCode: plan.code,
    planName,
    billingCycle: normalizedBillingCycle,
    amount,
    currency,
    provider: "razorpay",
    reference: orderId,
    status: "paid",
    providerPaymentId: paymentEntity.id,
    metadata: {
      source: "razorpay_webhook"
    }
  });

  webhookEvent.processingStatus = "processed";
  webhookEvent.processedAt = new Date();
  await webhookEvent.save();

  return webhookEvent;
};

export const cancelUserSubscription = async (user) => {
  const subscription = await getOrCreateSubscription(user);

  if (getAccessPlanCode(subscription) === "free") {
    throw new Error("Free plan is already active");
  }

  subscription.cancelAtPeriodEnd = true;
  subscription.autoRenew = false;
  subscription.status = "cancelled";
  subscription.nextChargeAt = null;
  await subscription.save();

  await createNotification({
    recipientId: user._id,
    type: "subscription",
    title: "Subscription cancellation scheduled",
    body: "Your paid plan has been marked for cancellation and will not auto-renew.",
    actionUrl: "/profile",
    entityType: "Subscription",
    entityId: subscription._id.toString()
  });

  await createAuditLog({
    actorId: user._id,
    actorRole: user.role,
    action: "subscription.cancelled",
    entityType: "Subscription",
    entityId: subscription._id.toString(),
    metadata: {
      title: "Subscription cancelled",
      summary: `${user.email} scheduled a cancellation for the ${
        subscription.planName || getPlanByCode(subscription.planCode).name
      } plan.`,
      status: "cancelled",
      planCode: subscription.planCode
    }
  });

  return decorateSubscriptionSnapshot(
    subscription,
    await calculateSubscriptionUsage(user, subscription)
  );
};

export const adminOverrideSubscription = async ({
  actor,
  user,
  subscription,
  planCode,
  billingCycle = "monthly",
  status = "active",
  notes = ""
}) => {
  const { plan, planCatalog, planVariant, normalizedBillingCycle } =
    await getCheckoutPlanSelection(planCode, billingCycle, {
      includeInactive: true
    });
  const planName = buildPlanDisplayName({
    planCatalog,
    planVariant,
    fallbackPlan: plan
  });

  if (plan.code === "free") {
    const result = await activateSubscriptionRecord({
      user,
      subscription,
      planCode: "free",
      planName: "Free",
      billingCycle: "monthly",
      amount: 0,
      currency: "USD",
      provider: "admin_override",
      paymentStatus: "none",
      note: notes,
      actor,
      source: "admin_override"
    });

    return {
      subscription: await decorateSubscriptionSnapshot(
        result.subscription,
        await calculateSubscriptionUsage(user, result.subscription)
      ),
      payment: result.payment ? serializePayment(result.payment) : null
    };
  }

  const amount = Number(planVariant?.price || 0);
  const result = await activateSubscriptionRecord({
    user,
    subscription,
    planCode: plan.code,
    planName,
    billingCycle: normalizedBillingCycle,
    amount,
    currency: normalizeCurrencyCode(planVariant?.currency || "USD"),
    provider: "admin_override",
    paymentStatus: status === "active" ? "paid" : "pending",
    note: notes,
    actor,
    source: "admin_override"
  });

  result.subscription.status = status;
  result.subscription.notes = notes || result.subscription.notes;
  await result.subscription.save();
  await syncUserPlanFields({
    userId: user._id,
    planCode: hasActiveEntitlement(result.subscription)
      ? result.subscription.planCode
      : "free",
    planStartDate: hasActiveEntitlement(result.subscription)
      ? result.subscription.currentPeriodStart
      : null,
    planExpiry: hasActiveEntitlement(result.subscription)
      ? result.subscription.currentPeriodEnd
      : null
  });

  return {
    subscription: await decorateSubscriptionSnapshot(
      result.subscription,
      await calculateSubscriptionUsage(user, result.subscription)
    ),
    payment: result.payment ? serializePayment(result.payment) : null
  };
};

export const getActiveSubscriptionBoostMap = async (userIds = []) => {
  const subscriptions = await Subscription.find({
    userId: {
      $in: userIds
    },
    status: "active",
    planCode: {
      $in: [
        "starter",
        "growth",
        "enterprise",
        "professional",
        "scale",
        "advance",
        "advanced"
      ]
    }
  });

  return subscriptions.reduce((map, subscription) => {
    const plan = getPlanByCode(subscription.planCode);
    map[subscription.userId.toString()] = {
      planCode: plan.code,
      boost: plan.visibilityBoost,
      rankingPriority: plan.rankingPriority
    };
    return map;
  }, {});
};

export const getFeatureAccessState = async (user) => {
  const subscription = await getOrCreateSubscription(user);
  const plan = getPlanByCode(getAccessPlanCode(subscription));

  return {
    subscription,
    planCode: plan.code,
    access: plan.access
  };
};

export const canAccessFeature = async (user, featureKey) => {
  const subscription = await getOrCreateSubscription(user);
  return hasPlanFeature(getAccessPlanCode(subscription), featureKey);
};
