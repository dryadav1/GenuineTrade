import express from "express";
import { getAnalyticsOverview } from "../controllers/analyticsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  loadSubscriptionAccess,
  requireAnalyticsAccess
} from "../middleware/subscriptionAccessMiddleware.js";

const router = express.Router();

router.get(
  "/overview",
  protect,
  authorizeRoles("buyer", "exporter"),
  loadSubscriptionAccess,
  requireAnalyticsAccess,
  getAnalyticsOverview
);

export default router;
