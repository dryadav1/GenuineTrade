"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { usePathname, useRouter } from "next/navigation";
import LoadingGrid from "@/components/common/LoadingGrid";
import {
  buttonMotion,
  pageTransitionVariants,
  sidebarVariants,
  softEase
} from "@/lib/motion";
import { getRoleLabel } from "@/lib/session";
import { useWorkspaceSession } from "@/lib/workspace";

const adminNavItems = [
  {
    href: "/admin",
    label: "Dashboard",
    description: "Platform revenue, user growth, and recent user activity."
  },
  {
    href: "/admin/users",
    label: "Users",
    description: "Paginated user management with filters, review actions, and badge assignment."
  },
  {
    href: "/admin/verification",
    label: "Verification",
    description: "Compliance queue visibility for exporter onboarding and document readiness."
  },
  {
    href: "/admin/rfqs",
    label: "RFQs",
    description: "Live RFQ inventory with request volume, buyers, and match signals."
  },
  {
    href: "/admin/subscriptions",
    label: "Subscriptions",
    description: "Plan performance, active subscribers, expiry risk, and recurring revenue."
  },
  {
    href: "/admin/transactions",
    label: "Transactions",
    description: "Trade payment monitoring with provider, escrow, and refund states."
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    description: "Revenue, RFQ demand, plan mix, and payment provider distribution."
  },
  {
    href: "/admin/settings",
    label: "Settings",
    description: "Platform configuration, registration controls, and plan management."
  }
];

const AdminContext = createContext(null);

export const useAdminContext = () => {
  const context = useContext(AdminContext);

  if (!context) {
    throw new Error("useAdminContext must be used within AdminLayoutClient");
  }

  return context;
};

const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: "1.8",
  viewBox: "0 0 24 24"
};

function AdminIcon({ label, className = "h-5 w-5" }) {
  switch (label) {
    case "Dashboard":
      return (
        <svg {...iconProps} className={className}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      );
    case "Users":
      return (
        <svg {...iconProps} className={className}>
          <path d="M16 21a4 4 0 0 0-8 0" />
          <circle cx="12" cy="7" r="4" />
          <path d="M20 8v6" />
          <path d="M23 11h-6" />
        </svg>
      );
    case "Verification":
      return (
        <svg {...iconProps} className={className}>
          <path d="m9 12 2 2 4-5" />
          <path d="M12 3 4 7v6c0 5 3.4 7.74 8 9 4.6-1.26 8-4 8-9V7l-8-4Z" />
        </svg>
      );
    case "RFQs":
      return (
        <svg {...iconProps} className={className}>
          <path d="M7 6h13" />
          <path d="M7 12h13" />
          <path d="M7 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </svg>
      );
    case "Subscriptions":
      return (
        <svg {...iconProps} className={className}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 15h2" />
          <path d="M12 15h4" />
        </svg>
      );
    case "Transactions":
      return (
        <svg {...iconProps} className={className}>
          <path d="M12 3v18" />
          <path d="M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6" />
        </svg>
      );
    case "Analytics":
      return (
        <svg {...iconProps} className={className}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-7" />
          <path d="M22 19v-3" />
        </svg>
      );
    case "Settings":
      return (
        <svg {...iconProps} className={className}>
          <path d="M12 2v4" />
          <path d="M12 18v4" />
          <path d="m4.93 4.93 2.83 2.83" />
          <path d="m16.24 16.24 2.83 2.83" />
          <path d="M2 12h4" />
          <path d="M18 12h4" />
          <path d="m4.93 19.07 2.83-2.83" />
          <path d="m16.24 7.76 2.83-2.83" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "Logout":
      return (
        <svg {...iconProps} className={className}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    case "Menu":
      return (
        <svg {...iconProps} className={className}>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      );
    default:
      return null;
  }
}

const resolveActiveItem = (pathname) =>
  [...adminNavItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)) ||
  adminNavItems[0];

export default function AdminLayoutClient({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, ready, logout } = useWorkspaceSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!ready || !session) {
      return;
    }

    if (session.user.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [ready, router, session]);

  const activeItem = useMemo(() => resolveActiveItem(pathname), [pathname]);
  const canManageCore = session?.user?.adminAccessLevel === "super_admin";

  if (!ready || !session) {
    return (
      <main className="min-h-screen bg-canvas px-4 py-4">
        <div className="mx-auto max-w-[1600px] space-y-4">
          <div className="panel rounded-[32px] p-6">
            <div className="h-8 w-48 animate-pulse rounded-full bg-canvas" />
            <div className="mt-4 h-4 w-80 animate-pulse rounded-full bg-canvas" />
          </div>
          <LoadingGrid count={6} />
        </div>
      </main>
    );
  }

  if (session.user.role !== "admin") {
    return null;
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-shell-wash text-white">
      <div className="border-b border-white/10 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
          GenuineTrade Admin
        </p>
        <h1 className="mt-4 text-3xl font-bold leading-tight">
          Clean control
          <br />
          for scale.
        </h1>
        <p className="mt-4 text-sm leading-7 text-white/72">
          Route-based admin surfaces keep data isolated, paginated, and fast under
          load.
        </p>
      </div>

      <nav className="space-y-2 px-4 py-5">
        {adminNavItems.map((item) => {
          const isActive = activeItem.href === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-[22px] px-4 py-3.5 transition ${
                isActive
                  ? "bg-white/14 text-white shadow-float"
                  : "text-white/72 hover:bg-white/8 hover:text-white"
              }`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${
                  isActive
                    ? "border-white/10 bg-white/14 text-white"
                    : "border-white/10 bg-white/6 text-white/70"
                }`}
              >
                <AdminIcon label={item.label} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.label}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/42">
                  {isActive ? "Open section" : "View module"}
                </p>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-4 pb-5">
        <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/52">
            Access
          </p>
          <p className="mt-3 text-lg font-semibold text-white">
            {getRoleLabel(session.user)}
          </p>
          <p className="mt-2 text-sm text-white/72">{session.user.email}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-accent">
            {canManageCore ? "Super Admin" : "Sub Admin"}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <AdminContext.Provider
      value={{
        session,
        canManageCore,
        activeItem,
        adminNavItems,
        logout
      }}
    >
      <motion.main
        animate="animate"
        className="min-h-screen bg-canvas px-3 py-3 sm:px-5 lg:px-6"
        initial="initial"
        variants={pageTransitionVariants}
      >
        <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1600px] gap-4">
          <aside className="hidden w-[308px] shrink-0 overflow-hidden rounded-[32px] border border-primary/10 shadow-shell lg:block">
            {sidebar}
          </aside>

          <AnimatePresence>
            {mobileOpen ? (
              <motion.div
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0 }}
              >
                <button
                  aria-label="Close admin navigation"
                  className="absolute inset-0 h-full w-full cursor-default"
                  onClick={() => setMobileOpen(false)}
                  type="button"
                />
                <motion.aside
                  animate="open"
                  className="relative h-full w-[300px] overflow-hidden border-r border-primary/10 shadow-2xl"
                  exit="closed"
                  initial="closed"
                  variants={sidebarVariants}
                >
                  {sidebar}
                </motion.aside>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <header className="panel rounded-[32px] p-5 sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="shell-chip">Admin workspace</span>
                    <span className="shell-chip border-accent/20 bg-accent/10 text-success">
                      {canManageCore ? "Super Admin" : "Sub Admin"}
                    </span>
                  </div>
                  <h2 className="mt-5 text-3xl font-bold text-primary sm:text-4xl">
                    {activeItem.label}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">
                    {activeItem.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <motion.button
                    {...buttonMotion}
                    aria-label="Open admin navigation"
                    className="icon-button lg:hidden"
                    onClick={() => setMobileOpen(true)}
                    type="button"
                  >
                    <AdminIcon label="Menu" />
                  </motion.button>

                  <div className="surface-muted hidden items-center gap-3 px-3 py-2 sm:flex">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-white">
                      {(session.user.name || session.user.email || "AD")
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0]?.toUpperCase() || "")
                        .join("")}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {session.user.name || "Admin"}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {session.user.email}
                      </p>
                    </div>
                  </div>

                  <motion.button
                    {...buttonMotion}
                    className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition"
                    onClick={logout}
                    type="button"
                  >
                    <AdminIcon className="h-4 w-4" label="Logout" />
                    Logout
                  </motion.button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 lg:hidden">
                {adminNavItems.map((item) => {
                  const isActive = activeItem.href === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? "bg-primary text-white"
                          : "border border-line bg-white text-primary"
                      }`}
                    >
                      <AdminIcon className="h-4 w-4" label={item.label} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </header>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-1 flex-col gap-4"
              initial={{ opacity: 0, y: 14 }}
              transition={{ duration: 0.24, ease: softEase }}
            >
              {children}
            </motion.div>
          </div>
        </div>
      </motion.main>
    </AdminContext.Provider>
  );
}
