import express from "express";
import {
  sendPhoneOtp,
  verifyPhoneOtp
} from "../controllers/phoneVerificationController.js";
import {
  otpSendLimiter,
  otpVerifyLimiter
} from "../middleware/rateLimitMiddleware.js";
import { getProfile, upsertProfile } from "../controllers/profileController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getProfile);
router.put("/", protect, upsertProfile);
router.post("/phone/send-otp", protect, otpSendLimiter, sendPhoneOtp);
router.post("/phone/verify-otp", protect, otpVerifyLimiter, verifyPhoneOtp);

export default router;
