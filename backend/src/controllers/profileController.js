import User from "../models/User.js";
import { normalizePhone } from "../services/phoneOtpService.js";
import { saveUploadedFile, saveUploadedFiles } from "../services/documentStorageService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { serializeUser } from "../utils/serializers.js";

const validateExporterPayload = (payload) =>
  payload.company &&
  payload.country &&
  payload.phone &&
  payload.iec &&
  payload.gst &&
  payload.hsnCode &&
  payload.productName &&
  payload.productCategory;

const validateBuyerPayload = (payload) =>
  payload.company && payload.country && payload.phone && payload.importId && payload.requirement;

const shouldRequirePhoneVerification = () => {
  const configuredValue = String(process.env.REQUIRE_PHONE_VERIFICATION || "")
    .trim()
    .toLowerCase();

  if (configuredValue === "true") {
    return true;
  }

  if (configuredValue === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
};

export const getProfile = asyncHandler(async (req, res) => {
  res.json({
    user: serializeUser(req.user)
  });
});

export const upsertProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }

  const payload = {
    name: String(req.body?.name || user.name || "").trim(),
    company: String(req.body?.company || "").trim(),
    country: String(req.body?.country || "").trim(),
    phone: normalizePhone(req.body?.phone || ""),
    iec: String(req.body?.iec || "").trim(),
    gst: String(req.body?.gst || "").trim(),
    hsnCode: String(req.body?.hsnCode || "").trim(),
    productName: String(req.body?.productName || "").trim(),
    productCategory: String(req.body?.productCategory || "").trim(),
    importId: String(req.body?.importId || "").trim(),
    requirement: String(req.body?.requirement || "").trim()
  };

  if (user.role === "exporter" && !validateExporterPayload(payload)) {
    res.status(400).json({
      message:
        "Exporter profile requires company, phone, country, IEC, GST, HSN code, primary product name, and product selection."
    });
    return;
  }

  if (user.role === "buyer" && !validateBuyerPayload(payload)) {
    res.status(400).json({
      message: "Buyer profile requires company, phone, country, import ID, and product requirement."
    });
    return;
  }

  const requirePhoneVerification = shouldRequirePhoneVerification();
  const existingPhone = normalizePhone(user.phone || "");
  const phoneChanged = payload.phone !== existingPhone;
  const phoneVerifiedForCurrentValue =
    Boolean(user.phoneVerified) && payload.phone && payload.phone === existingPhone;

  if (requirePhoneVerification && !phoneVerifiedForCurrentValue) {
    res.status(400).json({
      message: "Verify your phone number with OTP before saving your profile."
    });
    return;
  }

  let iecFile = user.documents?.iecFile || "";
  let gstFile = user.documents?.gstFile || "";
  let productImages = user.documents?.productImages || [];

  if (req.body?.documents?.iecFile?.dataUrl) {
    iecFile = await saveUploadedFile({
      userId: user._id.toString(),
      field: "iec",
      file: req.body.documents.iecFile
    });
  }

  if (req.body?.documents?.gstFile?.dataUrl) {
    gstFile = await saveUploadedFile({
      userId: user._id.toString(),
      field: "gst",
      file: req.body.documents.gstFile
    });
  }

  if (Array.isArray(req.body?.documents?.productImages) && req.body.documents.productImages.length) {
    productImages = await saveUploadedFiles({
      userId: user._id.toString(),
      field: "product-images",
      files: req.body.documents.productImages
    });
  }

  user.name = payload.name || user.name;
  user.company = payload.company;
  user.country = payload.country;
  user.phone = payload.phone;
  user.phoneVerified = phoneChanged ? false : user.phoneVerified;
  user.iec = user.role === "exporter" ? payload.iec : "";
  user.gst = user.role === "exporter" ? payload.gst : "";
  user.hsnCode = user.role === "exporter" ? payload.hsnCode : "";
  user.productName = user.role === "exporter" ? payload.productName : "";
  user.productCategory = user.role === "exporter" ? payload.productCategory : "";
  user.importId = user.role === "buyer" ? payload.importId : "";
  user.requirement = user.role === "buyer" ? payload.requirement : "";
  user.documents = {
    iecFile,
    gstFile,
    productImages
  };
  user.profileCompleted = true;

  if (user.role !== "admin" && user.status === "rejected") {
    user.status = "pending";
    user.badge = "none";
  }

  await user.save();

  res.json({
    message: "Your profile is under verification.",
    user: serializeUser(user)
  });
});
