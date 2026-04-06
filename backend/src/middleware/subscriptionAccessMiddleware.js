import { createNotification } from "../services/notificationService.js";
import {
  getFeatureAccessState,
  getSubscriptionAccessSnapshot
} from "../services/subscriptionService.js";

const buildLimitErrorMessage = (limitKey, role) => {
  if (limitKey === "rfqs") {
    return "You have reached your monthly RFQ limit for the current plan.";
  }

  if (limitKey === "matches") {
    return role === "exporter"
      ? "You have reached the monthly match visibility limit for your plan."
      : "You have reached the monthly ranked match visibility limit for your plan.";
  }

  return "Your current plan does not allow this action.";
};

export const loadSubscriptionAccess = async (req, res, next) => {
  try {
    const accessSnapshot = await getSubscriptionAccessSnapshot(req.user);
    req.subscriptionAccess = accessSnapshot;
    next();
  } catch (error) {
    next(error);
  }
};

export const enforceRFQLimit = async (req, res, next) => {
  const usage = req.subscriptionAccess?.usage?.rfqs;

  if (usage && !usage.unlimited && usage.remaining <= 0) {
    await createNotification({
      recipientId: req.user._id,
      type: "subscription",
      title: "Upgrade to create more RFQs",
      body: "You have used your monthly RFQ quota. Upgrade to continue posting new demand.",
      actionUrl: "/profile",
      entityType: "Subscription",
      entityId: req.subscriptionAccess.subscription._id.toString(),
      metadata: {
        limitKey: "rfqs"
      }
    });

    res.status(403).json({
      message: buildLimitErrorMessage("rfqs", req.user.role),
      plan: req.subscriptionAccess.plan.name,
      usage
    });
    return;
  }

  next();
};

export const enforceMatchAccess = async (req, res, next) => {
  const usage = req.subscriptionAccess?.usage?.matches;

  if (usage && !usage.unlimited && usage.limit <= 0) {
    res.status(403).json({
      message: buildLimitErrorMessage("matches", req.user.role),
      plan: req.subscriptionAccess.plan.name,
      usage
    });
    return;
  }

  req.subscriptionAccess.matchCap = usage?.unlimited ? null : usage?.limit ?? null;
  next();
};

export const requireAnalyticsAccess = async (req, res, next) => {
  const accessState = req.subscriptionAccess || (await getFeatureAccessState(req.user));
  const featureAccess = accessState?.access || accessState?.features || {};

  if (!featureAccess.analytics) {
    await createNotification({
      recipientId: req.user._id,
      type: "subscription",
      title: "Analytics are available on paid plans",
      body: "Upgrade to Starter, Growth, or Enterprise to unlock the analytics workspace.",
      actionUrl: "/profile",
      entityType: "Subscription",
      entityId: accessState.subscription?._id?.toString?.() || ""
    });

    res.status(403).json({
      message: "Analytics are available on Starter, Growth, and Enterprise plans.",
      planCode: accessState.planCode || req.subscriptionAccess?.plan?.code || "free"
    });
    return;
  }

  next();
};
