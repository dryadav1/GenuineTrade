"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import ActionModal from "@/components/common/ActionModal";
import EmptyState from "@/components/common/EmptyState";
import LoadingGrid from "@/components/common/LoadingGrid";
import PaginationControls from "@/components/common/PaginationControls";
import FormField from "@/components/FormField";
import SectionCard from "@/components/SectionCard";
import StatusBadge from "@/components/StatusBadge";
import { useToast, useToastOnChange } from "@/components/feedback/ToastProvider";
import { apiRequest } from "@/lib/api";
import { formatCurrency, formatScore } from "@/lib/format";
import { useWorkspaceSession } from "@/lib/workspace";

const initialForm = {
  product: "",
  quantity: "",
  country: "",
  budget: ""
};

function RFQsWorkspace() {
  const { session, ready } = useWorkspaceSession();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ product: "", country: "" });
  const [form, setForm] = useState(initialForm);
  const [subscription, setSubscription] = useState(null);
  const [data, setData] = useState({
    items: [],
    pagination: null
  });
  const toast = useToast();
  const presetProduct = searchParams.get("product") || "";
  const presetExporterId = searchParams.get("exporterId") || "";

  useToastOnChange({
    errorMessage: error,
    errorTitle: "RFQ issue"
  });

  useEffect(() => {
    if (!ready || !session) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        let response;

        if (session.user.role === "buyer") {
          const [rfqResponse, subscriptionData] = await Promise.all([
            apiRequest(`/buyers/me/rfqs?page=${page}&limit=8`, {
              token: session.token
            }),
            apiRequest("/subscriptions/me", {
              token: session.token
            })
          ]);
          response = rfqResponse;
          setSubscription(subscriptionData.subscription);
        } else if (session.user.role === "exporter") {
          response = await apiRequest(`/exporters/me/matches?page=${page}&limit=8`, {
            token: session.token
          });
        } else {
          const query = new URLSearchParams({
            page: `${page}`,
            limit: "8",
            ...(filters.product ? { product: filters.product } : {}),
            ...(filters.country ? { country: filters.country } : {})
          }).toString();

          response = await apiRequest(`/admin/rfqs?${query}`, {
            token: session.token
          });
        }

        setData(response);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [filters.country, filters.product, page, ready, session]);

  useEffect(() => {
    if (!ready || !session || session.user.role !== "buyer") {
      return;
    }

    if (!presetProduct && !presetExporterId) {
      return;
    }

    setForm((current) => ({
      ...current,
      product: current.product || presetProduct
    }));
    setModalOpen(true);
  }, [presetExporterId, presetProduct, ready, session]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleCreateRFQ = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await apiRequest("/rfqs", {
        method: "POST",
        token: session.token,
        body: {
          ...form,
          budget: form.budget ? Number(form.budget) : null
        }
      });

      setForm(initialForm);
      setModalOpen(false);
      setPage(1);
      const refreshed = await apiRequest("/buyers/me/rfqs?page=1&limit=8", {
        token: session.token
      });
      const subscriptionData = await apiRequest("/subscriptions/me", {
        token: session.token
      });
      setData(refreshed);
      setSubscription(subscriptionData.subscription);
      toast.success("Your RFQ is live and ready for matching.", {
        title: "RFQ posted"
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready || !session || loading) {
    return (
      <AppShell
        session={session || { user: { role: "buyer", email: "Loading" } }}
        title="RFQ workspace"
        subtitle="Loading role-specific RFQ data."
      >
        <LoadingGrid count={4} />
      </AppShell>
    );
  }

  const role = session.user.role;

  return (
    <AppShell
      session={session}
      title="RFQ workspace"
      subtitle="Manage requests for quotation with role-specific views for buyers, exporters, and admins."
    >
      {error ? <div className="panel p-5 text-sm text-danger">{error}</div> : null}

      {role === "buyer" ? (
        <>
          <SectionCard
            eyebrow="Buyer"
            title="Create and track RFQs"
            description="Capture buyer intent quickly, then let the matching engine produce ranked exporters."
          >
            <div className="flex flex-wrap gap-3">
              <button className="btn-accent" onClick={() => setModalOpen(true)} type="button">
                Post RFQ
              </button>
            </div>

            {presetExporterId ? (
              <div className="mt-5 surface-muted p-4">
                <p className="text-sm font-semibold text-primary">
                  RFQ started from exporter discovery
                </p>
                <p className="mt-2 text-sm text-muted">
                  The product field is pre-filled from the exporter you selected so you can move
                  from discovery into a formal request quickly.
                </p>
              </div>
            ) : null}

            {subscription ? (
              <div className="mt-5 surface-muted p-4">
                <p className="text-sm font-semibold text-primary">
                  {subscription.planName} plan
                </p>
                <p className="mt-2 text-sm text-muted">
                  RFQs used this month: {subscription.usage?.rfqs.used || 0} /{" "}
                  {subscription.usage?.rfqs.limitLabel || "Unlimited"}
                </p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {data.items.length ? (
                data.items.map((rfq) => (
                  <div key={rfq.id} className="surface-muted p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-primary">{rfq.product}</p>
                        <p className="text-sm text-muted">
                          {rfq.quantity} | {rfq.country}
                        </p>
                      </div>
                      <StatusBadge value={`${rfq.matchCount} matches`} />
                    </div>
                    <p className="mt-4 text-sm text-muted">
                      Budget: {rfq.budget ? formatCurrency(rfq.budget) : "Not provided"}
                    </p>
                    <p className="mt-2 text-sm text-muted">
                      Top match score: {formatScore(rfq.topMatchScore)}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No RFQs created yet"
                  description="Use the highlighted action to post your first buyer request."
                />
              )}
            </div>
          </SectionCard>

          <ActionModal
            description="Describe the demand clearly so the scoring engine can rank the most relevant exporters."
            onClose={() => setModalOpen(false)}
            open={modalOpen}
            title="Post new RFQ"
          >
            <form className="space-y-4" onSubmit={handleCreateRFQ}>
              <FormField
                label="Product"
                name="product"
                onChange={handleFormChange}
                placeholder="Turmeric powder"
                required
                value={form.product}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Quantity"
                  name="quantity"
                  onChange={handleFormChange}
                  placeholder="25 tons"
                  required
                  value={form.quantity}
                />
                <FormField
                  label="Target country"
                  name="country"
                  onChange={handleFormChange}
                  placeholder="UAE"
                  required
                  value={form.country}
                />
              </div>
              <FormField
                label="Budget (optional)"
                name="budget"
                onChange={handleFormChange}
                placeholder="12000"
                type="number"
                value={form.budget}
              />
              <button className="btn-primary w-full" disabled={submitting} type="submit">
                {submitting ? "Creating RFQ..." : "Create RFQ"}
              </button>
            </form>
          </ActionModal>
        </>
      ) : null}

      {role === "exporter" ? (
        <SectionCard
          eyebrow="Exporter"
          title="Incoming RFQ opportunities"
          description="Your verified profile appears here when the matching engine scores you highly against buyer demand."
        >
          <div className="space-y-4">
            {data.items.length ? (
              data.items.map((match) => (
                <div key={match.id} className="surface-muted p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-primary">{match.rfq?.product}</p>
                      <p className="text-sm text-muted">
                        {match.rfq?.country} | {match.rfq?.quantity}
                      </p>
                    </div>
                    <StatusBadge value={formatScore(match.totalScore)} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {match.reasons.map((reason) => (
                      <span
                        key={`${match.id}-${reason}`}
                        className="rounded-full bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No matched RFQs yet"
                description="As buyers post relevant demand, this view will fill with ranked opportunities."
              />
            )}
          </div>
        </SectionCard>
      ) : null}

      {role === "admin" ? (
        <SectionCard
          eyebrow="Admin"
          title="Global RFQ monitoring"
          description="Filter by product and country to review new buyer demand across the marketplace."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Filter by product"
              name="product"
              onChange={(event) =>
                setFilters((current) => ({ ...current, product: event.target.value }))
              }
              placeholder="Rice"
              value={filters.product}
            />
            <FormField
              label="Filter by country"
              name="country"
              onChange={(event) =>
                setFilters((current) => ({ ...current, country: event.target.value }))
              }
              placeholder="India"
              value={filters.country}
            />
          </div>

          <div className="mt-6 space-y-4">
            {data.items.length ? (
              data.items.map((rfq) => (
                <div key={rfq.id} className="surface-muted p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-primary">{rfq.product}</p>
                      <p className="text-sm text-muted">
                        {rfq.country} | {rfq.quantity}
                      </p>
                    </div>
                    <StatusBadge value={`${rfq.matchCount} matches`} />
                  </div>
                  <p className="mt-4 text-sm text-muted">
                    Budget: {rfq.budget ? formatCurrency(rfq.budget) : "Not provided"}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState
                title="No RFQs match the current filters"
                description="Adjust the filter values or wait for new demand to arrive."
              />
            )}
          </div>
        </SectionCard>
      ) : null}

      <PaginationControls pagination={data.pagination} onPageChange={setPage} />
    </AppShell>
  );
}

export default function RFQsPage() {
  return (
    <Suspense
      fallback={
        <AppShell
          session={{ user: { role: "buyer", email: "Loading" } }}
          title="RFQ workspace"
          subtitle="Loading role-specific RFQ data."
        >
          <LoadingGrid count={4} />
        </AppShell>
      }
    >
      <RFQsWorkspace />
    </Suspense>
  );
}
