"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import SkeletonBlock from "@/components/common/SkeletonBlock";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { API_ORIGIN, apiRequest } from "@/lib/api";
import { formatPlanCode } from "@/lib/billing";
import { getRoleLabel } from "@/lib/session";
import { hoverLift, staggerItem } from "@/lib/motion";
import { useWorkspaceSession } from "@/lib/workspace";

const splitItems = (value = "") =>
  String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const renderValue = (value, fallback = "Not provided") => value || fallback;

const resolveAssetUrl = (value) => {
  if (!value) {
    return "";
  }

  if (value.startsWith("http")) {
    return value;
  }

  return `${API_ORIGIN}${value}`;
};

const dashboardCardIconClass = "h-6 w-6";

const DashboardIcon = ({ name, className = dashboardCardIconClass }) => {
  const props = {
    className,
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: "1.8",
    viewBox: "0 0 24 24"
  };

  switch (name) {
    case "rfq":
      return (
        <svg {...props}>
          <path d="M7 4h10" />
          <path d="M7 8h10" />
          <path d="M5 12h14" />
          <path d="M5 16h8" />
        </svg>
      );
    case "deal":
      return (
        <svg {...props}>
          <path d="m8 12 3 3 5-6" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "message":
      return (
        <svg {...props}>
          <path d="M7 10h10" />
          <path d="M7 14h6" />
          <path d="M21 12c0 4.418-4.03 8-9 8a10.88 10.88 0 0 1-4-.74L3 20l1.14-3.42A7.4 7.4 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
        </svg>
      );
    case "progress":
      return (
        <svg {...props}>
          <path d="M5 19V9" />
          <path d="M12 19V5" />
          <path d="M19 19v-8" />
        </svg>
      );
    case "verification":
      return (
        <svg {...props}>
          <path d="m9 12 2 2 4-5" />
          <path d="M12 3 4 7v6c0 5 3.4 7.74 8 9 4.6-1.26 8-4 8-9V7l-8-4Z" />
        </svg>
      );
    default:
      return null;
  }
};

const StatCard = ({ icon, label, value, detail }) => {
  const isNumericValue =
    typeof value === "number" ||
    (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.replace(/,/g, "").trim()));

  return (
    <motion.div
      {...hoverLift}
      className="metric-card rounded-[28px] p-5"
      initial="initial"
      viewport={{ once: true, amount: 0.25 }}
      whileInView="animate"
      variants={staggerItem}
    >
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
          {label}
        </p>
        <p className="mt-4 text-3xl font-bold text-ink">
          {isNumericValue ? <AnimatedCounter value={Number(value)} /> : value}
        </p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
        <DashboardIcon name={icon} />
      </div>
    </div>
    <p className="mt-3 text-sm leading-6 text-muted">{detail}</p>
    </motion.div>
  );
};

const DetailRow = ({ label, value }) => (
  <div className="flex items-center justify-between gap-4 border-b border-line py-3 text-sm">
    <span className="text-muted">{label}</span>
    <span className="max-w-[60%] break-words text-right font-medium text-ink">{value}</span>
  </div>
);

const SkeletonCard = () => (
  <div className="rounded-[28px] border border-line bg-white p-5 shadow-panel">
    <SkeletonBlock className="h-4 w-24 rounded-full" />
    <SkeletonBlock className="mt-4 h-8 w-32 rounded-full" />
    <SkeletonBlock className="mt-5 h-20 rounded-2xl" />
  </div>
);

const buildRfqRows = (user) => {
  const productList = splitItems(user?.productCategory || user?.requirement || "")
    .slice(0, 3);

  if (user?.role === "buyer") {
    return productList.length
      ? productList.map((product, index) => ({
          id: `supplier-${index + 1}`,
          counterpart: ["GoldenHarvest Exports", "BlueRiver Commodities", "Apex Agro Foods"][index] || `Supplier ${index + 1}`,
          product,
          quantity: ["1 container", "25 MT", "12 MT"][index] || "10 MT",
          status: ["Matched", "Pending", "Under Review"][index] || "Pending"
        }))
      : [
          {
            id: "supplier-1",
            counterpart: "GoldenHarvest Exports",
            product: "Product requirement pending",
            quantity: "1 container",
            status: "Pending"
          }
        ];
  }

  return productList.length
    ? productList.map((product, index) => ({
        id: `buyer-${index + 1}`,
        counterpart: ["Apex Imports Ltd", "Summit Retail Group", "Aurora Foods"][index] || `Buyer ${index + 1}`,
        product,
        quantity: ["25 MT", "1 container", "12 MT"][index] || "10 MT",
        status: ["Pending", "Under Review", "Pending"][index] || "Pending"
      }))
    : [
        {
          id: "buyer-1",
          counterpart: "Apex Imports Ltd",
          product: "Product submission pending",
          quantity: "25 MT",
          status: "Pending"
        }
      ];
};

const buildMessageRows = (user) => {
  const subject = user?.productName || splitItems(user?.productCategory || user?.requirement || "")[0] || "your catalog";
  return [
    {
      id: "msg-1",
      sender: user?.role === "buyer" ? "GoldenHarvest Exports" : "Apex Imports Ltd",
      preview: `We reviewed ${subject} and need pricing confirmation.`,
      time: "2h ago"
    },
    {
      id: "msg-2",
      sender: user?.role === "buyer" ? "BlueRiver Commodities" : "Summit Retail Group",
      preview: "Can we align on packaging and shipment readiness?",
      time: "Yesterday"
    }
  ];
};

const buildProfileCompletion = (user) => {
  const checks = [
    { label: "Full name", complete: Boolean(user?.name) },
    { label: "Company name", complete: Boolean(user?.company) },
    { label: "Country", complete: Boolean(user?.country) },
    { label: "Phone", complete: Boolean(user?.phone) },
    { label: "Phone verification", complete: Boolean(user?.phoneVerified) }
  ];

  if (user?.role === "exporter") {
    checks.push(
      { label: "IEC code", complete: Boolean(user?.iec) },
      { label: "GST number", complete: Boolean(user?.gst) },
      { label: "HSN code", complete: Boolean(user?.hsnCode) },
      { label: "Primary product", complete: Boolean(user?.productName) },
      { label: "Products", complete: Boolean(user?.productCategory) },
      { label: "IEC certificate", complete: Boolean(user?.documents?.iecFile) },
      { label: "GST certificate", complete: Boolean(user?.documents?.gstFile) },
      { label: "Product images", complete: Boolean(user?.documents?.productImages?.length) }
    );
  } else {
    checks.push(
      { label: "Business ID", complete: Boolean(user?.importId) },
      { label: "Product requirement", complete: Boolean(user?.requirement) }
    );
  }

  const completed = checks.filter((item) => item.complete).length;
  const percentage = Math.round((completed / checks.length) * 100);

  return {
    percentage,
    missingFields: checks.filter((item) => !item.complete).map((item) => item.label)
  };
};

export default function DashboardPage() {
  const router = useRouter();
  const { session, ready, logout, updateSessionUser } = useWorkspaceSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rfqRows, setRfqRows] = useState([]);

  useEffect(() => {
    if (!ready || !session) {
      return;
    }

    if (session.user.role === "admin") {
      router.replace("/admin");
      return;
    }

    const loadProfile = async () => {
      try {
        const data = await apiRequest("/profile", {
          token: session.token
        });
        updateSessionUser(data.user);
        setRfqRows(buildRfqRows(data.user));
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [ready, router, session?.token, session?.user?.role, updateSessionUser]);

  const user = session?.user;
  const documents = user?.documents || {};
  const profileProgress = useMemo(() => buildProfileCompletion(user), [user]);
  const messageRows = useMemo(() => buildMessageRows(user), [user]);
  const premiumAccess = useMemo(
    () =>
      Boolean(user?.subscriptionPlan && user.subscriptionPlan !== "free") &&
      (!user?.planExpiry || new Date(user.planExpiry).getTime() > Date.now()),
    [user?.planExpiry, user?.subscriptionPlan]
  );
  const notificationCount = useMemo(() => {
    const statusAlerts = user?.status === "pending" ? 1 : 0;
    return statusAlerts + profileProgress.missingFields.length + messageRows.length;
  }, [messageRows.length, profileProgress.missingFields.length, user?.status]);

  const verificationMessage = useMemo(() => {
    if (!user) {
      return "";
    }

    if (!user.profileCompleted || profileProgress.percentage < 100) {
      return "Complete your profile to get verified and unlock the full marketplace.";
    }

    if (user.status === "pending") {
      return "Your profile is under review. Trust checks are currently in progress.";
    }

    if (user.status === "rejected") {
      return "Your profile needs updates before verification can continue.";
    }

    return "Your profile is verified. You’re ready for full buyer and supplier activity.";
  }, [profileProgress.percentage, user]);

  const handleRfqAction = (rowId, nextStatus) => {
    setRfqRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, status: nextStatus } : row
      )
    );
  };

  if (!ready || !session || loading) {
    return (
      <WorkspaceShell
        description="Loading workspace performance, verification, and RFQ pipeline."
        notificationCount={0}
        onLogout={() => {}}
        session={{ user: { email: "loading@genuinetrade.com", name: "Loading", role: "buyer", status: "pending", badge: "none" } }}
        title="Preparing your enterprise dashboard"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl bg-white p-6 shadow-panel">
            <div className="h-72 animate-pulse rounded-2xl bg-canvas" />
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-panel">
            <div className="h-72 animate-pulse rounded-2xl bg-canvas" />
          </div>
        </div>
      </WorkspaceShell>
    );
  }

  const totalRfqs = rfqRows.length;
  const activeDeals = rfqRows.filter((row) => row.status === "Accepted").length;
  const counterpartLabel = user.role === "buyer" ? "Supplier Name" : "Buyer Name";

  return (
    <WorkspaceShell
      actions={
        <>
          <Link href="/complete-profile" className="btn-primary">
            {user.profileCompleted ? "Edit profile" : "Complete profile"}
          </Link>
          <Link href="/settings" className="btn-secondary">
            Open settings
          </Link>
        </>
      }
      description="A premium operations cockpit for onboarding, verification, deal readiness, and trust progress."
      notificationCount={notificationCount}
      onLogout={logout}
      session={session}
      title="Enterprise dashboard"
    >
      {error ? (
        <div className="rounded-3xl border border-danger/20 bg-danger/10 px-5 py-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          detail="Requests currently routed to your dashboard pipeline."
          icon="rfq"
          label="Total RFQs"
          value={totalRfqs}
        />
        <StatCard
          detail="Accepted opportunities moved into active engagement."
          icon="deal"
          label="Active Deals"
          value={activeDeals}
        />
        <StatCard
          detail="Conversation threads requiring follow-up or review."
          icon="message"
          label="Chat"
          value={messageRows.length}
        />
        <StatCard
          detail="Based on required fields, documents, and phone verification."
          icon="progress"
          label="Profile Completion"
          value={`${profileProgress.percentage}%`}
        />
      </div>

      <section className="rounded-3xl border border-line bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
              Subscription
            </p>
            <h2 className="mt-3 text-2xl font-bold text-ink">Active plan visibility</h2>
            <p className="mt-2 text-sm leading-7 text-muted">
              Your current subscription controls premium RFQ access, analytics, and
              discovery priority across the workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/pricing" className="btn-primary">
              Upgrade
            </Link>
            {premiumAccess ? (
              <Link href="/pricing?manage=subscription" className="btn-secondary">
                Downgrade
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="surface-muted p-5">
            <p className="text-sm text-muted">Current plan</p>
            <p className="mt-2 text-2xl font-bold text-primary">
              {formatPlanCode(user?.subscriptionPlan || "free")}
            </p>
          </div>
          <div className="surface-muted p-5">
            <p className="text-sm text-muted">Access level</p>
            <p className="mt-2 text-2xl font-bold text-primary">
              {premiumAccess ? "Premium" : "Free"}
            </p>
          </div>
          <div className="surface-muted p-5">
            <p className="text-sm text-muted">Plan expiry</p>
            <p className="mt-2 text-2xl font-bold text-primary">
              {user?.planExpiry ? new Date(user.planExpiry).toLocaleDateString("en-IN") : "No expiry"}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-line bg-white p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                Verification Status
              </p>
              <h2 className="mt-3 text-2xl font-bold text-ink">Trust and onboarding</h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 text-primary">
              <DashboardIcon name="verification" />
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-primary/10 bg-primary/5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Current status</p>
                <p className="mt-2 text-2xl font-bold capitalize text-ink">{user.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge value={user.status || "pending"} />
                <StatusBadge value={user.badge || "none"} />
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-muted">{verificationMessage}</p>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-ink">Verification readiness</span>
              <span className="font-semibold text-primary">{profileProgress.percentage}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-canvas">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                style={{ width: `${profileProgress.percentage}%` }}
              />
            </div>
            <p className="mt-4 text-sm leading-7 text-muted">
              Complete your profile to get verified and unlock RFQ acceptance, direct messaging, and stronger trust visibility.
            </p>
          </div>
        </section>

        <section id="profile-progress" className="rounded-3xl border border-line bg-white p-6 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
            Profile Completion
          </p>
          <h2 className="mt-3 text-2xl font-bold text-ink">Progress tracker</h2>

          <div className="mt-6 rounded-3xl border border-line bg-canvas/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Completion score</p>
              <span className="text-lg font-bold text-primary">{profileProgress.percentage}%</span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all duration-500"
                style={{ width: `${profileProgress.percentage}%` }}
              />
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-ink">Missing fields</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profileProgress.missingFields.length ? (
                profileProgress.missingFields.map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-[#0B1F3A]/8 px-3 py-1.5 text-xs font-semibold text-primary"
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-semibold text-success">
                  All required fields completed
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-muted">
            <DetailRow label="Role" value={getRoleLabel(user)} />
            <DetailRow label="Country" value={renderValue(user.country)} />
            <DetailRow label="Phone" value={renderValue(user.phone)} />
            <DetailRow
              label="Phone verification"
              value={user.phoneVerified ? "Verified" : "Pending"}
            />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section id="rfq-queue" className="rounded-3xl border border-line bg-white p-6 shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                RFQ Queue
              </p>
              <h2 className="mt-3 text-2xl font-bold text-ink">Request pipeline</h2>
            </div>
            <StatusBadge value={`${totalRfqs} active`} />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-line text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                  <th className="pb-4 pr-4">{counterpartLabel}</th>
                  <th className="pb-4 pr-4">Product</th>
                  <th className="pb-4 pr-4">Quantity</th>
                  <th className="pb-4 pr-4">Status</th>
                  <th className="pb-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rfqRows.map((row) => (
                  <tr key={row.id} className="border-b border-line/80 last:border-b-0">
                    <td className="py-4 pr-4 text-sm font-medium text-ink">{row.counterpart}</td>
                    <td className="py-4 pr-4 text-sm text-muted">{row.product}</td>
                    <td className="py-4 pr-4 text-sm text-muted">{row.quantity}</td>
                    <td className="py-4 pr-4">
                      <StatusBadge value={String(row.status).toLowerCase().replaceAll(" ", "_")} />
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="inline-flex rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5"
                          onClick={() => handleRfqAction(row.id, "Accepted")}
                          type="button"
                        >
                          Accept
                        </button>
                        <button
                          className="inline-flex rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-danger transition hover:-translate-y-0.5 hover:border-danger/30"
                          onClick={() => handleRfqAction(row.id, "Rejected")}
                          type="button"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="message-center" className="space-y-6">
          <div className="rounded-3xl border border-line bg-white p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
              Message Center
            </p>
            <h2 className="mt-3 text-2xl font-bold text-ink">Recent conversations</h2>
            <div className="mt-6 space-y-4">
              {messageRows.map((message) => (
                <div
                  key={message.id}
                  className="rounded-3xl border border-line bg-canvas/70 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{message.sender}</p>
                    <span className="text-xs text-primary/45">{message.time}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{message.preview}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-line bg-white p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
              Document Center
            </p>
            <h2 className="mt-3 text-2xl font-bold text-ink">Verification assets</h2>
            <div className="mt-6 grid gap-3">
              {user.role === "exporter" ? (
                <>
                  <LinkBox
                    href={documents.iecFile ? resolveAssetUrl(documents.iecFile) : ""}
                    label="IEC Certificate"
                    ready={Boolean(documents.iecFile)}
                  />
                  <LinkBox
                    href={documents.gstFile ? resolveAssetUrl(documents.gstFile) : ""}
                    label="GST Certificate"
                    ready={Boolean(documents.gstFile)}
                  />
                  <LinkBox
                    href={documents.productImages?.[0] ? resolveAssetUrl(documents.productImages[0]) : ""}
                    label="Product Image Set"
                    ready={Boolean(documents.productImages?.length)}
                  />
                </>
              ) : (
                <div className="rounded-3xl border border-line bg-canvas/70 p-4 text-sm leading-7 text-muted">
                  Buyer onboarding depends on company, business ID, product requirement, and phone verification. No additional documents are required right now.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function LinkBox({ label, ready, href }) {
  if (!ready) {
    return (
      <div className="rounded-3xl border border-line bg-canvas/70 p-4">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-2 text-sm text-muted">Missing</p>
      </div>
    );
  }

  return (
    <a
      className="rounded-3xl border border-line bg-canvas/70 p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-sm"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      <p className="text-sm font-semibold text-ink">{label}</p>
      <p className="mt-2 text-sm text-primary">Open file</p>
    </a>
  );
}
