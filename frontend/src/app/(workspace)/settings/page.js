"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { apiRequest } from "@/lib/api";
import { getRoleLabel } from "@/lib/session";
import { useWorkspaceSession } from "@/lib/workspace";

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-line py-3 text-sm last:border-b-0">
    <span className="text-muted">{label}</span>
    <span className="max-w-[60%] break-words text-right font-medium text-ink">{value}</span>
  </div>
);

const SkeletonPanel = () => (
  <div className="rounded-3xl border border-line bg-white p-6 shadow-panel">
    <div className="h-40 animate-pulse rounded-3xl bg-canvas" />
  </div>
);

const buildHealthSummary = (user) => {
  if (user?.role === "admin") {
    return 100;
  }

  const checks = [
    Boolean(user?.company),
    Boolean(user?.country),
    Boolean(user?.phone),
    Boolean(user?.phoneVerified)
  ];

  if (user?.role === "exporter") {
    checks.push(Boolean(user?.iec), Boolean(user?.gst), Boolean(user?.hsnCode));
  }

  if (user?.role === "buyer") {
    checks.push(Boolean(user?.importId), Boolean(user?.requirement));
  }

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
};

export default function SettingsPage() {
  const { session, ready, logout, updateSessionUser } = useWorkspaceSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready || !session) {
      return;
    }

    if (session.user.role === "admin") {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const data = await apiRequest("/profile", {
          token: session.token
        });
        updateSessionUser(data.user);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [ready, session, session?.token, updateSessionUser]);

  const user = session?.user;
  const accountHealth = useMemo(() => buildHealthSummary(user), [user]);
  const notificationCount = useMemo(() => {
    if (!user) {
      return 0;
    }

    return Number(user.status !== "verified") + Number(!user.phoneVerified);
  }, [user]);

  if (!ready || !session || loading) {
    return (
      <WorkspaceShell
        description="Loading workspace preferences, trust settings, and account access controls."
        notificationCount={0}
        onLogout={() => {}}
        session={{
          user: {
            email: "loading@genuinetrade.com",
            name: "Loading",
            role: "buyer",
            status: "pending",
            badge: "none"
          }
        }}
        title="Preparing your settings workspace"
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <SkeletonPanel />
          <SkeletonPanel />
        </div>
        <SkeletonPanel />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell
      actions={
        <>
          <Link href="/complete-profile" className="btn-primary">
            Update onboarding
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Back to dashboard
          </Link>
        </>
      }
      description="Manage trust readiness, profile operations, and workspace access from one controlled surface."
      notificationCount={notificationCount}
      onLogout={logout}
      session={session}
      title="Workspace settings"
    >
      {error ? (
        <div className="rounded-3xl border border-danger/20 bg-danger/10 px-5 py-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-line bg-white p-6 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
            Account Controls
          </p>
          <h2 className="mt-3 text-2xl font-bold text-ink">Identity and access</h2>

          <div className="mt-6 space-y-1">
            <DetailRow label="Full name" value={user?.name || "Not provided"} />
            <DetailRow label="Email" value={user?.email || "Not provided"} />
            <DetailRow label="Role" value={getRoleLabel(user)} />
            <DetailRow label="Company" value={user?.company || "Not provided"} />
            <DetailRow label="Country" value={user?.country || "Not provided"} />
            <DetailRow label="Phone" value={user?.phone || "Not provided"} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <StatusBadge value={user?.status || "pending"} />
            <StatusBadge value={user?.badge || "none"} />
            <StatusBadge value={user?.phoneVerified ? "phone verified" : "not verified"} />
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-white p-6 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
            Workspace Health
          </p>
          <h2 className="mt-3 text-2xl font-bold text-ink">Readiness overview</h2>

          <div className="mt-6 rounded-3xl border border-primary/10 bg-primary/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Account health score</p>
                <p className="mt-2 text-3xl font-bold text-ink">{accountHealth}%</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm">
                {user?.status === "verified" ? "Verified account" : "Verification in progress"}
              </div>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${accountHealth}%` }}
              />
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <div className="rounded-3xl border border-line bg-canvas/80 p-4">
              <p className="text-sm font-semibold text-ink">Verification workflow</p>
              <p className="mt-2 text-sm leading-7 text-muted">
                {user?.status === "verified"
                  ? "Your workspace is ready for full marketplace participation and trust visibility."
                  : "Complete onboarding fields and document uploads to move your account into manual review."}
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-canvas/80 p-4">
              <p className="text-sm font-semibold text-ink">Notification posture</p>
              <p className="mt-2 text-sm leading-7 text-muted">
                Email, phone verification, and trust alerts are surfaced through your onboarding and dashboard workflow. Advanced per-channel controls can be added next without changing the current data model.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-line bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
              Action Center
            </p>
            <h2 className="mt-3 text-2xl font-bold text-ink">Operational next steps</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Keep the workspace lean and trustworthy by maintaining onboarding accuracy, keeping your phone verified, and reviewing dashboard notifications regularly.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
            <Link
              href="/complete-profile"
              className="rounded-3xl border border-line bg-canvas/80 px-4 py-4 text-sm font-semibold text-ink transition duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:text-primary"
            >
              Edit company profile
            </Link>
            <Link
              href="/dashboard#rfq-queue"
              className="rounded-3xl border border-line bg-canvas/80 px-4 py-4 text-sm font-semibold text-ink transition duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:text-primary"
            >
              Review RFQ queue
            </Link>
            <button
              className="rounded-3xl border border-line bg-canvas/80 px-4 py-4 text-left text-sm font-semibold text-danger transition duration-200 hover:-translate-y-0.5 hover:border-danger/20"
              onClick={logout}
              type="button"
            >
              Sign out securely
            </button>
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}
