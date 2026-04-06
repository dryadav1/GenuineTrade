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
import {
  formatCurrency,
  formatDateTime,
  formatScore
} from "@/lib/format";

const PAGE_LIMIT = 12;

const createInitialFilters = () => ({
  search: "",
  country: ""
});

export default function AdminRFQsPage() {
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
  const { data, loading, error, reload } = useAdminFetch("/admin/rfqs", params);

  const rows = (data?.items || []).map((rfq) => ({
    key: rfq.id,
    request: (
      <div>
        <p className="font-semibold text-primary">{rfq.product}</p>
        <p className="text-xs text-muted">{rfq.quantity}</p>
      </div>
    ),
    market: (
      <div>
        <p className="font-medium text-ink">{rfq.country}</p>
        <p className="text-xs text-muted">
          {rfq.budget ? formatCurrency(rfq.budget) : "Budget not provided"}
        </p>
      </div>
    ),
    buyer: (
      <div>
        <p className="font-medium text-ink">{rfq.buyerCompany || "Unknown buyer"}</p>
        <p className="text-xs text-muted">
          {rfq.buyerEmail || rfq.buyerCountry || "No buyer details"}
        </p>
      </div>
    ),
    matching: (
      <div className="flex flex-wrap gap-2">
        <StatusBadge value={`${rfq.matchCount} matches`} />
        <StatusBadge value={`Top ${formatScore(rfq.topMatchScore)}`} />
      </div>
    ),
    createdAt: formatDateTime(rfq.createdAt)
  }));

  return (
    <>
      <AdminStateBanner actionLabel="Retry" message={error} onAction={reload} />

      {loading ? (
        <LoadingGrid count={4} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total RFQs" value={Number(data?.summary?.totalRFQs || 0)} />
          <StatCard label="Total Matches" value={Number(data?.summary?.totalMatches || 0)} />
          <StatCard
            label="Avg Top Match"
            value={formatScore(Number(data?.summary?.avgTopMatchScore || 0))}
          />
          <StatCard label="Result Count" value={Number(data?.pagination?.total || 0)} />
        </div>
      )}

      <SectionCard
        eyebrow="RFQ Operations"
        title="Paginated RFQ inventory"
        description="Search active demand by product or country and review buyer context without loading every request into the browser."
      >
        <form
          className="grid gap-4 md:grid-cols-[1.4fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setAppliedFilters(draftFilters);
          }}
        >
          <input
            className="field"
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                search: event.target.value
              }))
            }
            placeholder="Search by product or country"
            value={draftFilters.search}
          />
          <input
            className="field"
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                country: event.target.value
              }))
            }
            placeholder="Filter by country"
            value={draftFilters.country}
          />
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
                <div key={`rfq-skeleton-${index}`} className="surface-muted h-24 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <DataTable
                columns={[
                  { key: "request", label: "Request" },
                  { key: "market", label: "Market" },
                  { key: "buyer", label: "Buyer" },
                  { key: "matching", label: "Matching" },
                  { key: "createdAt", label: "Created" }
                ]}
                empty={
                  <EmptyState
                    title="No RFQs match these filters"
                    description="Try widening the search or removing the country filter."
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
