"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import AppShell from "@/components/app/AppShell";
import EmptyState from "@/components/common/EmptyState";
import LoadingGrid from "@/components/common/LoadingGrid";
import SectionCard from "@/components/SectionCard";
import StatCard from "@/components/StatCard";
import { apiRequest } from "@/lib/api";
import { formatScore } from "@/lib/format";
import { chartBarVariants, staggerContainer } from "@/lib/motion";
import { useWorkspaceSession } from "@/lib/workspace";

const parseMetricValue = (value) => {
  const numericValue = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numericValue) ? numericValue : 0;
};

function InsightBars({ items, metricLabel }) {
  const values = items.map((item) => parseMetricValue(item.value));
  const highestValue = Math.max(...values, 1);

  return (
    <motion.div
      animate="animate"
      className="space-y-3"
      initial="initial"
      variants={staggerContainer}
    >
      {items.map((item, index) => {
        const numericValue = parseMetricValue(item.value);
        const width = `${Math.max((numericValue / highestValue) * 100, 18)}%`;

        return (
          <div key={item.label} className="surface-muted rounded-[24px] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-primary">{item.label}</span>
              <span className="text-sm text-muted">
                {item.value} {metricLabel ? ` ${metricLabel}` : ""}
              </span>
            </div>
            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                custom={index}
                initial="initial"
                animate="animate"
                style={{ width, originX: 0 }}
                variants={chartBarVariants}
              />
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}

export default function AnalyticsPage() {
  const { session, ready } = useWorkspaceSession();
  const [state, setState] = useState({
    loading: true,
    error: "",
    data: null,
    locked: false
  });

  useEffect(() => {
    if (!ready || !session) {
      return;
    }

    const load = async () => {
      try {
        const data = await apiRequest("/analytics/overview", {
          token: session.token
        });

        setState({
          loading: false,
          error: "",
          data,
          locked: false
        });
      } catch (error) {
        if (error.message.includes("Analytics are available")) {
          const subscriptionData = await apiRequest("/subscriptions/me", {
            token: session.token
          });

          setState({
            loading: false,
            error: "",
            data: subscriptionData,
            locked: true
          });
          return;
        }

        setState({
          loading: false,
          error: error.message,
          data: null,
          locked: false
        });
      }
    };

    load();
  }, [ready, session]);

  if (!ready || !session || state.loading) {
    return (
      <AppShell
        session={session || { user: { role: "buyer", email: "Loading" } }}
        title="Analytics"
        subtitle="Loading insights and subscription access."
      >
        <LoadingGrid count={4} />
      </AppShell>
    );
  }

  if (state.locked) {
    return (
      <AppShell
        session={session}
        title="Analytics"
        subtitle="Paid plans unlock deeper insight into marketplace demand and conversion performance."
      >
        <SectionCard
          eyebrow="Upgrade"
          title="Analytics are locked on your current plan"
          description="Starter unlocks core analytics, Growth adds featured visibility and deeper insight, and Enterprise is built for full premium control."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {state.data.plans.map((plan) => (
              <div key={plan.code} className="surface-muted p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                  {plan.tier}
                </p>
                <p className="mt-3 text-2xl font-bold text-primary">{plan.name}</p>
                <p className="mt-2 text-sm text-muted">
                  ${plan.monthlyPrice}/mo | ${plan.annualPrice}/yr
                </p>
                <div className="mt-4 space-y-2 text-sm text-muted">
                  {plan.features.map((feature) => (
                    <p key={`${plan.code}-${feature}`}>{feature}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </AppShell>
    );
  }

  const analytics = state.data;

  if (!analytics) {
    return (
      <AppShell
        session={session}
        title="Analytics"
        subtitle="Marketplace insight will appear here once analytics data is available."
      >
        {state.error ? <div className="panel p-5 text-sm text-danger">{state.error}</div> : null}
        <EmptyState
          title="Analytics are not ready yet"
          description="This workspace could not load analytics right now. Refresh after the API is available or after your account profile is fully set up."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      session={session}
      title="Analytics"
      subtitle="Understand marketplace demand, fit quality, and where your account is gaining traction."
    >
      {state.error ? <div className="panel p-5 text-sm text-danger">{state.error}</div> : null}

      <div className="grid gap-4 md:grid-cols-3">
        {analytics.role === "buyer" ? (
          <>
            <StatCard
              detail="Fresh buyer requests flowing through the marketplace this month."
              label="RFQs this month"
              value={analytics.summary.totalRFQs}
            />
            <StatCard
              detail="Ranked supplier matches generated from your active demand."
              label="Matches this month"
              value={analytics.summary.totalMatches}
            />
            <StatCard
              detail="Average quality score of the strongest recommendations surfaced."
              label="Avg top match"
              value={formatScore(analytics.summary.avgTopMatchScore)}
            />
          </>
        ) : (
          <>
            <StatCard
              detail="RFQs where your catalog and trust profile created a qualified fit."
              label="Matched RFQs"
              value={analytics.summary.totalMatches}
            />
            <StatCard
              detail="Blended relevance score across product, geography, and readiness."
              label="Avg fit score"
              value={formatScore(analytics.summary.avgFitScore)}
            />
            <StatCard
              detail="Signals from verification, profile depth, and marketplace confidence."
              label="Trust score"
              value={formatScore(analytics.summary.trustScore)}
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard
          eyebrow="Performance"
          title="Momentum overview"
          description="Animated trend bars help you compare the signals that matter most at a glance."
        >
          <InsightBars
            items={
              analytics.role === "buyer"
                ? [
                    { label: "RFQ volume", value: analytics.summary.totalRFQs },
                    { label: "Match volume", value: analytics.summary.totalMatches },
                    { label: "Top match score", value: parseMetricValue(formatScore(analytics.summary.avgTopMatchScore)) }
                  ]
                : [
                    { label: "Matched RFQs", value: analytics.summary.totalMatches },
                    { label: "Average fit", value: parseMetricValue(formatScore(analytics.summary.avgFitScore)) },
                    { label: "Trust score", value: parseMetricValue(formatScore(analytics.summary.trustScore)) }
                  ]
            }
          />
        </SectionCard>

        <SectionCard
          eyebrow="Geography"
          title="Top countries"
          description="Track where demand is clustering this month."
        >
          <div className="space-y-3">
            {analytics.insights.topCountries.length ? (
              <InsightBars items={analytics.insights.topCountries} />
            ) : (
              <EmptyState
                title="No country insight yet"
                description="Analytics will fill in as more RFQs and matches are created."
              />
            )}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Products"
          title={analytics.role === "buyer" ? "Current plan access" : "Top products"}
          description={
            analytics.role === "buyer"
              ? "Your analytics access is plan-based and tied to subscription value."
              : "See which product categories are creating the most exporter opportunities."
          }
        >
          {analytics.role === "buyer" ? (
            <div className="surface-muted rounded-[28px] p-5">
              <p className="text-lg font-semibold text-primary">
                {analytics.subscription.planName}
              </p>
              <div className="mt-4 space-y-2 text-sm text-muted">
                {analytics.subscription.features.map((feature) => (
                  <p key={feature}>{feature}</p>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.insights.topProducts.length ? (
                <InsightBars items={analytics.insights.topProducts} />
              ) : (
                <EmptyState
                  title="No product insight yet"
                  description="As more RFQs are matched, the strongest product demand will show up here."
                />
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}
