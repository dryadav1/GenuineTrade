"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/common/EmptyState";
import PaginationControls from "@/components/common/PaginationControls";
import DataTable from "@/components/common/DataTable";
import LoadingGrid from "@/components/common/LoadingGrid";
import AdminStateBanner from "@/components/admin/AdminStateBanner";
import SectionCard from "@/components/SectionCard";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { useAdminContext } from "@/components/admin/AdminLayoutClient";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const PAGE_LIMIT = 12;
const STATUS_OPTIONS = ["pending", "verified", "rejected"];
const BADGE_OPTIONS = ["none", "verified", "trusted", "top_supplier"];

const createInitialFilters = () => ({
  search: "",
  role: "",
  status: "",
  accountStatus: ""
});

const buildReviewState = (items = []) =>
  items.reduce((map, item) => {
    map[item.id] = {
      status: item.status || "pending",
      badge: item.badge || "none",
      saving: false
    };
    return map;
  }, {});

export default function AdminUsersPage() {
  const { session } = useAdminContext();
  const [page, setPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState(createInitialFilters());
  const [appliedFilters, setAppliedFilters] = useState(createInitialFilters());
  const [reviewState, setReviewState] = useState({});
  const [actionError, setActionError] = useState("");
  const params = useMemo(
    () => ({
      page,
      limit: PAGE_LIMIT,
      ...appliedFilters
    }),
    [appliedFilters, page]
  );
  const { data, loading, error, reload } = useAdminFetch("/admin/users", params);

  useEffect(() => {
    setReviewState(buildReviewState(data?.items || []));
  }, [data?.items]);

  const handleFilterChange = (field, value) => {
    setDraftFilters((current) => ({
      ...current,
      [field]: value
    }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters(draftFilters);
  };

  const clearFilters = () => {
    const nextFilters = createInitialFilters();
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
  };

  const updateReviewState = (userId, field, value) => {
    setReviewState((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        [field]: value
      }
    }));
  };

  const saveReview = async (userId) => {
    const review = reviewState[userId];

    if (!review) {
      return;
    }

    setActionError("");
    setReviewState((current) => ({
      ...current,
      [userId]: {
        ...current[userId],
        saving: true
      }
    }));

    try {
      await apiRequest(`/admin/users/${userId}/review`, {
        method: "PATCH",
        token: session.token,
        body: {
          status: review.status,
          badge: review.badge
        }
      });

      await reload();
    } catch (requestError) {
      setActionError(requestError.message);
      setReviewState((current) => ({
        ...current,
        [userId]: {
          ...current[userId],
          saving: false
        }
      }));
    }
  };

  const rows = (data?.items || []).map((user) => {
    const review = reviewState[user.id] || {
      status: user.status,
      badge: user.badge,
      saving: false
    };

    return {
      key: user.id,
      user: (
        <div>
          <p className="font-semibold text-primary">{user.name || "Unnamed user"}</p>
          <p className="text-xs text-muted">{user.email}</p>
        </div>
      ),
      role: <StatusBadge value={user.role} />,
      company: (
        <div>
          <p className="font-medium text-ink">{user.company || "No company yet"}</p>
          <p className="text-xs text-muted">{user.country || "No country"}</p>
        </div>
      ),
      plan: (
        <div>
          <p className="font-medium text-ink">{user.subscriptionPlan || "free"}</p>
          <p className="text-xs text-muted">
            {user.planExpiry ? formatDateTime(user.planExpiry) : "No expiry"}
          </p>
        </div>
      ),
      status: (
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={user.status} />
          <StatusBadge value={user.accountStatus} />
        </div>
      ),
      review: (
        <div className="grid gap-2">
          <select
            className="field"
            onChange={(event) => updateReviewState(user.id, "status", event.target.value)}
            value={review.status}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            className="field"
            onChange={(event) => updateReviewState(user.id, "badge", event.target.value)}
            value={review.badge}
          >
            {BADGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            className="btn-primary"
            disabled={review.saving}
            onClick={() => saveReview(user.id)}
            type="button"
          >
            {review.saving ? "Saving..." : "Save"}
          </button>
        </div>
      )
    };
  });

  return (
    <>
      <AdminStateBanner
        actionLabel="Retry"
        message={actionError || error}
        onAction={reload}
      />

      {loading ? (
        <LoadingGrid count={4} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Matched Users" value={Number(data?.summary?.total || 0)} />
          <StatCard label="Active Accounts" value={Number(data?.summary?.active || 0)} />
          <StatCard label="Pending Reviews" value={Number(data?.summary?.pending || 0)} />
          <StatCard label="Verified Users" value={Number(data?.summary?.verified || 0)} />
        </div>
      )}

      <SectionCard
        eyebrow="Management"
        title="User operations"
        description="Search, filter, paginate, and review users without loading the full user base at once."
      >
        <form className="grid gap-4 md:grid-cols-5" onSubmit={applyFilters}>
          <input
            className="field md:col-span-2"
            onChange={(event) => handleFilterChange("search", event.target.value)}
            placeholder="Search name, email, or company"
            value={draftFilters.search}
          />
          <select
            className="field"
            onChange={(event) => handleFilterChange("role", event.target.value)}
            value={draftFilters.role}
          >
            <option value="">All roles</option>
            <option value="buyer">Buyer</option>
            <option value="exporter">Exporter</option>
            <option value="admin">Admin</option>
          </select>
          <select
            className="field"
            onChange={(event) => handleFilterChange("status", event.target.value)}
            value={draftFilters.status}
          >
            <option value="">All review states</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            className="field"
            onChange={(event) =>
              handleFilterChange("accountStatus", event.target.value)
            }
            value={draftFilters.accountStatus}
          >
            <option value="">All account states</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="blocked">Blocked</option>
          </select>

          <div className="flex flex-wrap gap-3 md:col-span-5">
            <button className="btn-primary" type="submit">
              Apply filters
            </button>
            <button className="btn-secondary" onClick={clearFilters} type="button">
              Clear
            </button>
          </div>
        </form>

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`user-skeleton-${index}`} className="surface-muted h-24 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <DataTable
                columns={[
                  { key: "user", label: "User" },
                  { key: "role", label: "Role" },
                  { key: "company", label: "Company" },
                  { key: "plan", label: "Plan" },
                  { key: "status", label: "Status" },
                  { key: "review", label: "Review" }
                ]}
                empty={
                  <EmptyState
                    title="No users match these filters"
                    description="Adjust the filters to widen the result set."
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
