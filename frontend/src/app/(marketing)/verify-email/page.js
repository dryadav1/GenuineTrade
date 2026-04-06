"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingFrame from "@/components/onboarding/OnboardingFrame";
import StatusBadge from "@/components/StatusBadge";
import { getDashboardPath, getSession } from "@/lib/session";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);

  useEffect(() => {
    setSession(getSession());
  }, []);

  const user = session?.user || null;
  const primaryHref = useMemo(() => {
    if (!user) {
      return "/login";
    }

    if (!user.profileCompleted && user.role !== "admin") {
      return "/complete-profile";
    }

    return getDashboardPath(user);
  }, [user]);

  return (
    <OnboardingFrame
      eyebrow="Account status"
      title="Verification and access stay inside the onboarding workspace."
      description="GenuineTrade now keeps account readiness inside the main signup, login, and complete-profile flow so users do not get stuck on dead-end verification screens."
      asideTitle="What to do next"
      asideBody="If you already created an account, continue the onboarding flow or return to your dashboard. If you are new here, create an account and choose your role first."
      compact
      footer={
        <p className="text-sm text-muted">
          Need a fresh start?{" "}
          <Link href="/signup" className="font-semibold text-primary">
            Create a new account
          </Link>
        </p>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/55">
            Workspace readiness
          </p>
          <h2 className="mt-3 text-3xl font-bold text-ink">Continue from the right place</h2>
        </div>
        {user ? (
          <div className="flex flex-wrap gap-2">
            <StatusBadge value={user.status || "pending"} />
            <StatusBadge value={user.badge || "none"} />
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="surface-muted p-5">
          <p className="text-sm font-semibold text-ink">Signup</p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Choose exporter or buyer, create the account, and move directly into onboarding.
          </p>
        </div>
        <div className="surface-muted p-5">
          <p className="text-sm font-semibold text-ink">Complete profile</p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Finish business details, upload documents, and verify your phone before review.
          </p>
        </div>
        <div className="surface-muted p-5">
          <p className="text-sm font-semibold text-ink">Workspace</p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Open the dashboard, pricing, admin controls, or chat after the profile is ready.
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button className="btn-primary" onClick={() => router.push(primaryHref)} type="button">
          {user ? "Continue workspace flow" : "Go to login"}
        </button>
        <Link href="/" className="btn-secondary">
          Back home
        </Link>
      </div>
    </OnboardingFrame>
  );
}
