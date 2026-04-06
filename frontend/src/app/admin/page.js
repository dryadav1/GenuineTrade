"use client";

import dynamic from "next/dynamic";
import EmptyState from "@/components/common/EmptyState";
import LoadingGrid from "@/components/common/LoadingGrid";
import DataTable from "@/components/common/DataTable";
import AdminStateBanner from "@/components/admin/AdminStateBanner";
import SectionCard from "@/components/SectionCard";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { useAdminContext } from "@/components/admin/AdminLayoutClient";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatCurrency, formatDateTime } from "@/lib/format";

const AdminBarChart = dynamic(() => import("@/components/admin/AdminBarChart"), {
  ssr: false,
  loading: () => <div className="surface-muted h-64 animate-pulse" />
});

export default function AdminDashboardPage() {
  const { canManageCore } = useAdminContext();
  const { data, loading, error, reload } = useAdminFetch("/admin/overview");

  const recentUserRows = (data?.recentUsers || []).map((user) => ({
    key: user.id,
    user: (
      <div>
        <p className="font-semibold text-primary">{user.name || "Unnamed user"}</p>
        <p className="text-xs text-muted">{user.email}</p>
      </div>
    ),
    role: <StatusBadge value={user.role} />,
    company: user.company || "No company yet",
    status: (
      <div className="flex flex-wrap gap-2">
        <StatusBadge value={user.status} />
        <StatusBadge value={user.accountStatus} />
      </div>
    ),
    createdAt: formatDateTime(user.createdAt)
  }));

  return (
    <>
      {!canManageCore ? (
        <AdminStateBanner
          message="Sub Admin access is active. You can review operational data, while platform settings and pricing changes stay reserved for Super Admin users."
          tone="info"
        />
      ) : null}

      <AdminStateBanner actionLabel="Retry" message={error} onAction={reload} />

      {loading ? (
        <LoadingGrid count={4} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            detail="Captured across secure trade transactions."
            label="Total Revenue"
            value={Number(data?.metrics?.totalRevenue || 0)}
            valueFormatter={(value) => formatCurrency(value)}
          />
          <StatCard
            detail="Buyers and exporters currently on the platform."
            label="Total Users"
            value={Number(data?.metrics?.totalUsers || 0)}
          />
          <StatCard
            detail="RFQs opened within the last 30 days."
            label="Active RFQs"
            value={Number(data?.metrics?.activeRFQs || 0)}
          />
          <StatCard
            detail="Month-over-month user growth."
            label="Growth %"
            value={`${Number(data?.metrics?.growthPercent || 0)}%`}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <SectionCard
          eyebrow="Revenue"
          title="Revenue trend"
          description="A lightweight monthly revenue series keeps the admin dashboard responsive without shipping a heavy charting library."
        >
          {loading ? (
            <div className="surface-muted h-64 animate-pulse" />
          ) : (
            <AdminBarChart
              data={data?.revenueSeries || []}
              emptyLabel="Revenue data will appear here after the first transactions are processed."
              valueFormatter={(value) => formatCurrency(value)}
            />
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Recent users"
          title="Newest signups"
          description="Recent platform users stay visible for fast approval and onboarding follow-up."
        >
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`recent-user-${index}`} className="surface-muted h-20 animate-pulse" />
              ))}
            </div>
          ) : recentUserRows.length ? (
            <DataTable
              columns={[
                { key: "user", label: "User" },
                { key: "role", label: "Role" },
                { key: "company", label: "Company" },
                { key: "status", label: "Status" },
                { key: "createdAt", label: "Created" }
              ]}
              empty={
                <EmptyState
                  title="No recent users"
                  description="New signups will appear here as the marketplace grows."
                />
              }
              rows={recentUserRows}
            />
          ) : (
            <EmptyState
              title="No recent users"
              description="New signups will appear here as the marketplace grows."
            />
          )}
        </SectionCard>
      </div>
    </>
  );
}
