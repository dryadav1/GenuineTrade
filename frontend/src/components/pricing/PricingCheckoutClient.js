"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SiteHeader from "@/components/marketing/SiteHeader";
import { apiRequest } from "@/lib/api";
import { useToastOnChange } from "@/components/feedback/ToastProvider";
import {
  formatPaymentProvider,
  hasPlanEntitlement,
  loadRazorpayScript
} from "@/lib/billing";
import { formatCurrency, formatDate } from "@/lib/format";
import { getSession, saveSession } from "@/lib/session";
import {
  buttonMotion,
  hoverLift,
  pageTransitionVariants,
  staggerContainer,
  staggerItem
} from "@/lib/motion";

const normalizeBillingCycle = (value = "") =>
  value === "yearly" || value === "annual" ? "yearly" : "monthly";

const normalizePlanCode = (value = "") =>
  String(
    {
      professional: "growth",
      scale: "enterprise",
      advance: "growth",
      advanced: "growth"
    }[value] || value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getPlanPrice = (plan, billingCycle) =>
  billingCycle === "yearly" ? Number(plan?.annualPrice || 0) : Number(plan?.monthlyPrice || 0);

const syncSessionPlan = (subscription) => {
  const currentSession = getSession();

  if (!currentSession?.token || !subscription) {
    return;
  }

  saveSession({
    ...currentSession,
    user: {
      ...currentSession.user,
      subscriptionPlan: subscription.planCode,
      planStartDate: subscription.currentPeriodStart || null,
      planExpiry: subscription.currentPeriodEnd || null
    }
  });
};

const paymentCopy = {
  stripe: {
    headline: "Global card checkout",
    description: "Best for international cards, Apple Pay, and Google Pay."
  },
  razorpay: {
    headline: "India-first checkout",
    description: "Best for UPI, netbanking, and domestic card payments."
  }
};

function ProviderIcon({ provider }) {
  if (provider === "razorpay") {
    return (
      <svg
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
      >
        <path d="M6 8h12" />
        <path d="M6 12h8" />
        <path d="M6 16h10" />
      </svg>
    );
  }

  return (
    <svg
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M3 10h18" />
      <path d="M8 15h3" />
    </svg>
  );
}

export default function PricingCheckoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState(null);
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [paymentProviders, setPaymentProviders] = useState([]);
  const [billingCountry, setBillingCountry] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [processingProvider, setProcessingProvider] = useState("");

  const rawPlanCode = searchParams.get("plan") || "";
  const planCode = normalizePlanCode(rawPlanCode);
  const billingCycle = normalizeBillingCycle(searchParams.get("billingCycle"));
  const dashboardHref = session?.user?.role === "admin" ? "/admin" : "/dashboard";

  useToastOnChange({
    errorMessage: error,
    successMessage: notice,
    errorTitle: "Checkout issue",
    successTitle: "Checkout update"
  });

  useEffect(() => {
    const activeSession = getSession();
    setSession(activeSession);

    if (!activeSession?.token) {
      router.replace("/login");
      return;
    }

    if (activeSession.user?.role === "admin") {
      router.replace("/pricing");
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await apiRequest("/subscriptions/me", {
          token: activeSession.token
        });

        const providerItems = response.paymentProviders?.items || [];
        setPlans(response.plans || []);
        setSubscription(response.subscription || null);
        setPaymentProviders(providerItems);
        setBillingCountry(response.paymentProviders?.country || "");

        const requestedProvider = searchParams.get("provider") || "";
        const recommendedProvider =
          providerItems.find((provider) => provider.recommended)?.provider || "";
        const matchedProvider = providerItems.find(
          (provider) => provider.provider === requestedProvider
        );

        setSelectedProvider(
          matchedProvider?.provider || recommendedProvider || providerItems[0]?.provider || ""
        );
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [router, searchParams]);

  useEffect(() => {
    if (!rawPlanCode || !planCode || rawPlanCode === planCode) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("plan", planCode);
    router.replace(`/pricing/checkout?${nextParams.toString()}`);
  }, [planCode, rawPlanCode, router, searchParams]);

  useEffect(() => {
    if (searchParams.get("checkout") === "cancelled") {
      setNotice("Checkout was cancelled. Your plan remains unchanged.");
    }
  }, [searchParams]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.code === planCode) || null,
    [planCode, plans]
  );
  const selectedPlanPrice = getPlanPrice(selectedPlan, billingCycle);
  const selectedPlanCurrency =
    selectedPlan?.variants?.[billingCycle]?.currency || "USD";
  const hasEntitlement = hasPlanEntitlement(subscription);
  const isCurrentPlan =
    hasEntitlement &&
    subscription?.planCode === selectedPlan?.code &&
    normalizeBillingCycle(subscription?.billingCycle) === billingCycle;

  const handleRazorpayCheckout = async (checkoutResponse) => {
    const Razorpay = await loadRazorpayScript();
    const razorpay = new Razorpay({
      ...(checkoutResponse.checkout?.checkoutConfig || {}),
      handler: async (paymentPayload) => {
        try {
          await apiRequest("/subscriptions/confirm/razorpay", {
            method: "POST",
            token: session.token,
            body: {
              orderId: paymentPayload.razorpay_order_id,
              paymentId: paymentPayload.razorpay_payment_id,
              signature: paymentPayload.razorpay_signature
            }
          });

          router.push("/pricing/success?provider=razorpay");
        } catch (requestError) {
          setError(requestError.message);
          setProcessingProvider("");
        }
      },
      modal: {
        ondismiss: () => {
          setProcessingProvider("");
        }
      },
      theme: {
        color: "#0B1F3A"
      }
    });

    razorpay.open();
  };

  const handleCheckout = async () => {
    if (!selectedPlan || !selectedProvider) {
      setError("Choose a plan and payment provider to continue.");
      return;
    }

    if (!session?.token) {
      router.replace("/login");
      return;
    }

    setProcessingProvider(selectedProvider);
    setError("");
    setNotice("");

    try {
      const response = await apiRequest("/subscriptions/checkout", {
        method: "POST",
        token: session.token,
        body: {
          planCode: selectedPlan.code,
          billingCycle,
          paymentProvider: selectedProvider,
          successUrl: `${window.location.origin}/pricing/success?provider=${selectedProvider}`,
          cancelUrl: `${window.location.origin}/pricing/checkout?plan=${selectedPlan.code}&billingCycle=${billingCycle}&checkout=cancelled`
        }
      });

      if (response.checkout?.provider === "stripe" && response.checkout?.url) {
        window.location.href = response.checkout.url;
        return;
      }

      if (
        response.checkout?.provider === "razorpay" &&
        response.checkout?.checkoutConfig
      ) {
        await handleRazorpayCheckout(response);
        return;
      }

      syncSessionPlan(response.subscription);
      router.push(
        `/pricing/success?provider=${
          response.checkout?.selectedProvider || response.checkout?.provider || selectedProvider
        }`
      );
    } catch (requestError) {
      setError(requestError.message);
      setProcessingProvider("");
    }
  };

  return (
    <motion.main
      animate="animate"
      className="min-h-screen bg-canvas pb-10"
      initial="initial"
      variants={pageTransitionVariants}
    >
      <SiteHeader compact />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <motion.section
          animate="animate"
          className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]"
          initial="initial"
          variants={staggerContainer}
        >
          <motion.div className="panel p-8" variants={staggerItem}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
              Subscription checkout
            </p>
            <h1 className="mt-4 text-4xl font-bold text-ink sm:text-5xl">
              Choose a secure payment provider for your upgrade.
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
              GenuineTrade verifies every payment before changing subscription access.
              Pick the provider that fits your market, then finish the upgrade.
            </p>

            {error ? (
              <div className="mt-6 rounded-3xl border border-danger/20 bg-danger/10 px-5 py-4 text-sm text-danger">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="mt-6 rounded-3xl border border-primary/15 bg-primary/5 px-5 py-4 text-sm text-primary">
                {notice}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/pricing" className="btn-secondary">
                Back to pricing
              </Link>
              <Link href={dashboardHref} className="btn-primary">
                Open dashboard
              </Link>
            </div>
          </motion.div>

          <motion.div className="panel bg-hero-wash p-8" variants={staggerItem}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
              Plan summary
            </p>

            {loading ? (
              <div className="mt-6 space-y-4">
                <div className="surface-muted h-24 animate-pulse" />
                <div className="surface-muted h-24 animate-pulse" />
              </div>
            ) : !selectedPlan ? (
              <div className="mt-6 rounded-3xl border border-danger/20 bg-danger/10 px-5 py-4 text-sm text-danger">
                Select a valid plan from the pricing page before continuing.
              </div>
            ) : (
              <>
                <div className="mt-6 rounded-[28px] border border-line bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                        {selectedPlan.tier}
                      </p>
                      <h2 className="mt-3 text-3xl font-bold text-ink">
                        {selectedPlan.name}
                      </h2>
                    </div>
                    {selectedPlan.isPopular ? (
                      <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                        Most Popular
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-5 text-4xl font-bold text-primary">
                    {formatCurrency(selectedPlanPrice, selectedPlanCurrency)}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    {billingCycle === "yearly" ? "Yearly billing" : "Monthly billing"}
                  </p>

                  <div className="mt-5 space-y-3 text-sm text-muted">
                    {selectedPlan.features.map((feature) => (
                      <div key={`${selectedPlan.code}-${feature}`} className="flex gap-3">
                        <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="surface-muted p-5">
                    <p className="text-sm text-muted">Current plan</p>
                    <p className="mt-2 text-2xl font-bold text-primary">
                      {subscription?.planName || "Free"}
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      {subscription?.currentPeriodEnd
                        ? `Expires ${formatDate(subscription.currentPeriodEnd)}`
                        : "No expiry"}
                    </p>
                  </div>
                  <div className="surface-muted p-5">
                    <p className="text-sm text-muted">Billing country</p>
                    <p className="mt-2 text-2xl font-bold text-primary">
                      {billingCountry || "Global"}
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      Your country helps us recommend the best payment rail.
                    </p>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.section>

        <motion.section
          animate="animate"
          className="mt-6"
          initial="initial"
          variants={staggerContainer}
        >
          <motion.div className="panel p-8" variants={staggerItem}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
                  Payment provider
                </p>
                <h2 className="mt-3 text-3xl font-bold text-ink">
                  Stripe or Razorpay, your choice.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
                  Both providers are verified server-side before access is activated.
                  If live keys are unavailable in this environment, GenuineTrade falls
                  back to secure local test activation.
                </p>
              </div>
              <div className="rounded-full bg-primary/6 px-4 py-2 text-sm font-semibold text-primary">
                {isCurrentPlan ? "This plan is already active on the selected cycle." : "Secure checkout"}
              </div>
            </div>

            {loading ? (
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div key={`provider-skeleton-${index}`} className="surface-muted h-56 animate-pulse" />
                ))}
              </div>
            ) : (
              <motion.div
                animate="animate"
                className="mt-6 grid gap-5 lg:grid-cols-2"
                initial="initial"
                variants={staggerContainer}
              >
                {paymentProviders.map((provider) => {
                  const isSelected = selectedProvider === provider.provider;
                  const providerCopy = paymentCopy[provider.provider] || paymentCopy.stripe;

                  return (
                    <motion.button
                      key={provider.provider}
                      {...hoverLift}
                      className={`rounded-2xl border p-6 text-left shadow-panel ${
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : "border-line bg-white text-ink"
                      }`}
                      onClick={() => setSelectedProvider(provider.provider)}
                      type="button"
                      variants={staggerItem}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                              isSelected ? "bg-white/12 text-white" : "bg-primary/8 text-primary"
                            }`}
                          >
                            <ProviderIcon provider={provider.provider} />
                          </div>
                          <div>
                            <p
                              className={`text-sm font-semibold uppercase tracking-[0.18em] ${
                                isSelected ? "text-white/70" : "text-primary/45"
                              }`}
                            >
                              {provider.availability === "live" ? "Live" : "Sandbox"}
                            </p>
                            <h3 className="mt-2 text-2xl font-bold">
                              {formatPaymentProvider(provider.provider)}
                            </h3>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {provider.recommended ? (
                            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                              Recommended
                            </span>
                          ) : null}
                          {isSelected ? (
                            <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-semibold">
                              Selected
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <p className={`mt-5 text-lg font-semibold ${isSelected ? "text-white" : "text-ink"}`}>
                        {providerCopy.headline}
                      </p>
                      <p
                        className={`mt-2 text-sm leading-7 ${
                          isSelected ? "text-white/80" : "text-muted"
                        }`}
                      >
                        {provider.description || providerCopy.description}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {(provider.supportedMethods || []).map((method) => (
                          <span
                            key={`${provider.provider}-${method}`}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              isSelected
                                ? "bg-white/12 text-white/90"
                                : "bg-primary/8 text-primary"
                            }`}
                          >
                            {method.replaceAll("_", " ")}
                          </span>
                        ))}
                      </div>

                      <p
                        className={`mt-5 text-xs leading-6 ${
                          isSelected ? "text-white/70" : "text-primary/55"
                        }`}
                      >
                        {provider.availability === "live"
                          ? "Live checkout is ready for this provider."
                          : "This environment will use a secure local test fallback if live keys are unavailable."}
                      </p>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            <div className="mt-8 flex flex-wrap gap-3">
              <motion.button
                {...buttonMotion}
                className="btn-primary"
                disabled={
                  loading ||
                  !selectedPlan ||
                  !selectedProvider ||
                  !paymentProviders.length ||
                  isCurrentPlan ||
                  Boolean(processingProvider)
                }
                onClick={handleCheckout}
                type="button"
              >
                {processingProvider
                  ? `Opening ${formatPaymentProvider(processingProvider)}...`
                  : selectedPlan?.code === "free"
                    ? "Activate plan"
                    : `Continue with ${formatPaymentProvider(selectedProvider || "stripe")}`}
              </motion.button>
              <Link href="/pricing" className="btn-secondary">
                Change plan
              </Link>
            </div>
          </motion.div>
        </motion.section>
      </div>
    </motion.main>
  );
}
