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
import { formatDateTime } from "@/lib/format";

const PAGE_LIMIT = 10;

export default function AdminVerificationPage() {
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState({
    stage: "",
    approvalState: ""
  });
  const [appliedFilters, setAppliedFilters] = useState({
    stage: "",
    approvalState: ""
  });
  const params = useMemo(
    () => ({
      page,
      limit: PAGE_LIMIT,
      ...appliedFilters
    }),
    [appliedFilters, page]
  );
  const { data, loading, error, reload } = useAdminFetch("/admin/verification", params);

  const readyCount = (data?.items || []).filter((item) => item.readyForReview).length;
  const uploadedDocuments = (data?.items || []).reduce(
    (total, item) => total + Number(item.uploadedCount || 0),
    0
  );

  const rows = (data?.items || []).map((item) => ({
    key: item.id,
    exporter: (
      <div>
        <p className="font-semibold text-primary">{item.companyName}</p>
        <p className="text-xs text-muted">{item.email || "No email"}</p>
      </div>
    ),
    location: (
      <div>
        <p className="font-medium text-ink">{item.country}</p>
        <p className="text-xs text-muted">Trust score {Math.round(item.trustScore * 100)}%</p>
      </div>
    ),
    readiness: (
      <div className="flex flex-wrap gap-2">
        <StatusBadge value={item.verificationStage} />
        <StatusBadge value={item.approvalState} />
        <StatusBadge value={item.readyForReview ? "ready" : "waiting"} />
      </div>
    ),
    documents: (
      <div>
        <p className="font-medium text-ink">
          {item.uploadedCount} uploaded / {item.approvedCount} approved
        </p>
        <p className="text-xs text-muted">
          {item.missingDocumentTypes.length
            ? `Missing: ${item.missingDocumentTypes.join(", ")}`
            : "All required files present"}
        </p>
      </div>
    ),
    updated: formatDateTime(item.reviewedAt || item.createdAt)
  }));

  return (
    <>
      <AdminStateBanner actionLabel="Retry" message={error} onAction={reload} />

      {loading ? (
        <LoadingGrid count={4} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Queue Size" value={Number(data?.pagination?.total || 0)} />
          <StatCard label="Ready For Review" value={readyCount} />
          <StatCard label="Uploaded Docs" value={uploadedDocuments} />
          <StatCard label="Visible Stages" value={Number(data?.summary?.length || 0)} />
        </div>
      )}

      <SectionCard
        eyebrow="Verification"
        title="Compliance queue"
        description="Verification loads in small pages so admin reviewers can inspect readiness without downloading the whole exporter base."
      >
        <form
          className="grid gap-4 md:grid-cols-4"
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
                stage: event.target.value
              }))
            }
            value={draftFilters.stage}
          >
            <option value="">All stages</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under review</option>
            <option value="documents_requested">Documents requested</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            className="field"
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                approvalState: event.target.value
              }))
            }
            value={draftFilters.approvalState}
          >
            <option value="">All approval states</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button className="btn-primary" type="submit">
              Apply filters
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                const nextFilters = { stage: "", approvalState: "" };
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
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`verification-skeleton-${index}`}
                  className="surface-muted h-24 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <>
              <DataTable
                columns={[
                  { key: "exporter", label: "Exporter" },
                  { key: "location", label: "Location" },
                  { key: "readiness", label: "Readiness" },
                  { key: "documents", label: "Documents" },
                  { key: "updated", label: "Updated" }
                ]}
                empty={
                  <EmptyState
                    title="No verification items match"
                    description="Try widening the stage or approval filters."
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
