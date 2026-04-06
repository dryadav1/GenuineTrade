import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getAdminAnalytics,
  getAdminOverview,
  getAdminSettings,
  listAdminRFQs,
  listAdminSubscriptions,
  listAdminTransactions,
  listAdminUsers,
  listAdminVerification,
  updateAdminSettings
} from "../services/adminPanelService.js";

export const getOverview = asyncHandler(async (req, res) => {
  res.json(await getAdminOverview());
});

export const getUsers = asyncHandler(async (req, res) => {
  res.json(await listAdminUsers(req.query));
});

export const getVerificationQueue = asyncHandler(async (req, res) => {
  res.json(await listAdminVerification(req.query));
});

export const getRFQs = asyncHandler(async (req, res) => {
  res.json(await listAdminRFQs(req.query));
});

export const getSubscriptions = asyncHandler(async (req, res) => {
  res.json(await listAdminSubscriptions(req.query));
});

export const getTransactions = asyncHandler(async (req, res) => {
  res.json(await listAdminTransactions(req.query));
});

export const getAnalytics = asyncHandler(async (req, res) => {
  res.json(await getAdminAnalytics());
});

export const getSettings = asyncHandler(async (req, res) => {
  res.json(await getAdminSettings());
});

export const saveSettings = asyncHandler(async (req, res) => {
  res.json({
    message: "Admin settings updated successfully",
    ...(await updateAdminSettings({
      actor: req.user,
      payload: req.body
    }))
  });
});
