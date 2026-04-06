import express from "express";
import {
  getBuyerDashboard,
  getBuyerExporterDiscovery,
  getBuyerExporterProfileDetail,
  getBuyerRFQs,
  getBuyerSavedExporters,
  toggleSavedExporterForBuyer,
  updateBuyerProfile
} from "../controllers/buyerController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { loadSubscriptionAccess } from "../middleware/subscriptionAccessMiddleware.js";

const router = express.Router();

router.get("/me", protect, authorizeRoles("buyer"), getBuyerDashboard);
router.patch("/me/profile", protect, authorizeRoles("buyer"), updateBuyerProfile);
router.get("/me/rfqs", protect, authorizeRoles("buyer"), getBuyerRFQs);
router.get(
  "/me/exporters/search",
  protect,
  authorizeRoles("buyer"),
  loadSubscriptionAccess,
  getBuyerExporterDiscovery
);
router.get("/me/exporters/saved", protect, authorizeRoles("buyer"), getBuyerSavedExporters);
router.get(
  "/me/exporters/:exporterId",
  protect,
  authorizeRoles("buyer"),
  getBuyerExporterProfileDetail
);
router.post(
  "/me/exporters/:exporterId/save",
  protect,
  authorizeRoles("buyer"),
  toggleSavedExporterForBuyer
);

export default router;
