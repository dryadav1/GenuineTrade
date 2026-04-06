import Payment from "../models/Payment.js";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";
import WebhookEvent from "../models/WebhookEvent.js";
import { createAuditLog } from "./auditService.js";
import { getPlanCatalogEntry, getPlanVariant, listPricingPlans } from "./planService.js";
import { createNotification } from "./notificationService.js";
import { resolvePaymentMethods } from "./paymentMethodService.js";
import { getProfileByUser } from "./profileService.js";
import {
  createRazorpaySubscriptionCheckout,
  verifyRazorpayPaymentSignature
} from "./payments/razorpayProvider.js";
import {
  constructStripeWebhookEvent,
  createStripeSubscriptionCheckoutSession,
  retrieveStripeCheckoutSession
} from "./payments/stripeProvider.js";
import {
  calculateSubscriptionUsage,
  getOrCreateSubscription
} from "./subscriptionService.js";
import {
  getPlanByCode,
  normalizePlanCode,
  normalizePlanDuration
} from "./subscriptionPlans.js";

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

const normalizeBillingCycle = (value = "monthly") =>
  normalizePlanDuration(value) === "yearly" ? "yearly" : "monthly";

const getCurrentPeriodEnd = (now, billingCycle) =>
  normalizeBillingCycle(billingCycle) === "yearly" ? addYears(now, 1) : addDays(now, 30);

const createInvoiceNumber = () =>
  `INV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;

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

const serializePayment = (payment) => ({
  id: payment._id,
  planCode: normalizePlanCode(payment.planCode),
  planName: payment.planName || getPlanByCode(payment.planCode).name,
  billingCycle: normalizeBillingCycle(payment.billingCycle),
  amount: payment.amount,
  currency: payment.currency,
  provider: payment.provider,
  status: payment.status,
  reference: payment.reference,
  invoiceNumber: payment.invoiceNumber,
  invoiceUrl: payment.invoiceUrl,
  paidAt: payment.paidAt
});

const createOrUpdatePaymentRecord = async ({
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
  metadata = {}
}) => {
  const existing = await Payment.findOne({ reference });

  if (existing) {
    existing.planCode = planCode;
    existing.planName = planName || existing.planName;
    existing.billingCycle = normalizeBillingCycle(billingCycle);
    existing.amount = amount;
    existing.currency = currency;
    existing.provider = provider;
    existing.status = status;
    existing.providerPaymentId = providerPaymentId || existing.providerPaymentId;
    existing.paidAt = status === "paid" ? new Date() : existing.paidAt;
    existing.metadata = {
      ...(existing.metadata || {}),
      ...metadata
    };
    await existing.save();
    return existing;
  }

  return Payment.create({
    subscriptionId: subscription._id,
    userId: user._id,
    planCode,
    planName,
    billingCycle: normalizeBillingCycle(billingCycle),
    amount,
    currency,
    provider,
    status,
    reference,
    invoiceNumber: createInvoiceNumber(),
    providerPaymentId,
    paidAt: status === "paid" ? new Date() : null,
    metadata
  });
};
