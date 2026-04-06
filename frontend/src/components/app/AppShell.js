"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Children, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Tooltip from "@/components/common/Tooltip";
import { apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  buttonMotion,
  dropdownVariants,
  navItemVariants,
  navListVariants,
  sidebarVariants,
  staggerContainer,
  staggerItem
} from "@/lib/motion";
import { clearSession, getRoleLabel } from "@/lib/session";
import { closeSocketClient, getSocketClient } from "@/lib/socket";

const navItems = [
  { href: "/dashboard", adminHref: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/users", label: "Admin Panel", icon: "spark", roles: ["admin"] },
  { href: "/pricing", label: "Pricing", icon: "pricing" },
  { href: "/rfqs", label: "RFQs", icon: "rfq" },
  { href: "/matches", label: "Matches", icon: "matches" },
  { href: "/analytics", label: "Analytics", icon: "analytics", roles: ["buyer", "exporter"] },
  { href: "/chat", label: "Chat", icon: "chat", roles: ["buyer", "exporter"] },
  { href: "/profile", label: "Profile", icon: "profile" },
  { href: "/settings", label: "Settings", icon: "settings" }
];

const iconClassName = "h-5 w-5 shrink-0";

function AppIcon({ name, className = iconClassName }) {
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
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      );
    case "spark":
      return (
        <svg {...props}>
          <path d="m12 3 1.8 4.5L18 9.3l-4.2 1.8L12 15.6l-1.8-4.5L6 9.3l4.2-1.8L12 3Z" />
          <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
          <path d="m5 15 .7 1.6L7.3 17l-1.6.7L5 19.3l-.7-1.6L2.7 17l1.6-.7L5 15Z" />
        </svg>
      );
    case "pricing":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 15h2" />
          <path d="M12 15h4" />
        </svg>
      );
    case "rfq":
      return (
        <svg {...props}>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </svg>
      );
    case "matches":
      return (
        <svg {...props}>
          <path d="m7 7 3 3 7-7" />
          <path d="m7 17 3-3 2 2" />
          <path d="M17 17h.01" />
        </svg>
      );
    case "analytics":
      return (
        <svg {...props}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-7" />
          <path d="M22 19v-3" />
        </svg>
      );
    case "chat":
      return (
        <svg {...props}>
          <path d="M7 10h10" />
          <path d="M7 14h6" />
          <path d="M21 12c0 4.418-4.03 8-9 8a10.88 10.88 0 0 1-4-.74L3 20l1.14-3.42A7.4 7.4 0 0 1 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
        </svg>
      );
    case "profile":
      return (
        <svg {...props}>
          <path d="M19 21a7 7 0 0 0-14 0" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "settings":
      return (
        <svg {...props}>
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
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      );
    case "bell":
      return (
        <svg {...props}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.5 21a1.5 1.5 0 0 0 3 0" />
        </svg>
      );
    case "menu":
      return (
        <svg {...props}>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      );
    case "logout":
      return (
        <svg {...props}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="m16 17 5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AppShell({ session, title, subtitle, actions = null, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const contentBlocks = useMemo(() => Children.toArray(children), [children]);

  const user = session?.user || {
    role: "buyer",
    email: "team@genuinetrade.com",
    name: "GenuineTrade member",
    status: "pending",
    badge: "none"
  };

  const visibleNavItems = useMemo(
    () =>
      navItems
        .filter((item) => !item.roles || item.roles.includes(user.role || "buyer"))
        .map((item) => ({
          ...item,
          href: user.role === "admin" && item.adminHref ? item.adminHref : item.href
        })),
    [user.role]
  );

  useEffect(() => {
    if (!session?.token) {
      return;
    }

    let isMounted = true;
    const socket = getSocketClient(session.token);

    const loadNotifications = async () => {
      try {
        const data = await apiRequest("/notifications?limit=6", {
          token: session.token
        });

        if (!isMounted) {
          return;
        }

        setNotifications(data.items || []);
        setUnreadCount(data.unreadCount || 0);
      } catch (error) {
        if (isMounted) {
          setNotifications([]);
          setUnreadCount(0);
        }
      }
    };

    loadNotifications();

    const handleNotification = (notification) => {
      setNotifications((current) => [notification, ...current].slice(0, 6));
      setUnreadCount((current) => current + 1);
    };

    const handleCountUpdate = ({ unreadCount: nextUnreadCount }) => {
      setUnreadCount(nextUnreadCount || 0);
    };

    socket.on("notification:new", handleNotification);
    socket.on("notifications:count", handleCountUpdate);

    return () => {
      isMounted = false;
      socket.off("notification:new", handleNotification);
      socket.off("notifications:count", handleCountUpdate);
    };
  }, [session?.token]);

  const logout = () => {
    closeSocketClient();
    clearSession();
    router.push("/login");
  };

  const markAllNotificationsRead = async () => {
    if (!session?.token) {
      return;
    }

    try {
      await apiRequest("/notifications/read-all", {
        method: "PATCH",
        token: session.token
      });

      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          status: "read"
        }))
      );
      setUnreadCount(0);
    } catch (error) {
      // Keep the shell resilient if notification sync fails.
    }
  };

  const openNotification = async (notification) => {
    if (session?.token) {
      try {
        await apiRequest(`/notifications/${notification.id}/read`, {
          method: "PATCH",
          token: session.token
        });
      } catch (error) {
        // Keep the shell resilient if notification sync fails.
      }
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, status: "read" } : item
      )
    );
    setUnreadCount((current) =>
      notification.status === "unread" ? Math.max(current - 1, 0) : current
    );
    setNotificationsOpen(false);

    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-shell-wash text-white">
      <div className="border-b border-white/10 px-6 py-6">
        <span className="shell-chip border-white/15 bg-white/10 text-white/75 shadow-none">
          GenuineTrade Platform
        </span>
        <h1 className="mt-5 text-3xl font-bold leading-tight text-white">
          Global trade,
          <br />
          refined for trust.
        </h1>
        <p className="mt-4 text-sm leading-7 text-white/72">
          Premium workflows for verified buyers, exporters, and operators managing every deal stage.
        </p>
      </div>

      <motion.nav
        animate="animate"
        className="mt-2 space-y-2 px-4 py-5"
        initial="initial"
        variants={navListVariants}
      >
        {visibleNavItems.map((item) => {
          const active = pathname === item.href;

          return (
            <motion.div key={item.href} variants={navItemVariants}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`group relative flex items-center justify-between gap-3 rounded-[22px] px-4 py-3.5 transition ${
                  active
                    ? "bg-white/14 text-white shadow-float"
                    : "text-white/72 hover:bg-white/8 hover:text-white"
                }`}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
                ) : null}

                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition ${
                      active
                        ? "border-white/10 bg-white/14 text-white"
                        : "border-white/10 bg-white/6 text-white/72 group-hover:bg-white/10"
                    }`}
                  >
                    <AppIcon name={item.icon} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.label}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/42">
                      {active ? "Live section" : "Open module"}
                    </p>
                  </div>
                </div>

                <span
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    active ? "bg-accent notification-dot" : "bg-white/18"
                  }`}
                />
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>

      <div className="mt-auto px-4 pb-5">
        <div className="sweep-highlight overflow-hidden rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/52">
                Workspace
              </p>
              <p className="mt-3 text-lg font-semibold text-white">{getRoleLabel(user)}</p>
            </div>
            <span className="rounded-full bg-accent/18 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
              {user.status || "pending"}
            </span>
          </div>

          <p className="mt-4 break-all text-sm leading-6 text-white/72">{user.email}</p>

          {user.publicId ? (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
              {user.publicId}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <main className="relative min-h-screen bg-canvas px-3 py-3 sm:px-5 lg:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1600px] gap-4">
        <aside className="hidden w-[304px] shrink-0 overflow-hidden rounded-[32px] border border-primary/10 shadow-shell lg:block">
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
                aria-label="Close sidebar"
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
          <motion.header
            animate={{ opacity: 1, y: 0 }}
            className="panel rounded-[32px] p-5 sm:p-6"
            initial={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.34 }}
          >
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="shell-chip">{getRoleLabel(user)} workspace</span>
                    {user.publicId ? <span className="shell-chip">{user.publicId}</span> : null}
                    <span className="shell-chip border-accent/20 bg-accent/10 text-success">
                      {user.status || "Pending review"}
                    </span>
                  </div>
                  <h2 className="mt-5 text-3xl font-bold text-primary sm:text-4xl">{title}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-muted sm:text-base">
                    {subtitle}
                  </p>
                </div>

                <div className="flex flex-col gap-3 xl:items-end">
                  <div className="surface-muted flex min-w-[280px] items-center gap-3 px-4 py-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/6 text-primary">
                      <AppIcon name="search" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/42">
                        Search
                      </p>
                      <input
                        className="mt-1 w-full bg-transparent text-sm text-text outline-none"
                        placeholder="RFQs, exporters, transactions, activity"
                        readOnly
                        value=""
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Tooltip content="Open navigation" side="bottom">
                      <motion.button
                        {...buttonMotion}
                        aria-label="Open sidebar"
                        className="icon-button lg:hidden"
                        onClick={() => setMobileOpen(true)}
                        type="button"
                      >
                        <AppIcon name="menu" />
                      </motion.button>
                    </Tooltip>

                    <div className="relative">
                      <Tooltip content="Notification center" side="bottom">
                        <motion.button
                          {...buttonMotion}
                          aria-label="Open notifications"
                          className="icon-button"
                          onClick={() => setNotificationsOpen((current) => !current)}
                          type="button"
                        >
                          <AppIcon name="bell" />
                          {unreadCount ? (
                            <span className="notification-dot absolute right-2 top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-white shadow-glow">
                              {unreadCount}
                            </span>
                          ) : null}
                        </motion.button>
                      </Tooltip>

                      <AnimatePresence>
                        {notificationsOpen ? (
                          <motion.div
                            animate="animate"
                            className="absolute right-0 z-20 mt-3 w-[360px] rounded-[28px] border border-line bg-white/95 p-4 shadow-shell backdrop-blur"
                            exit="exit"
                            initial="initial"
                            variants={dropdownVariants}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/45">
                                  Notification center
                                </p>
                                <p className="mt-2 text-lg font-semibold text-primary">
                                  Live workspace updates
                                </p>
                              </div>
                              <button
                                className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/40 transition hover:text-primary"
                                onClick={() => setNotificationsOpen(false)}
                                type="button"
                              >
                                Close
                              </button>
                            </div>

                            <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-canvas/80 px-4 py-3">
                              <div>
                                <p className="text-sm font-semibold text-primary">
                                  {unreadCount} unread update{unreadCount === 1 ? "" : "s"}
                                </p>
                                <p className="text-xs text-muted">
                                  Stay on top of every trade touchpoint.
                                </p>
                              </div>
                              <button
                                className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/55"
                                onClick={markAllNotificationsRead}
                                type="button"
                              >
                                Mark all read
                              </button>
                            </div>

                            <div className="mt-4 space-y-3">
                              {notifications.length ? (
                                notifications.map((notification) => (
                                  <motion.button
                                    key={notification.id}
                                    layout
                                    className={`w-full rounded-[24px] border px-4 py-3 text-left transition ${
                                      notification.status === "unread"
                                        ? "border-accent/25 bg-accent/8"
                                        : "border-line bg-canvas/75 hover:bg-white"
                                    }`}
                                    onClick={() => openNotification(notification)}
                                    type="button"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-primary">
                                          {notification.title}
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-muted">
                                          {notification.body}
                                        </p>
                                      </div>
                                      <span
                                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                          notification.status === "unread"
                                            ? "bg-accent notification-dot"
                                            : "bg-primary/15"
                                        }`}
                                      />
                                    </div>
                                    <p className="mt-3 text-xs font-medium text-primary/45">
                                      {formatDateTime(notification.createdAt)}
                                    </p>
                                  </motion.button>
                                ))
                              ) : (
                                <div className="rounded-[24px] border border-dashed border-line px-4 py-6 text-sm text-muted">
                                  No notifications yet.
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </div>

                    <div className="surface-muted hidden items-center gap-3 px-3 py-2 sm:flex">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-white">
                        {(user.name || user.email || "GT")
                          .split(/\s+/)
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((part) => part[0]?.toUpperCase() || "")
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {user.name || "GenuineTrade user"}
                        </p>
                        <p className="truncate text-xs text-muted">{user.email}</p>
                      </div>
                    </div>

                    <Tooltip content="Secure sign out" side="bottom">
                      <motion.button
                        {...buttonMotion}
                        className="icon-button"
                        onClick={logout}
                        type="button"
                      >
                        <AppIcon name="logout" />
                      </motion.button>
                    </Tooltip>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:hidden">
                {visibleNavItems.map((item) => {
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "bg-primary text-white shadow-sm"
                          : "border border-line bg-white text-primary"
                      }`}
                    >
                      <AppIcon name={item.icon} className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>

              {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
            </div>
          </motion.header>

          <motion.div
            animate="animate"
            className="flex flex-1 flex-col gap-4"
            initial="initial"
            variants={staggerContainer}
          >
            {contentBlocks.map((child, index) => (
              <motion.div key={child?.key || `content-block-${index}`} variants={staggerItem}>
                {child}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </main>
  );
}
