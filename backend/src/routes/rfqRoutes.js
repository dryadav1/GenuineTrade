import express from "express";
import {
  createRFQ,
  getMyRFQs,
  getRFQMatches
} from "../controllers/rfqController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  enforceMatchAccess,
  enforceRFQLimit,
  loadSubscriptionAccess
} from "../middleware/subscriptionAccessMiddleware.js";

const router = express.Router();

router.post(
  "/",
  protect,
  authorizeRoles("buyer"),
  loadSubscriptionAccess,
  enforceRFQLimit,
  createRFQ
);
router.get("/my", protect, authorizeRoles("buyer"), getMyRFQs);
router.get(
  "/:rfqId/matches",
  protect,
  authorizeRoles("buyer"),
  loadSubscriptionAccess,
  enforceMatchAccess,
  getRFQMatches
);

export default router;
