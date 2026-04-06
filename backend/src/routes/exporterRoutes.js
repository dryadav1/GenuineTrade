import express from "express";
import {
  downloadVerificationDocument,
  getExporterDashboard,
  getExporterMatches,
  submitMyKycForReview,
  updateExporterProfile,
  uploadMyVerificationDocument
} from "../controllers/exporterController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/me", protect, authorizeRoles("exporter"), getExporterDashboard);
router.patch("/me/profile", protect, authorizeRoles("exporter"), updateExporterProfile);
router.get("/me/matches", protect, authorizeRoles("exporter"), getExporterMatches);
router.post(
  "/me/verification-documents",
  protect,
  authorizeRoles("exporter"),
  uploadMyVerificationDocument
);
router.post(
  "/me/verification/submit",
  protect,
  authorizeRoles("exporter"),
  submitMyKycForReview
);
router.get(
  "/documents/:documentId/file",
  protect,
  authorizeRoles("exporter", "admin"),
  downloadVerificationDocument
);

export default router;
