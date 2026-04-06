import {
  deleteAdminPlan,
  listAdminPlans,
  upsertAdminPlan
} from "../services/planService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const buildPlanPayload = (body = {}, fallbackPlanCode = "") => ({
  planCode: body.planCode || fallbackPlanCode,
  name: body.name,
  monthlyPrice: body.monthlyPrice,
  yearlyPrice: body.yearlyPrice,
  currency: body.currency,
  description: body.description,
  features: body.features,
  isActive: body.isActive,
  isPopular: body.isPopular
});

export const getAdminPlans = asyncHandler(async (req, res) => {
  res.json({
    items: await listAdminPlans()
  });
});

export const createAdminPlan = asyncHandler(async (req, res) => {
  const plan = await upsertAdminPlan(buildPlanPayload(req.body));

  res.status(201).json({
    message: "Plan created successfully",
    plan
  });
});

export const updateAdminPlan = asyncHandler(async (req, res) => {
  const plan = await upsertAdminPlan(buildPlanPayload(req.body, req.params.planCode));

  res.json({
    message: "Plan updated successfully",
    plan
  });
});

export const removeAdminPlan = asyncHandler(async (req, res) => {
  await deleteAdminPlan(req.params.planCode);

  res.json({
    message: "Plan deleted successfully"
  });
});
