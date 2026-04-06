"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SiteHeader from "@/components/marketing/SiteHeader";
import { apiRequest } from "@/lib/api";
import { formatPaymentProvider } from "@/lib/billing";
import { formatDate } from "@/lib/format";
import { getSession, saveSession } from "@/lib/session";

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

export default function PricingSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(5);
  const provider = searchParams.get("provider") || "";
  const dashboardHref = getSession()?.user?.role === "admin" ? "/admin" : "/dashboard";

  useEffect(() => {
    const session = getSession();

    if (!session?.token) {
      router.replace("/login");
      return;
    }

    if (session.user?.role === "admin") {
      router.replace("/admin");
      return;
    }

    const run = async () => {
      setLoading(true);
      setError("");

      try {
        let response;
        const sessionId = searchParams.get("session_id");

        if (sessionId) {
          response = await apiRequest("/subscriptions/confirm/stripe", {
            method: "POST",
            token: session.token,
            body: {
              sessionId
            }
          });
        } else {
          response = await apiRequest("/subscriptions/me", {
            token: session.token
          });
        }

        setSubscription(response.subscription || null);
        syncSessionPlan(response.subscription);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [router, searchParams]);

  useEffect(() => {
    if (loading || error) {
      return;
    }

    if (countdown <= 0) {
      router.replace(dashboardHref);
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [countdown, dashboardHref, error, loading, router]);

  return (
    <main className="min-h-screen bg-canvas pb-10">
      <SiteHeader compact />

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-line bg-white p-8 shadow-panel sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
            GenuineTrade Billing
          </p>
          <h1 className="mt-4 text-4xl font-bold text-ink sm:text-5xl">
            Payment successful
          </h1>
          <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
            Your subscription is confirmed and your workspace access is updating in
            real time.
          </p>

          {loading ? (
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="surface-muted h-32 animate-pulse" />
              <div className="surface-muted h-32 animate-pulse" />
            </div>
          ) : error ? (
            <div className="mt-8 rounded-3xl border border-danger/20 bg-danger/10 px-5 py-4 text-sm text-danger">
              {error}
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                <div className="surface-muted p-5">
                  <p className="text-sm text-muted">Active plan</p>
                  <p className="mt-2 text-2xl font-bold text-primary">
                    {subscription?.planName || "Updated"}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Billing cycle: {subscription?.billingCycle || "monthly"}
                  </p>
                </div>
                <div className="surface-muted p-5">
                  <p className="text-sm text-muted">Expiry or renewal</p>
                  <p className="mt-2 text-2xl font-bold text-primary">
                    {subscription?.currentPeriodEnd
                      ? formatDate(subscription.currentPeriodEnd)
                      : "No expiry"}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Redirecting to dashboard in {countdown} seconds.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="surface-muted p-5">
                  <p className="text-sm text-muted">Activated on</p>
                  <p className="mt-2 text-2xl font-bold text-primary">
                    {subscription?.currentPeriodStart
                      ? formatDate(subscription.currentPeriodStart)
                      : "Today"}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Your new plan is now available across the dashboard, RFQs, and
                    analytics.
                  </p>
                </div>
                <div className="surface-muted p-5">
                  <p className="text-sm text-muted">Payment provider</p>
                  <p className="mt-2 text-2xl font-bold text-primary">
                    {formatPaymentProvider(
                      provider || subscription?.paymentProvider || "test_mode"
                    )}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Activation only completes after payment verification succeeds.
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={dashboardHref} className="btn-primary">
              Open dashboard
            </Link>
            <Link href="/pricing" className="btn-secondary">
              Back to pricing
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
