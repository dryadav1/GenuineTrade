import { asyncHandler } from "../utils/asyncHandler.js";
import {
  handleRazorpaySubscriptionWebhook,
  handleStripeSubscriptionWebhook
} from "../services/subscriptionService.js";
import {
  handleRazorpayWebhook,
  handleStripeWebhook
} from "../services/transactionService.js";

export const stripeWebhook = asyncHandler(async (req, res) => {
  await handleStripeWebhook({
    payloadBuffer: req.rawBody,
    signature: req.headers["stripe-signature"]
  });

  res.json({ received: true });
});

export const razorpayWebhook = asyncHandler(async (req, res) => {
  await handleRazorpayWebhook({
    rawBody: req.rawBody.toString("utf8"),
    signature: req.headers["x-razorpay-signature"],
    payload: req.body
  });

  res.json({ received: true });
});

export const stripeSubscriptionWebhook = asyncHandler(async (req, res) => {
  await handleStripeSubscriptionWebhook({
    payloadBuffer: req.rawBody,
    signature: req.headers["stripe-signature"]
  });

  res.json({ received: true });
});

export const razorpaySubscriptionWebhook = asyncHandler(async (req, res) => {
  await handleRazorpaySubscriptionWebhook({
    rawBody: req.rawBody.toString("utf8"),
    signature: req.headers["x-razorpay-signature"],
    payload: req.body
  });

  res.json({ received: true });
});
