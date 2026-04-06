import User from "../models/User.js";
import { createPhoneOtpChallenge, verifyPhoneOtpChallenge } from "../services/phoneOtpService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { serializeUser } from "../utils/serializers.js";

export const sendPhoneOtp = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+otp +otpExpiry");

  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  const result = await createPhoneOtpChallenge({
    user,
    phone: req.body?.phone || user.phone
  });

  res.status(201).json({
    message: "OTP sent successfully.",
    expiresInSeconds: result.expiresInSeconds,
    provider: result.provider,
    ...(result.debugCode ? { debugCode: result.debugCode } : {}),
    user: serializeUser(user)
  });
});

export const verifyPhoneOtp = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+otp +otpExpiry");

  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  const verifiedUser = await verifyPhoneOtpChallenge({
    user,
    code: req.body?.code
  });

  res.json({
    message: "Phone verified successfully.",
    phoneVerified: true,
    user: serializeUser(verifiedUser)
  });
});
