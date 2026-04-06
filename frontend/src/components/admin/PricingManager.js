"use client";

import { useEffect, useState } from "react";
import ActionModal from "@/components/common/ActionModal";
import StatusBadge from "@/components/StatusBadge";
import { useToastOnChange } from "@/components/feedback/ToastProvider";
import { parseFeatureLines } from "@/lib/billing";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

const createEmptyForm = () => ({
  planCode: "",
  name: "",
  description: "",
  featuresText: "",
  monthlyPrice: "",
  yearlyPrice: "",
  currency: "USD",
  isActive: true,
  isPopular: false
});

const mapPlanToForm = (plan) => ({
  planCode: plan.planCode || "",
  name: plan.name || "",
  description: plan.description || "",
  featuresText: (plan.features || []).join("\n"),
  monthlyPrice: plan.monthly?.price ?? "",
  yearlyPrice: plan.yearly?.price ?? "",
  currency: plan.monthly?.currency || plan.yearly?.currency || "USD",
  isActive: Boolean(plan.isActive),
  isPopular: Boolean(plan.isPopular)
});

export default function PricingManager({ token }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlanCode, setEditingPlanCode] = useState("");
  const [form, setForm] = useState(createEmptyForm());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useToastOnChange({
    errorMessage: error,
    successMessage: notice,
    errorTitle: "Pricing action failed",
    successTitle: "Pricing updated"
  });

  const loadPlans = async () => {
    if (!token) {
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest("/admin/plans", {
        token
      });
      setPlans(response.items || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, [token]);

  const openCreateModal = () => {
    setEditingPlanCode("");
    setForm(createEmptyForm());
    setNotice("");
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (plan) => {
    setEditingPlanCode(plan.planCode);
    setForm(mapPlanToForm(plan));
    setNotice("");
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPlanCode("");
    setForm(createEmptyForm());
  };

  const handleFormChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const body = {
        planCode: form.planCode,
        name: form.name,
        description: form.description,
        features: parseFeatureLines(form.featuresText),
        monthlyPrice: Number(form.monthlyPrice),
        yearlyPrice: Number(form.yearlyPrice),
        currency: form.currency,
        isActive: form.isActive,
        isPopular: form.isPopular
      };
      const isEditing = Boolean(editingPlanCode);
      const response = await apiRequest(
        isEditing ? `/admin/plans/${editingPlanCode}` : "/admin/plans",
        {
          method: isEditing ? "PATCH" : "POST",
          token,
          body
        }
      );

      setNotice(response.message);
      closeModal();
      await loadPlans();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (planCode) => {
    const confirmed = window.confirm(
      `Delete the ${planCode} plan? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await apiRequest(`/admin/plans/${planCode}`, {
        method: "DELETE",
        token
      });
      setNotice(response.message);
      await loadPlans();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <section id="pricing-controls" className="space-y-4">
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-white p-6 shadow-panel lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/45">
            Pricing Control
          </p>
          <h2 className="mt-3 text-2xl font-bold text-ink">Admin plan management</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
            Create new plans, edit pricing and features, mark plans as active or inactive,
            and retire plans that are no longer offered.
          </p>
        </div>

        <button className="btn-primary" onClick={openCreateModal} type="button">
          Create plan
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary">
          {notice}
        </div>
      ) : null}

      <div className="table-wrap">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line text-left">
            <thead className="bg-canvas">
              <tr className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/55">
                <th className="px-5 py-4">Plan</th>
                <th className="px-5 py-4">Monthly</th>
                <th className="px-5 py-4">Yearly</th>
                <th className="px-5 py-4">Features</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-white">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`plan-loading-${index}`}>
                    {Array.from({ length: 6 }).map((__, cellIndex) => (
                      <td key={`plan-loading-${index}-${cellIndex}`} className="px-5 py-4">
                        <div className="h-10 animate-pulse rounded-2xl bg-canvas" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : plans.length ? (
                plans.map((plan) => (
                  <tr key={plan.planCode} className="align-top">
                    <td className="px-5 py-5">
                      <p className="font-semibold text-ink">{plan.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary/45">
                        {plan.planCode}
                      </p>
                      {plan.description ? (
                        <p className="mt-2 max-w-xs text-sm text-muted">{plan.description}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-5 text-sm text-muted">
                      {formatCurrency(plan.monthly?.price || 0, plan.monthly?.currency || "USD")}
                    </td>
                    <td className="px-5 py-5 text-sm text-muted">
                      {formatCurrency(plan.yearly?.price || 0, plan.yearly?.currency || "USD")}
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex max-w-md flex-wrap gap-2">
                        {(plan.features || []).slice(0, 4).map((feature) => (
                          <span
                            key={`${plan.planCode}-${feature}`}
                            className="rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge value={plan.isActive ? "active" : "inactive"} />
                        {plan.isPopular ? <StatusBadge value="most popular" /> : null}
                      </div>
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-secondary"
                          onClick={() => openEditModal(plan)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger transition hover:-translate-y-0.5"
                          onClick={() => handleDelete(plan.planCode)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-8 text-sm text-muted" colSpan={6}>
                    No pricing plans available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ActionModal
        description="Update both monthly and yearly pricing from one modal so the public pricing page stays synchronized."
        onClose={closeModal}
        open={modalOpen}
        title={editingPlanCode ? "Edit plan" : "Create plan"}
      >
        <form className="space-y-4" onSubmit={handleSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="planCode">
                Plan code
              </label>
              <input
                id="planCode"
                className="field"
                disabled={Boolean(editingPlanCode)}
                onChange={(event) => handleFormChange("planCode", event.target.value)}
                placeholder="growth-plus"
                value={form.planCode}
              />
            </div>
            <div>
              <label className="label" htmlFor="planName">
                Name
              </label>
              <input
                id="planName"
                className="field"
                onChange={(event) => handleFormChange("name", event.target.value)}
                placeholder="Growth Plus"
                value={form.name}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              className="field min-h-[110px]"
              onChange={(event) => handleFormChange("description", event.target.value)}
              placeholder="Best for teams handling higher RFQ volume."
              value={form.description}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="monthlyPrice">
                Monthly price
              </label>
              <input
                id="monthlyPrice"
                className="field"
                min="0"
                onChange={(event) => handleFormChange("monthlyPrice", event.target.value)}
                step="0.01"
                type="number"
                value={form.monthlyPrice}
              />
            </div>
            <div>
              <label className="label" htmlFor="yearlyPrice">
                Yearly price
              </label>
              <input
                id="yearlyPrice"
                className="field"
                min="0"
                onChange={(event) => handleFormChange("yearlyPrice", event.target.value)}
                step="0.01"
                type="number"
                value={form.yearlyPrice}
              />
            </div>
            <div>
              <label className="label" htmlFor="currency">
                Currency
              </label>
              <select
                id="currency"
                className="field"
                onChange={(event) => handleFormChange("currency", event.target.value)}
                value={form.currency}
              >
                <option value="USD">USD</option>
                <option value="INR">INR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="featuresText">
              Features
            </label>
            <textarea
              id="featuresText"
              className="field min-h-[140px]"
              onChange={(event) => handleFormChange("featuresText", event.target.value)}
              placeholder={"Unlimited RFQs\nPremium support\nAdvanced analytics"}
              value={form.featuresText}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="surface-muted flex items-center gap-3 px-4 py-3 text-sm text-primary">
              <input
                checked={form.isActive}
                className="h-4 w-4"
                onChange={(event) => handleFormChange("isActive", event.target.checked)}
                type="checkbox"
              />
              Plan is active
            </label>
            <label className="surface-muted flex items-center gap-3 px-4 py-3 text-sm text-primary">
              <input
                checked={form.isPopular}
                className="h-4 w-4"
                onChange={(event) => handleFormChange("isPopular", event.target.checked)}
                type="checkbox"
              />
              Mark as most popular
            </label>
          </div>

          <button className="btn-primary w-full" disabled={saving} type="submit">
            {saving ? "Saving..." : editingPlanCode ? "Save changes" : "Create plan"}
          </button>
        </form>
      </ActionModal>
    </section>
  );
}
