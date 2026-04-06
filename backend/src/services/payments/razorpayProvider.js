import crypto from "crypto";
import Razorpay from "razorpay";
import { createHttpError } from "../../utils/httpErrors.js";
import { toMinorUnits } from "../../utils/currency.js";

let razorpayClient;

const getRazorpayClient = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw createHttpError(500, "Razorpay is not configured");
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  return razorpayClient;
};

export const createRazorpayOrder = async ({
  amount,
  currency,
  transactionId,
  supportedMethods
}) => {
  const razorpay = getRazorpayClient();
  const order = await razorpay.orders.create({
    amount: toMinorUnits(amount, currency),
    currency,
    receipt: `genuine-trade-${transactionId}`,
    notes: {
      transactionId: transactionId.toString()
    }
  });

  return {
    provider: "razorpay",
    providerReference: order.id,
    providerOrderId: order.id,
    clientSecret: "",
    supportedMethods,
    rawResponse: {
      order,
      keyId: process.env.RAZORPAY_KEY_ID
    }
  };
};

export const createRazorpaySubscriptionCheckout = async ({
  amount,
  currency,
  customerEmail,
  customerName,
  customerPhone,
  userId,
  planId,
  planName,
  planCode,
  billingCycle
}) => {
  const razorpay = getRazorpayClient();
  const order = await razorpay.orders.create({
    amount: toMinorUnits(amount, currency),
    currency,
    receipt: `gt-plan-${userId}-${Date.now()}`,
    notes: {
      paymentContext: "subscription_plan",
      userId: userId.toString(),
      planCode,
      billingCycle,
      customerEmail,
      planId: String(planId || ""),
      planName: planName || ""
    }
  });

  return {
    provider: "razorpay",
    checkoutMode: "embedded",
    checkoutUrl: "",
    providerReference: order.id,
    providerSubscriptionId: "",
    rawResponse: {
      order,
      keyId: process.env.RAZORPAY_KEY_ID
    },
    checkoutConfig: {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      name: "GenuineTrade",
      description: `${planName || "Plan"} (${billingCycle})`,
      prefill: {
        email: customerEmail || "",
        name: customerName || "",
        contact: customerPhone || ""
      }
    }
  };
};

export const verifyRazorpayPaymentSignature = ({
  orderId,
  paymentId,
  signature
}) => {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw createHttpError(500, "Razorpay is not configured");
  }

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return generatedSignature === signature;
};

export const validateRazorpayWebhookSignature = (rawBody, signature) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw createHttpError(500, "Razorpay webhook secret is not configured");
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
};
