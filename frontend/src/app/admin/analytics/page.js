"use client";

import dynamic from "next/dynamic";
import LoadingGrid from "@/components/common/LoadingGrid";
import AdminDistributionList from "@/components/admin/AdminDistributionList";
import AdminStateBanner from "@/components/admin/AdminStateBanner";
import SectionCard from "@/components/SectionCard";
import StatCard from "@/components/StatCard";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatCurrency } from "@/lib/format";

const AdminBarChart = dynamic(() => import("@/components/admin/AdminBarChart"), {
  ssr: false,
  loading: () => <div className="surface-muted h-64 animate-pulse" />
});

export default function AdminAnalyticsPage() {
  const { data, loading, error, reload } = useAdminFetch("/admin/analytics");

  return (
    <>
      <AdminStateBanner actionLabel="Retry" message={error} onAction={reload} />

      {loading ? (
        <LoadingGrid count={5} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total Revenue"
            value={Number(data?.metrics?.totalRevenue || 0)}
            valueFormatter={(value) => formatCurrency(value)}
          />
          <StatCard
            label="Average Order"
            value={Number(data?.metrics?.averageOrderValue || 0)}
            valueFormatter={(value) => formatCurrency(value)}
          />
          <StatCard label="Total RFQs" value={Number(data?.metrics?.totalRFQs || 0)} />
          <StatCard
            label="Paid Subscriptions"
            value={Number(data?.metrics?.paidSubscriptions || 0)}
          />
          <StatCard
            label="Verified Exporters"
            value={Number(data?.metrics?.verifiedExporters || 0)}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          eyebrow="Revenue"
          title="Monthly revenue"
          description="Revenue is grouped by month on the server so the analytics surface stays fast as trade volume grows."
        >
          {loading ? (
            <div className="surface-muted h-64 animate-pulse" />
          ) : (
            <AdminBarChart
              data={data?.charts?.revenue || []}
              emptyLabel="Revenue analytics will populate after payments start flowing."
              valueFormatter={(value) => formatCurrency(value)}
            />
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Demand"
          title="Monthly RFQ volume"
          description="RFQ demand highlights how marketplace activity is moving month over month."
        >
          {loading ? (
            <div className="surface-muted h-64 animate-pulse" />
          ) : (
            <AdminBarChart
              data={data?.charts?.rfqs || []}
              emptyLabel="RFQ analytics will appear after the first demand is submitted."
            />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <SectionCard
          eyebrow="Audience"
          title="Role distribution"
          description="Track how the marketplace audience is split across admins, buyers, and exporters."
        >
          <AdminDistributionList items={data?.distributions?.roles || []} />
        </SectionCard>

        <SectionCard
          eyebrow="Plans"
          title="Plan mix"
          description="See which subscription tiers are contributing to active recurring revenue."
        >
          <AdminDistributionList items={data?.distributions?.plans || []} />
        </SectionCard>

        <SectionCard
          eyebrow="Providers"
          title="Payment provider mix"
          description="Monitor provider concentration so payments remain resilient as volume scales."
        >
          <AdminDistributionList items={data?.distributions?.providers || []} />
        </SectionCard>
      </div>
    </>
  );
}
