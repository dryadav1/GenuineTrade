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
import { formatPaymentProvider } from "@/lib/billing";
import { formatCurrency, formatDateTime } from "@/lib/format";

const PAGE_LIMIT = 12;

const createInitialFilters = () => ({
  status: "",
  provider: ""
});

export default function AdminTransactionsPage() {
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
  const { data, loading, error, reload } = useAdminFetch("/admin/transactions", params);

  const rows = (data?.items || []).map((transaction) => ({
    key: transaction.id,
    trade: (
      <div>
        <p className="font-semibold text-primary">{transaction.product || "Trade payment"}</p>
        <p className="text-xs text-muted">
          {transaction.buyerCompany || "Buyer"} to {transaction.exporterCompany || "Exporter"}
        </p>
      </div>
    ),
    amount: (
      <div>
        <p className="font-medium text-ink">
          {formatCurrency(transaction.amount, transaction.currency)}
        </p>
        <p className="text-xs text-muted">
          Base {formatCurrency(transaction.baseAmount, transaction.baseCurrency)}
        </p>
      </div>
    ),
    provider: (
      <div className="flex flex-wrap gap-2">
        <StatusBadge value={formatPaymentProvider(transaction.provider)} />
        <StatusBadge value={transaction.escrowStatus} />
      </div>
    ),
    status: (
      <div className="flex flex-wrap gap-2">
        <StatusBadge value={transaction.status} />
        <StatusBadge value={transaction.refundStatus} />
      </div>
    ),
    createdAt: formatDateTime(transaction.createdAt)
  }));

  return (
    <>
      <AdminStateBanner actionLabel="Retry" message={error} onAction={reload} />

      {loading ? (
        <LoadingGrid count={4} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Volume"
            value={Number(data?.summary?.totalVolume || 0)}
            valueFormatter={(value) => formatCurrency(value)}
          />
          <StatCard
            label="Released Volume"
            value={Number(data?.summary?.releasedVolume || 0)}
            valueFormatter={(value) => formatCurrency(value)}
          />
          <StatCard label="Disputes" value={Number(data?.summary?.disputes || 0)} />
          <StatCard
            label="Average Order"
            value={Number(data?.summary?.averageOrderValue || 0)}
            valueFormatter={(value) => formatCurrency(value)}
          />
        </div>
      )}

      <SectionCard
        eyebrow="Payments"
        title="Transaction monitoring"
        description="Finance teams can review escrow state, refunds, and provider mix in a compact paginated ledger."
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
                status: event.target.value
              }))
            }
            value={draftFilters.status}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="payment_processing">Processing</option>
            <option value="in_escrow">In escrow</option>
            <option value="released">Released</option>
            <option value="disputed">Disputed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="field"
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                provider: event.target.value
              }))
            }
            value={draftFilters.provider}
          >
            <option value="">All providers</option>
            <option value="stripe">Stripe</option>
            <option value="razorpay">Razorpay</option>
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
                  key={`transaction-skeleton-${index}`}
                  className="surface-muted h-24 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <DataTable
                columns={[
                  { key: "trade", label: "Trade" },
                  { key: "amount", label: "Amount" },
                  { key: "provider", label: "Provider" },
                  { key: "status", label: "Status" },
                  { key: "createdAt", label: "Created" }
                ]}
                empty={
                  <EmptyState
                    title="No transactions found"
                    description="Try widening the provider or status filter."
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
