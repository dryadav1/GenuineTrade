import { normalizeCountry } from "../utils/matchHelpers.js";

const providerCatalog = {
  stripe: {
    provider: "stripe",
    name: "Stripe",
    description: "Global checkout for cards, wallets, and international billing.",
    supportedMethods: ["card", "apple_pay", "google_pay"],
    checkoutLabel: "Stripe payment sheet"
  },
  razorpay: {
    provider: "razorpay",
    name: "Razorpay",
    description: "India-first checkout for UPI, cards, and netbanking.",
    supportedMethods: ["upi", "netbanking", "card"],
    checkoutLabel: "Razorpay checkout"
  }
};

const resolverMap = {
  india: providerCatalog.razorpay
};

export const resolvePaymentMethods = (country = "") => {
  const normalizedCountry = normalizeCountry(country);

  if (normalizedCountry === "india") {
    return resolverMap.india;
  }

  return providerCatalog.stripe;
};

export const normalizePaymentProvider = (value = "") => {
  const normalizedValue = String(value || "").trim().toLowerCase();
  return providerCatalog[normalizedValue] ? normalizedValue : "";
};

export const getPaymentProvider = (provider) =>
  providerCatalog[normalizePaymentProvider(provider)] || null;

export const listPaymentProviders = (country = "") => {
  const recommendedProvider = resolvePaymentMethods(country).provider;

  return Object.values(providerCatalog).map((provider) => ({
    ...provider,
    recommended: provider.provider === recommendedProvider
  }));
};
