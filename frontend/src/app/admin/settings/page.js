"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import LoadingGrid from "@/components/common/LoadingGrid";
import AdminStateBanner from "@/components/admin/AdminStateBanner";
import SectionCard from "@/components/SectionCard";
import { useAdminContext } from "@/components/admin/AdminLayoutClient";
import { useAdminFetch } from "@/components/admin/useAdminFetch";
import { apiRequest } from "@/lib/api";

const PricingManager = dynamic(() => import("@/components/admin/PricingManager"), {
  ssr: false,
  loading: () => <div className="surface-muted h-80 animate-pulse rounded-[28px]" />
});

const createInitialForm = () => ({
  heroTitle: "",
  heroSubtitle: "",
  announcement: "",
  supportEmail: "",
  maintenanceMode: false,
  allowNewRegistrations: true,
  featuredExporterIds: []
});

export default function AdminSettingsPage() {
  const { session, canManageCore } = useAdminContext();
  const { data, loading, error, reload } = useAdminFetch("/admin/settings");
  const [form, setForm] = useState(createInitialForm());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!data?.settings) {
      return;
    }

    setForm({
      heroTitle: data.settings.homepage?.heroTitle || "",
      heroSubtitle: data.settings.homepage?.heroSubtitle || "",
      announcement: data.settings.homepage?.announcement || "",
      supportEmail: data.settings.platform?.supportEmail || "",
      maintenanceMode: Boolean(data.settings.platform?.maintenanceMode),
      allowNewRegistrations:
        data.settings.platform?.allowNewRegistrations !== false,
      featuredExporterIds: data.settings.featuredExporterIds || []
    });
  }, [data?.settings]);

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  };

  const toggleFeaturedExporter = (exporterId) => {
    setForm((current) => ({
      ...current,
      featuredExporterIds: current.featuredExporterIds.includes(exporterId)
        ? current.featuredExporterIds.filter((item) => item !== exporterId)
        : [...current.featuredExporterIds, exporterId]
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!canManageCore) {
      return;
    }

    setSaving(true);
    setNotice("");
    setActionError("");

    try {
      const response = await apiRequest("/admin/settings", {
        method: "PATCH",
        token: session.token,
        body: {
          homepage: {
            heroTitle: form.heroTitle,
            heroSubtitle: form.heroSubtitle,
            announcement: form.announcement
          },
          platform: {
            supportEmail: form.supportEmail,
            maintenanceMode: form.maintenanceMode,
            allowNewRegistrations: form.allowNewRegistrations
          },
          featuredExporterIds: form.featuredExporterIds
        }
      });

      setNotice(response.message);
      await reload();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const featuredExporterOptions = data?.featuredExporterOptions || [];

  return (
    <>
      <AdminStateBanner actionLabel="Retry" message={error || actionError} onAction={reload} />
      <AdminStateBanner message={notice} tone="success" />
      {!canManageCore ? (
        <AdminStateBanner
          message="Super Admin approval is required to change platform settings or pricing. You still have read-only visibility into the current configuration."
          tone="info"
        />
      ) : null}

      {loading ? (
        <LoadingGrid count={3} />
      ) : (
        <form className="space-y-6" onSubmit={handleSave}>
          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard
              eyebrow="Platform"
              title="Operational controls"
              description="Keep support details and registration posture in one place so ops decisions stay clear and reversible."
            >
              <div className="grid gap-4">
                <div>
                  <label className="label" htmlFor="supportEmail">
                    Support email
                  </label>
                  <input
                    id="supportEmail"
                    className="field"
                    disabled={!canManageCore}
                    onChange={(event) => handleChange("supportEmail", event.target.value)}
                    value={form.supportEmail}
                  />
                </div>

                <div className="grid gap-3">
                  <label className="surface-muted flex items-center gap-3 px-4 py-3 text-sm text-primary">
                    <input
                      checked={form.maintenanceMode}
                      className="h-4 w-4"
                      disabled={!canManageCore}
                      onChange={(event) =>
                        handleChange("maintenanceMode", event.target.checked)
                      }
                      type="checkbox"
                    />
                    Maintenance mode enabled
                  </label>

                  <label className="surface-muted flex items-center gap-3 px-4 py-3 text-sm text-primary">
                    <input
                      checked={form.allowNewRegistrations}
                      className="h-4 w-4"
                      disabled={!canManageCore}
                      onChange={(event) =>
                        handleChange("allowNewRegistrations", event.target.checked)
                      }
                      type="checkbox"
                    />
                    Allow new registrations
                  </label>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Homepage"
              title="Public messaging"
              description="Marketing copy lives here so leadership can adjust the top-of-funnel message without touching code again."
            >
              <div className="grid gap-4">
                <div>
                  <label className="label" htmlFor="heroTitle">
                    Hero title
                  </label>
                  <input
                    id="heroTitle"
                    className="field"
                    disabled={!canManageCore}
                    onChange={(event) => handleChange("heroTitle", event.target.value)}
                    value={form.heroTitle}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="heroSubtitle">
                    Hero subtitle
                  </label>
                  <textarea
                    id="heroSubtitle"
                    className="field min-h-[110px]"
                    disabled={!canManageCore}
                    onChange={(event) => handleChange("heroSubtitle", event.target.value)}
                    value={form.heroSubtitle}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="announcement">
                    Announcement
                  </label>
                  <textarea
                    id="announcement"
                    className="field min-h-[96px]"
                    disabled={!canManageCore}
                    onChange={(event) => handleChange("announcement", event.target.value)}
                    placeholder="Optional banner announcement for the homepage."
                    value={form.announcement}
                  />
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            eyebrow="Featured Exporters"
            title="Homepage highlights"
            description="Pin high-trust exporters to the public marketing surface without over-fetching the full exporter directory."
          >
            {featuredExporterOptions.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {featuredExporterOptions.map((exporter) => (
                  <label
                    key={exporter.id}
                    className="surface-muted flex items-start gap-3 px-4 py-4 text-sm text-primary"
                  >
                    <input
                      checked={form.featuredExporterIds.includes(exporter.id)}
                      className="mt-1 h-4 w-4"
                      disabled={!canManageCore}
                      onChange={() => toggleFeaturedExporter(exporter.id)}
                      type="checkbox"
                    />
                    <div>
                      <p className="font-semibold text-ink">{exporter.companyName}</p>
                      <p className="mt-1 text-xs text-muted">
                        {exporter.country} | {exporter.status}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">
                Featured exporter candidates will appear here after approved exporters are available.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="btn-primary" disabled={!canManageCore || saving} type="submit">
                {saving ? "Saving..." : "Save settings"}
              </button>
              <button className="btn-secondary" onClick={reload} type="button">
                Refresh
              </button>
            </div>
          </SectionCard>
        </form>
      )}

      <div className="pt-2">
        {canManageCore ? (
          <PricingManager token={session.token} />
        ) : (
          <SectionCard
            eyebrow="Plans"
            title="Subscription catalog"
            description="Plan editing stays restricted to Super Admins so revenue controls remain tightly governed."
          >
            <p className="text-sm leading-7 text-muted">
              You can review live pricing on the public billing pages, but create, edit, and retire
              actions are only enabled for Super Admin users.
            </p>
          </SectionCard>
        )}
      </div>
    </>
  );
}
