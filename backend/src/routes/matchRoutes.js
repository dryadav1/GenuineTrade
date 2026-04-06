import express from "express";
import { getMyMatches } from "../controllers/matchController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  enforceMatchAccess,
  loadSubscriptionAccess
} from "../middleware/subscriptionAccessMiddleware.js";

const router = express.Router();

router.get(
  "/",
  protect,
  authorizeRoles("buyer", "exporter"),
  loadSubscriptionAccess,
  enforceMatchAccess,
  getMyMatches
);

export default router;
