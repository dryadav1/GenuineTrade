import {
  cancelUserSubscription,
  confirmRazorpaySubscriptionCheckout,
  confirmStripeSubscriptionCheckout,
  createSubscriptionCheckout,
  getAvailableCheckoutProviders,
  getSubscriptionSnapshot,
  getUserPayments,
  serializePlanCatalog
} from "../services/subscriptionService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getPlans = asyncHandler(async (req, res) => {
  res.json({
    plans: await serializePlanCatalog()
  });
});

export const getMySubscription = asyncHandler(async (req, res) => {
  res.json({
    subscription: await getSubscriptionSnapshot(req.user),
    payments: await getUserPayments(req.user._id),
    plans: await serializePlanCatalog(),
    paymentProviders: await getAvailableCheckoutProviders(req.user)
  });
});

export const createCheckout = asyncHandler(async (req, res) => {
  const { planCode, billingCycle, paymentProvider, successUrl, cancelUrl } = req.body;

  const result = await createSubscriptionCheckout({
    user: req.user,
    planCode,
    billingCycle,
    paymentProvider,
    successUrl,
    cancelUrl
  });

  res.status(201).json({
    message:
      result.checkout?.mode === "instant"
        ? "Subscription updated successfully"
        : "Checkout created successfully",
    ...result
  });
});

export const cancelSubscription = asyncHandler(async (req, res) => {
  const subscription = await cancelUserSubscription(req.user);

  res.json({
    message: "Subscription cancelled successfully",
    subscription
  });
});

export const confirmStripeCheckout = asyncHandler(async (req, res) => {
  const result = await confirmStripeSubscriptionCheckout({
    user: req.user,
    sessionId: req.body?.sessionId
  });

  res.json({
    message: "Payment verified successfully",
    ...result
  });
});

export const confirmRazorpayCheckout = asyncHandler(async (req, res) => {
  const result = await confirmRazorpaySubscriptionCheckout({
    user: req.user,
    orderId: req.body?.orderId,
    paymentId: req.body?.paymentId,
    signature: req.body?.signature
  });

  res.json({
    message: "Payment verified successfully",
    ...result
  });
});
