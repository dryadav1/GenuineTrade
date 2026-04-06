import Stripe from "stripe";
import { createHttpError } from "../../utils/httpErrors.js";
import { toMinorUnits } from "../../utils/currency.js";

let stripeClient;

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw createHttpError(500, "Stripe is not configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover"
    });
  }

  return stripeClient;
};

export const createStripePaymentIntent = async ({
  amount,
  currency,
  transactionId,
  supportedMethods
}) => {
  const stripe = getStripeClient();

  const paymentIntent = await stripe.paymentIntents.create({
    amount: toMinorUnits(amount, currency),
    currency: currency.toLowerCase(),
    automatic_payment_methods: {
      enabled: true
    },
    metadata: {
      transactionId: transactionId.toString()
    }
  });

  return {
    provider: "stripe",
    providerReference: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    supportedMethods,
    rawResponse: paymentIntent
  };
};

export const createStripeSubscriptionCheckoutSession = async ({
  planName,
  description,
  amount,
  currency,
  customerEmail,
  successUrl,
  cancelUrl,
  userId,
  planId,
  planCode,
  billingCycle
}) => {
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        price_data: {
          currency: String(currency || "USD").toLowerCase(),
          unit_amount: toMinorUnits(amount, currency),
          product_data: {
            name: planName,
            description
          }
        },
        quantity: 1
      }
    ],
    metadata: {
      userId: userId.toString(),
      planId: String(planId || ""),
      planCode,
      billingCycle,
      paymentContext: "subscription_plan"
    }
  });

  return {
    provider: "stripe",
    checkoutMode: "redirect",
    checkoutUrl: session.url || "",
    providerReference: session.id,
    rawResponse: session
  };
};

export const retrieveStripeCheckoutSession = async (sessionId) => {
  const stripe = getStripeClient();
  return stripe.checkout.sessions.retrieve(sessionId);
};

export const constructStripeWebhookEvent = (payloadBuffer, signature) => {
  const stripe = getStripeClient();

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw createHttpError(500, "Stripe webhook secret is not configured");
  }

  return stripe.webhooks.constructEvent(
    payloadBuffer,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
};
