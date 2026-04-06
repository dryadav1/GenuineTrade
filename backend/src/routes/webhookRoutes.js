import express from "express";
import {
  razorpayWebhook,
  razorpaySubscriptionWebhook,
  stripeSubscriptionWebhook,
  stripeWebhook
} from "../controllers/webhookController.js";

const router = express.Router();

router.post("/stripe", stripeWebhook);
router.post("/razorpay", razorpayWebhook);
router.post("/stripe/subscriptions", stripeSubscriptionWebhook);
router.post("/razorpay/subscriptions", razorpaySubscriptionWebhook);

export default router;
