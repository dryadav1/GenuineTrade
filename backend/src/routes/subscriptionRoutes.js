import express from "express";
import {
  cancelSubscription,
  confirmRazorpayCheckout,
  confirmStripeCheckout,
  createCheckout,
  getMySubscription,
  getPlans
} from "../controllers/subscriptionController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/plans", getPlans);
router.get("/me", protect, authorizeRoles("exporter", "buyer"), getMySubscription);
router.post(
  "/checkout",
  protect,
  authorizeRoles("exporter", "buyer"),
  createCheckout
);
router.post(
  "/confirm/stripe",
  protect,
  authorizeRoles("exporter", "buyer"),
  confirmStripeCheckout
);
router.post(
  "/confirm/razorpay",
  protect,
  authorizeRoles("exporter", "buyer"),
  confirmRazorpayCheckout
);
router.post(
  "/cancel",
  protect,
  authorizeRoles("exporter", "buyer"),
  cancelSubscription
);

export default router;
