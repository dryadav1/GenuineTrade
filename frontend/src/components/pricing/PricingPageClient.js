"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SiteHeader from "@/components/marketing/SiteHeader";
import { apiRequest } from "@/lib/api";
import { useToastOnChange } from "@/components/feedback/ToastProvider";
import { formatPlanCode, hasPlanEntitlement } from "@/lib/billing";
import { formatCurrency, formatDate } from "@/lib/format";
import { getSession, saveSession } from "@/lib/session";
import {
  buttonMotion,
  hoverLift,
  pageTransitionVariants,
  staggerContainer,
  staggerItem
} from "@/lib/motion";

const BILLING_OPTIONS = [
  {
    id: "monthly",
    label: "Monthly"
  },
  {
    id: "yearly",
    label: "Yearly"
  }
];

const normalizeBillingCycle = (value = "") =>
  value === "yearly" || value === "annual" ? "yearly" : "monthly";

const getPlanPrice = (plan, billingCycle) =>
  billingCycle === "yearly" ? Number(plan.annualPrice || 0) : Number(plan.monthlyPrice || 0);

const getPlanDurationLabel = (billingCycle) =>
  billingCycle === "yearly" ? "Billed yearly" : "Billed monthly";

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

const getPaidPlanLabel = ({ isCurrentPlan, isCurrentCycle, billingCycle }) => {
  if (isCurrentPlan && isCurrentCycle) {
    return "Current plan";
  }

  if (isCurrentPlan) {
    return billingCycle === "yearly" ? "Switch to yearly" : "Switch to monthly";
  }

  return "Upgrade";
};

const canLoadOwnSubscription = (activeSession) =>
  Boolean(activeSession?.token) && activeSession?.user?.role !== "admin";

export default function PricingPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState([]);
  const [session, setSession] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [processingAction, setProcessingAction] = useState("");
  const dashboardHref = session?.user?.role === "admin" ? "/admin" : "/dashboard";
  const isAdminViewer = session?.user?.role === "admin";
  const adminPricingHref = "/admin/settings#pricing-controls";

  useToastOnChange({
    errorMessage: error,
    successMessage: notice,
    errorTitle: "Billing issue",
    successTitle: "Billing update"
  });

  const refreshBilling = async (activeSession) => {
    const [plansResponse, subscriptionResponse] = await Promise.all([
      apiRequest("/subscriptions/plans"),
      canLoadOwnSubscription(activeSession)
        ? apiRequest("/subscriptions/me", {
            token: activeSession.token
          })
        : Promise.resolve(null)
    ]);

    setPlans(plansResponse.plans || []);
    setSubscription(subscriptionResponse?.subscription || null);
  };

  useEffect(() => {
    setBillingCycle(
      normalizeBillingCycle(
        searchParams.get("billingCycle") || searchParams.get("billing") || "monthly"
      )
    );
  }, [searchParams]);

  useEffect(() => {
    const activeSession = getSession();
    setSession(activeSession);

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        await refreshBilling(activeSession);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  useEffect(() => {
    if (searchParams.get("checkout") === "cancelled") {
      setNotice("Checkout was cancelled. Your plan remains unchanged.");
    }
  }, [searchParams]);

  const handleFreePlan = async () => {
    if (isAdminViewer) {
      router.push(adminPricingHref);
      return;
    }

    if (!session?.token) {
      router.push("/signup");
      return;
    }

    setProcessingAction("free");
    setError("");
    setNotice("");

    try {
      const response = await apiRequest("/subscriptions/checkout", {
        method: "POST",
        token: session.token,
        body: {
          planCode: "free",
          billingCycle: "monthly",
          successUrl: `${window.location.origin}/pricing/success?provider=free_tier`,
          cancelUrl: `${window.location.origin}/pricing?checkout=cancelled`
        }
      });

      syncSessionPlan(response.subscription);
      await refreshBilling(session);
      setNotice(response.message || "You are now on the Free plan.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setProcessingAction("");
    }
  };

  const handlePlanAction = async (plan) => {
    if (isAdminViewer) {
      router.push(adminPricingHref);
      return;
    }

    if (plan.code === "free") {
      await handleFreePlan();
      return;
    }

    if (!session?.token) {
      router.push("/login");
      return;
    }

    router.push(`/pricing/checkout?plan=${plan.code}&billingCycle=${billingCycle}`);
  };

  const currentPlanCode = subscription?.planCode || "free";
  const currentBillingCycle = subscription?.billingCycle || "monthly";
  const hasEntitlement = hasPlanEntitlement(subscription);

  return (
    <motion.main
      animate="animate"
      className="min-h-screen bg-canvas pb-10"
      initial="initial"
      variants={pageTransitionVariants}
    >
      <SiteHeader />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <motion.header
          className="rounded-[28px] border border-line bg-white/90 px-6 py-5 shadow-panel backdrop-blur"
          variants={staggerItem}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/60">
                GenuineTrade Pricing
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-bold text-ink sm:text-5xl">
                Premium subscription plans built to convert trade teams into long-term
                customers.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-muted sm:text-base">
                Choose the right plan for your RFQ volume, analytics needs, and global
                growth stage. Paid upgrades continue to a secure Stripe or Razorpay
                payment step.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/" className="btn-secondary">
                Back home
              </Link>
              <Link href={session?.token ? dashboardHref : "/signup"} className="btn-primary">
                {session?.token ? "Go to dashboard" : "Get started free"}
              </Link>
            </div>
          </div>
        </motion.header>

        <motion.section
          animate="animate"
          className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]"
          initial="initial"
          variants={staggerContainer}
        >
          <motion.div className="panel bg-hero-wash p-8" variants={staggerItem}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
              Billing cadence
            </p>
            <h2 className="mt-4 text-3xl font-bold text-ink">
              Monthly flexibility or yearly savings.
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              Free users can start instantly. Paid users continue to a dedicated
              checkout page where they can choose Stripe or Razorpay before payment.
            </p>

            <div className="mt-6 inline-flex rounded-2xl border border-line bg-white p-1 shadow-sm">
              {BILLING_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    billingCycle === option.id
                      ? "bg-primary text-white"
                      : "text-primary/65"
                  }`}
                  onClick={() => setBillingCycle(option.id)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>

          <motion.div className="panel p-8" variants={staggerItem}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
              Current plan
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="surface-muted p-5">
                <p className="text-sm text-muted">Active plan</p>
                <p className="mt-2 text-2xl font-bold text-primary">
                  {isAdminViewer ? "Admin workspace" : subscription?.planName || "Free"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  Status: {isAdminViewer ? "admin" : subscription?.status || "guest"}
                </p>
              </div>
              <div className="surface-muted p-5">
                <p className="text-sm text-muted">Renewal or expiry</p>
                <p className="mt-2 text-2xl font-bold text-primary">
                  {isAdminViewer
                    ? "Not applicable"
                    : subscription?.currentPeriodEnd
                    ? formatDate(subscription.currentPeriodEnd)
                    : "No expiry"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {isAdminViewer
                    ? "Admin accounts use the control workspace instead of a billable subscription."
                    : hasEntitlement
                    ? "Your workspace already has premium access."
                    : "Upgrade to unlock higher limits and premium visibility."}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.section>

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

        <motion.section
          animate="animate"
          className="mt-6 grid gap-5 xl:grid-cols-4"
          initial="initial"
          variants={staggerContainer}
        >
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`pricing-skeleton-${index}`}
                  className="panel h-[460px] animate-pulse"
                />
              ))
            : plans.map((plan) => {
                const isCurrentPlan = hasEntitlement && currentPlanCode === plan.code;
                const isCurrentCycle =
                  isCurrentPlan && normalizeBillingCycle(currentBillingCycle) === billingCycle;
                const isProcessing =
                  processingAction === plan.code ||
                  (processingAction === "free" && plan.code === "free");
                const price = getPlanPrice(plan, billingCycle);
                const priceCurrency = plan.variants?.[billingCycle]?.currency || "USD";
                const ctaLabel =
                  isAdminViewer
                    ? "Manage in admin"
                    : plan.code === "free"
                    ? !session?.token
                      ? "Get Started"
                      : isCurrentPlan
                        ? "Current plan"
                        : "Get Started"
                    : getPaidPlanLabel({
                        isCurrentPlan,
                        isCurrentCycle,
                        billingCycle
                      });
                const buttonDisabled =
                  isProcessing ||
                  (!isAdminViewer &&
                    (plan.code === "free" ? isCurrentPlan : isCurrentPlan && isCurrentCycle));

                return (
                  <motion.article
                    key={plan.code}
                    {...hoverLift}
                    className={`relative overflow-hidden rounded-2xl border p-6 shadow-panel ${
                      plan.isPopular
                        ? "border-primary bg-primary text-white"
                        : isCurrentPlan
                          ? "border-accent bg-white"
                          : "border-line bg-white"
                    }`}
                    variants={staggerItem}
                  >
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 to-transparent" />

                    <div className="relative flex items-start justify-between gap-4">
                      <div>
                        <p
                          className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                            plan.isPopular ? "text-white/70" : "text-primary/45"
                          }`}
                        >
                          {plan.tier}
                        </p>
                        <h3 className="mt-3 text-2xl font-bold">{plan.name}</h3>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {plan.isPopular ? (
                          <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-semibold">
                            Most Popular
                          </span>
                        ) : null}
                        {isCurrentPlan ? (
                          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">
                            Active
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="relative mt-6">
                      <p className="text-4xl font-bold">
                        {formatCurrency(price, priceCurrency)}
                      </p>
                      <p
                        className={`mt-2 text-sm ${
                          plan.isPopular ? "text-white/70" : "text-muted"
                        }`}
                      >
                        {getPlanDurationLabel(billingCycle)}
                      </p>
                      {billingCycle === "yearly" && plan.monthlyRecurringValue ? (
                        <p
                          className={`mt-2 text-xs ${
                            plan.isPopular ? "text-white/70" : "text-primary/50"
                          }`}
                        >
                          Equivalent to{" "}
                          {formatCurrency(plan.monthlyRecurringValue, priceCurrency)} per month
                        </p>
                      ) : null}
                    </div>

                    <p
                      className={`mt-4 text-sm leading-7 ${
                        plan.isPopular ? "text-white/82" : "text-muted"
                      }`}
                    >
                      {plan.description ||
                        `${plan.name} is built for ${formatPlanCode(plan.code)} users.`}
                    </p>

                    <div className="mt-5 space-y-3">
                      {plan.features.map((feature) => (
                        <div
                          key={`${plan.code}-${feature}`}
                          className={`flex items-start gap-3 text-sm ${
                            plan.isPopular ? "text-white/90" : "text-muted"
                          }`}
                        >
                          <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div
                      className={`mt-6 rounded-2xl px-4 py-3 text-xs ${
                        plan.isPopular
                          ? "bg-white/10 text-white/80"
                          : "bg-canvas text-primary/55"
                      }`}
                    >
                      RFQs/month: {plan.limits.rfqsPerMonth} | Matches/month:{" "}
                      {plan.limits.matchesPerMonth}
                    </div>

                    <motion.button
                      {...buttonMotion}
                      className={`mt-6 w-full ${
                        isCurrentPlan || plan.isPopular ? "btn-secondary" : "btn-primary"
                      }`}
                      disabled={buttonDisabled}
                      onClick={() => handlePlanAction(plan)}
                      type="button"
                    >
                      {isProcessing ? "Processing..." : ctaLabel}
                    </motion.button>

                    <p
                      className={`mt-3 text-xs leading-6 ${
                        plan.isPopular ? "text-white/72" : "text-primary/50"
                      }`}
                    >
                      {plan.code === "free"
                        ? isAdminViewer
                          ? "Admin accounts manage pricing from the admin workspace."
                          : "Free access activates instantly."
                        : isAdminViewer
                          ? "Admin accounts preview plans here and manage pricing inside the admin workspace."
                          : "You will choose Stripe or Razorpay on the next step."}
                    </p>
                  </motion.article>
                );
              })}
        </motion.section>
      </div>
    </motion.main>
  );
}
