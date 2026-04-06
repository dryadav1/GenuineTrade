"use client";

import { useMemo, useState } from "react";
import EmptyState from "@/components/common/EmptyState";
import PaginationControls from "@/components/common/PaginationControls";
import DataTable from "@/components/common/DataTable";
import LoadingGrid from "@/components/common/LoadingGrid";
import AdminStateBanner from "@/components/admin/AdminStateBanner";
import SectionCard from "@/components/SectionCard";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { formatPaymentProvider, formatPlanCode } from "@/lib/billing";
import { formatCurrency, formatDateTime } from "@/lib/format";

const PAGE_LIMIT = 12;

const createInitialFilters = () => ({
  planCode: "",
  status: ""
});

const isExpiringSoon = (value) => {
  if (!value) {
    return false;
  }

  const expiryTime = new Date(value).getTime();
  const now = Date.now();
  const threshold = now + 7 * 24 * 60 * 60 * 1000;
  return expiryTime >= now && expiryTime <= threshold;
};

export default function AdminSubscriptionsPage() {
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState(createInitialFilters());
  const [appliedFilters, setAppliedFilters] = useState(createInitialFilters());
  const params = useMemo(
    () => ({
      page,
      limit: PAGE_LIMIT,
      ...appliedFilters
    }),
    [appliedFilters, page]
  );
  const { data, loading, error, reload } = useAdminFetch("/admin/subscriptions", params);

  const rows = (data?.items || []).map((subscription) => ({
    key: subscription.id,
    subscriber: (
      <div>
        <p className="font-semibold text-primary">
          {subscription.userName || "Unknown subscriber"}
        </p>
        <p className="text-xs text-muted">{subscription.userEmail || "No email"}</p>
      </div>
    ),
    plan: (
      <div>
        <p className="font-medium text-ink">
          {subscription.planName || formatPlanCode(subscription.planCode)}
        </p>
        <p className="text-xs text-muted">{subscription.userRole || "No role"}</p>
      </div>
    ),
    billing: (
      <div>
        <p className="font-medium text-ink">
          {formatCurrency(subscription.amount, subscription.currency)}
        </p>
        <p className="text-xs text-muted">
          {formatPlanCode(subscription.billingCycle || "monthly")}
        </p>
      </div>
    ),
    provider: (
      <div className="flex flex-wrap gap-2">
        <StatusBadge value={formatPaymentProvider(subscription.paymentProvider)} />
        <StatusBadge value={subscription.lastPaymentStatus} />
      </div>
    ),
    renewal: (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={subscription.status} />
          {isExpiringSoon(subscription.currentPeriodEnd) ? (
            <StatusBadge value="expiring soon" />
          ) : null}
        </div>
        <p className="text-xs text-muted">
          {subscription.currentPeriodEnd
            ? `Period ends ${formatDateTime(subscription.currentPeriodEnd)}`
            : "No renewal date"}
        </p>
      </div>
    )
  }));

  return (
    <>
      <AdminStateBanner actionLabel="Retry" message={error} onAction={reload} />

      {loading ? (
        <LoadingGrid count={4} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active Plans" value={Number(data?.summary?.activeCount || 0)} />
          <StatCard label="Paid Accounts" value={Number(data?.summary?.paidCount || 0)} />
          <StatCard
            label="Monthly Revenue"
            value={Number(data?.summary?.monthlyRevenue || 0)}
            valueFormatter={(value) => formatCurrency(value)}
          />
          <StatCard label="Expiring Soon" value={Number(data?.summary?.expiringSoon || 0)} />
        </div>
      )}

      <SectionCard
        eyebrow="Subscriptions"
        title="Recurring plan health"
        description="Track renewals, payment providers, and at-risk accounts in compact pages built for finance and support workflows."
      >
        <form
          className="grid gap-4 md:grid-cols-[1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setAppliedFilters(draftFilters);
          }}
        >
          <select
            className="field"
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                planCode: event.target.value
              }))
            }
            value={draftFilters.planCode}
          >
            <option value="">All plans</option>
            <option value="free">Free</option>
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select
            className="field"
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                status: event.target.value
              }))
            }
            value={draftFilters.status}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
            <option value="past_due">Past due</option>
          </select>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" type="submit">
              Apply
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                const nextFilters = createInitialFilters();
                setDraftFilters(nextFilters);
                setAppliedFilters(nextFilters);
                setPage(1);
              }}
              type="button"
            >
              Clear
            </button>
          </div>
        </form>

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`subscription-skeleton-${index}`}
                  className="surface-muted h-24 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <DataTable
                columns={[
                  { key: "subscriber", label: "Subscriber" },
                  { key: "plan", label: "Plan" },
                  { key: "billing", label: "Billing" },
                  { key: "provider", label: "Provider" },
                  { key: "renewal", label: "Renewal" }
                ]}
                empty={
                  <EmptyState
                    title="No subscriptions match"
                    description="Try a different plan or status filter."
                  />
                }
                rows={rows}
              />

              <PaginationControls
                onPageChange={setPage}
                pagination={data?.pagination || null}
              />
            </>
          )}
        </div>
      </SectionCard>
    </>
  );
}
