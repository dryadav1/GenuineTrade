import User from "../models/User.js";
import { createAdminLog } from "../services/adminLogService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { serializeUser } from "../utils/serializers.js";

export const listOnboardingUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).sort({ createdAt: -1 });

  res.json({
    items: users.map((user) => serializeUser(user))
  });
});

export const reviewOnboardingUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { status, badge } = req.body || {};

  if (!["pending", "verified", "rejected"].includes(String(status || ""))) {
    res.status(400).json({ message: "Status must be pending, verified, or rejected." });
    return;
  }

  if (!["none", "verified", "trusted", "top_supplier"].includes(String(badge || ""))) {
    res
      .status(400)
      .json({ message: "Badge must be none, verified, trusted, or top_supplier." });
    return;
  }

  const user = await User.findById(userId);
  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  user.status = status;
  user.badge = badge;
  await user.save();

  await createAdminLog({
    actor: req.user,
    action: "admin.user.reviewed",
    targetType: "User",
    targetId: user._id.toString(),
    summary: `User ${user.email} moved to ${status} with badge ${badge}.`,
    metadata: {
      status,
      badge
    }
  });

  res.json({
    message: "User verification updated.",
    user: serializeUser(user)
  });
});
