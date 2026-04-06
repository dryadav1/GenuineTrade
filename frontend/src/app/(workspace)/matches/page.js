"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

const initialTradeState = {
  amount: "",
  currency: "USD",
  paymentMethod: "card"
};

export default function MatchesPage() {
  const { session, ready } = useWorkspaceSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [matches, setMatches] = useState({ items: [], pagination: null });
  const [buyerContext, setBuyerContext] = useState(null);
  const [tradeModal, setTradeModal] = useState({
    open: false,
    match: null
  });
  const [tradeForm, setTradeForm] = useState(initialTradeState);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeResult, setTradeResult] = useState(null);
  const [paymentOptions, setPaymentOptions] = useState({
    provider: "",
    supportedMethods: []
  });
  const [access, setAccess] = useState(null);
  const toast = useToast();

  useToastOnChange({
    errorMessage: error,
    errorTitle: "Match workflow issue"
  });

  useEffect(() => {
    if (!ready || !session) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        if (session.user.role === "buyer") {
          const [matchData, buyerData] = await Promise.all([
            apiRequest(`/matches?page=${page}&limit=8`, { token: session.token }),
            apiRequest("/buyers/me", { token: session.token })
          ]);
          setMatches(matchData);
          setAccess(matchData.access || null);
          setBuyerContext(buyerData);
          const methods = await apiRequest(
            `/payments?country=${encodeURIComponent(buyerData.buyer.country)}`
          );
          setPaymentOptions(methods);
        } else if (session.user.role === "exporter") {
          const response = await apiRequest(`/matches?page=${page}&limit=8`, {
            token: session.token
          });
          setMatches(response);
          setAccess(response.access || null);
        } else {
          setMatches({ items: [], pagination: null });
          setAccess(null);
        }
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [page, ready, session]);

  const supportedMethods = useMemo(
    () => paymentOptions.supportedMethods || [],
    [paymentOptions.supportedMethods]
  );

  const openTradeModal = (match) => {
    setTradeResult(null);
    setTradeForm(initialTradeState);
    setTradeModal({
      open: true,
      match
    });
  };

  const handleTradeChange = (event) => {
    const { name, value } = event.target;
    setTradeForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const createTrade = async (event) => {
    event.preventDefault();
    setTradeLoading(true);
    setError("");

    try {
      const transactionResponse = await apiRequest("/transactions", {
        method: "POST",
        token: session.token,
        body: {
          exporterId: tradeModal.match.exporter.id,
          rfqId: tradeModal.match.rfqId,
          amount: Number(tradeForm.amount),
          currency: tradeForm.currency,
          paymentMethod: tradeForm.paymentMethod
        }
      });

      const paymentIntentResponse = await apiRequest(
        `/transactions/${transactionResponse.transaction.id}/payment-intent`,
        {
          method: "POST",
          token: session.token
        }
      );

      setTradeResult({
        transaction: transactionResponse.transaction,
        paymentIntent: paymentIntentResponse.paymentIntent
      });
      toast.success("Secure trade created and payment intent is ready.", {
        title: "Trade initialized"
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setTradeLoading(false);
    }
  };

  if (!ready || !session || loading) {
    return (
      <AppShell
        session={session || { user: { role: "buyer", email: "Loading" } }}
        title="Match center"
        subtitle="Loading ranked match activity."
      >
        <LoadingGrid count={4} />
      </AppShell>
    );
  }

  if (session.user.role === "admin") {
    return (
      <AppShell
        session={session}
        title="Match center"
        subtitle="Marketplace matches live inside buyer and exporter workspaces, while admins steer quality and trust from oversight modules."
      >
        <SectionCard
          eyebrow="Admin"
          title="Use the oversight workspace for marketplace control"
          description="Verification, RFQ review, subscriptions, and analytics are the core admin controls for launch readiness. Match execution stays in role-specific workspaces so the data model remains clean."
        >
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/verification" className="btn-primary">
              Review verification
            </Link>
            <Link href="/admin/rfqs" className="btn-secondary">
              Open RFQ queue
            </Link>
            <Link href="/admin/analytics" className="btn-secondary">
              View marketplace analytics
            </Link>
          </div>
        </SectionCard>
      </AppShell>
    );
  }

  return (
    <AppShell
      session={session}
      title="Match center"
      subtitle="Review ranked buyer and exporter recommendations, then move strong fits into chat, RFQs, and secure trade workflows."
    >
      {error ? <div className="panel p-5 text-sm text-danger">{error}</div> : null}

      {access ? (
        <div className="panel p-5 text-sm text-muted">
          <span className="font-semibold text-primary">{access.planName}</span> plan | Matches
          used this month: {access.usage?.used || 0} / {access.usage?.limitLabel || "Unlimited"}
        </div>
      ) : null}

      <SectionCard
        eyebrow="Matches"
        title="Ranked results"
        description="Every recommendation includes component scores and human-readable reasons so teams understand why a match appeared."
      >
        <div className="space-y-4">
          {matches.items.length ? (
            matches.items.map((match) => (
              <div key={match.id} className="surface-muted p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-primary">
                      {match.exporter?.companyName ||
                        match.buyer?.companyName ||
                        match.rfq?.product}
                    </p>
                    <p className="text-sm text-muted">
                      {session.user.role === "exporter" && match.buyer
                        ? `${match.buyer.country} | ${
                            (match.buyer.importProducts || []).join(", ") ||
                            match.rfq?.product ||
                            "Buyer demand"
                          }`
                        : match.exporter
                        ? `${match.exporter.country} | ${match.exporter.products.join(", ")}`
                        : `${match.rfq?.country} | ${match.rfq?.quantity}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {match.exporter?.status ? (
                      <StatusBadge value={match.exporter.status} />
                    ) : null}
                    <StatusBadge value={formatScore(match.totalScore)} />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.9fr]">
                  <div className="flex flex-wrap gap-2">
                    {match.reasons.map((reason) => (
                      <span
                        key={`${match.id}-${reason}`}
                        className="rounded-full bg-accent/12 px-3 py-1.5 text-xs font-semibold text-success"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="surface-muted p-3 text-sm text-muted">
                      Product: {formatScore(match.productScore)}
                    </div>
                    <div className="surface-muted p-3 text-sm text-muted">
                      Country: {formatScore(match.countryScore)}
                    </div>
                    <div className="surface-muted p-3 text-sm text-muted">
                      Trust: {formatScore(match.trustScore)}
                    </div>
                  </div>
                </div>

                {session.user.role === "buyer" ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      className="btn-primary"
                      onClick={() => openTradeModal(match)}
                      type="button"
                    >
                      Start secure trade
                    </button>
                    {match.exporter?.id ? (
                      <Link
                        className="btn-secondary"
                        href={`/chat?matchId=${encodeURIComponent(match.id)}`}
                      >
                        Open conversation
                      </Link>
                    ) : null}
                    <p className="text-sm text-muted">
                      RFQ: {match.rfq?.product} | Exporter: {match.exporter?.companyName}
                    </p>
                  </div>
                ) : null}

                {session.user.role === "exporter" ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    {match.buyer?.id ? (
                      <Link
                        className="btn-secondary"
                        href={`/chat?matchId=${encodeURIComponent(match.id)}`}
                      >
                        Message buyer
                      </Link>
                    ) : null}
                    <Link className="btn-secondary" href="/rfqs">
                      Review RFQ workspace
                    </Link>
                    <p className="text-sm text-muted">
                      Buyer: {match.buyer?.companyName || "Unassigned"} | RFQ:{" "}
                      {match.rfq?.product}
                    </p>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState
              title="No matches available"
              description="The matching engine has not surfaced any ranked results for the current role and filters yet."
            />
          )}
        </div>

        <PaginationControls pagination={matches.pagination} onPageChange={setPage} />
      </SectionCard>

      <ActionModal
        description="This creates the trade transaction, selects the right provider by buyer country, and opens the payment intent or order details."
        onClose={() => setTradeModal({ open: false, match: null })}
        open={tradeModal.open}
        title="Start secure trade"
      >
        {tradeResult ? (
          <div className="space-y-4">
            <div className="surface-muted p-5">
              <p className="text-sm font-semibold text-primary">Transaction created</p>
              <p className="mt-2 text-sm text-muted">
                Provider: {tradeResult.transaction.provider} | Status:{" "}
                {tradeResult.transaction.status}
              </p>
              <p className="mt-2 text-sm text-muted">
                Amount: {formatCurrency(tradeResult.transaction.amount, tradeResult.transaction.currency)}
              </p>
            </div>
            <div className="surface-muted p-5">
              <p className="text-sm font-semibold text-primary">Payment intent ready</p>
              <p className="mt-2 text-sm text-muted">
                Methods: {tradeResult.paymentIntent.supportedMethods.join(", ")}
              </p>
              <p className="mt-2 text-sm text-muted">
                Reference: {tradeResult.paymentIntent.providerReference || "Generated"}
              </p>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={createTrade}>
            <div className="surface-muted p-4">
              <p className="text-sm font-semibold text-primary">
                {tradeModal.match?.exporter?.companyName}
              </p>
              <p className="mt-2 text-sm text-muted">
                Provider: {paymentOptions.provider || "Resolving"} | Supported methods:{" "}
                {supportedMethods.join(", ")}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Trade amount"
                name="amount"
                onChange={handleTradeChange}
                placeholder="5000"
                required
                type="number"
                value={tradeForm.amount}
              />
              <div>
                <label className="label" htmlFor="currency">
                  Currency
                </label>
                <select
                  id="currency"
                  name="currency"
                  className="field"
                  onChange={handleTradeChange}
                  value={tradeForm.currency}
                >
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="paymentMethod">
                Payment method
              </label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                className="field"
                onChange={handleTradeChange}
                value={tradeForm.paymentMethod}
              >
                {supportedMethods.map((method) => (
                  <option key={method} value={method}>
                    {method.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary w-full" disabled={tradeLoading} type="submit">
              {tradeLoading ? "Creating transaction..." : "Create transaction"}
            </button>
          </form>
        )}
      </ActionModal>
    </AppShell>
  );
}
