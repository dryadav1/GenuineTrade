const styles = {
  none: "bg-slate-100 text-slate-700",
  trusted: "bg-primary/12 text-primary",
  top_supplier: "bg-primary text-white",
  New: "bg-slate-100 text-slate-700",
  Verified: "bg-accent/15 text-success",
  "Top Supplier": "bg-primary/12 text-primary",
  pending: "bg-slate-100 text-slate-700",
  approved: "bg-accent/15 text-success",
  rejected: "bg-red-100 text-danger",
  uploaded: "bg-sky-100 text-sky-700",
  submitted: "bg-slate-100 text-slate-700",
  under_review: "bg-amber-100 text-warning",
  documents_requested: "bg-orange-100 text-orange-700",
  changes_requested: "bg-orange-100 text-orange-700",
  verified: "bg-accent/15 text-success",
  missing: "bg-slate-100 text-slate-700",
  ready: "bg-primary/12 text-primary",
  active: "bg-accent/15 text-success",
  inactive: "bg-slate-100 text-slate-700",
  cancelled: "bg-red-100 text-danger",
  paid: "bg-accent/15 text-success",
  failed: "bg-red-100 text-danger",
  pending_release: "bg-amber-100 text-warning",
  in_escrow: "bg-primary/12 text-primary",
  released: "bg-accent/15 text-success",
  disputed: "bg-red-100 text-danger",
  valid: "bg-accent/15 text-success",
  invalid: "bg-red-100 text-danger",
  not_applicable: "bg-slate-100 text-slate-700",
  "not verified": "bg-slate-100 text-slate-700",
  "phone verified": "bg-accent/15 text-success"
};

export default function StatusBadge({ value }) {
  const label =
    typeof value === "string" ? value.replaceAll("_", " ") : `${value}`;
  const normalizedValue = String(value || "").toLowerCase();
  const glowValues = ["verified", "trusted", "top supplier", "active", "phone verified"];
  const hasGlow = glowValues.includes(normalizedValue);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-current/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] shadow-sm ${
        styles[value] || "bg-primary/10 text-primary"
      } ${hasGlow ? "verified-glow" : ""}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${hasGlow ? "bg-current notification-dot" : "bg-current/50"}`} />
      {label}
    </span>
  );
}
