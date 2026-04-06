import { resolvePaymentMethods } from "../services/paymentMethodService.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getPaymentMethods = asyncHandler(async (req, res) => {
  const country = req.query.country || "";

  res.json({
    country,
    ...resolvePaymentMethods(country)
  });
});
