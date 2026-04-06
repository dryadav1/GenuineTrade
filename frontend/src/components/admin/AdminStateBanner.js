"use client";

const toneStyles = {
  error: "border-danger/20 bg-danger/10 text-danger",
  info: "border-primary/10 bg-primary/5 text-primary",
  success: "border-success/20 bg-success/10 text-success"
};

export default function AdminStateBanner({
  message,
  tone = "error",
  actionLabel = "",
  onAction = null
}) {
  if (!message) {
    return null;
  }

  return (
    <div
      className={`rounded-[28px] border px-5 py-4 text-sm ${toneStyles[tone] || toneStyles.error}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {actionLabel && onAction ? (
          <button className="btn-secondary px-4 py-2" onClick={onAction} type="button">
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
