export const parseFeatureLines = (value = "") =>
  String(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

const legacyPlanAliasMap = {
  professional: "growth",
  scale: "enterprise",
  advance: "growth",
  advanced: "growth"
};

export const normalizePlanCode = (value = "") =>
  String(legacyPlanAliasMap[value] || value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const formatPlanCode = (value = "") =>
  String(value)
    .split("-")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export const formatPaymentProvider = (value = "") => {
  if (value === "stripe") {
    return "Stripe";
  }

  if (value === "razorpay") {
    return "Razorpay";
  }

  if (value === "test_mode") {
    return "Local test mode";
  }

  return formatPlanCode(value);
};

export const hasPlanEntitlement = (subscription) => {
  if (!subscription) {
    return false;
  }

  if (subscription.status === "active") {
    return true;
  }

  return (
    subscription.status === "cancelled" &&
    subscription.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd).getTime() > Date.now()
  );
};

export const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Razorpay checkout is only available in the browser."));
      return;
    }

    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.Razorpay), {
        once: true
      });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Razorpay checkout.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout."));
    document.body.appendChild(script);
  });
