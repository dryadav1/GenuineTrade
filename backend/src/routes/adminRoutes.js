import express from "express";
import {
  getAnalytics,
  getOverview,
  getRFQs,
  getSettings,
  getSubscriptions,
  getTransactions,
  getUsers,
  getVerificationQueue,
  saveSettings
} from "../controllers/adminPanelController.js";
import {
  reviewOnboardingUser
} from "../controllers/onboardingAdminController.js";
import {
  createAdminPlan,
  getAdminPlans,
  removeAdminPlan,
  updateAdminPlan
} from "../controllers/pricingAdminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeAdminLevels, authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect, authorizeRoles("admin"));
router.get("/overview", getOverview);
router.get("/users", getUsers);
router.patch("/users/:userId/review", reviewOnboardingUser);
router.get("/verification", getVerificationQueue);
router.get("/rfqs", getRFQs);
router.get("/subscriptions", getSubscriptions);
router.get("/transactions", getTransactions);
router.get("/analytics", getAnalytics);
router.get("/settings", getSettings);
router.patch("/settings", authorizeAdminLevels("super_admin"), saveSettings);
router.get("/plans", getAdminPlans);
router.post("/plans", authorizeAdminLevels("super_admin"), createAdminPlan);
router.patch("/plans/:planCode", authorizeAdminLevels("super_admin"), updateAdminPlan);
router.delete("/plans/:planCode", authorizeAdminLevels("super_admin"), removeAdminPlan);

export default router;
