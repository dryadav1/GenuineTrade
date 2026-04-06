"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/exporter", label: "Exporters" },
  { href: "/buyer", label: "Buyers" },
  { href: "/pricing", label: "Pricing" }
];

const isActiveRoute = (pathname, href) => {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

function MenuIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  );
}

export default function SiteHeader({ compact = false }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = useMemo(
    () =>
      navItems.map((item) => ({
        ...item,
        active: isActiveRoute(pathname, item.href)
      })),
    [pathname]
  );

  return (
    <header className="sticky top-3 z-40 px-3 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1480px]">
        <div className="site-header-surface flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-full bg-primary px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/14 text-xs font-bold">
                GT
              </span>
              <span className="hidden sm:inline">GenuineTrade</span>
            </Link>

            <nav className="hidden items-center gap-2 lg:flex">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`site-nav-link ${item.active ? "site-nav-link-active" : ""}`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            {!compact ? (
              <p className="text-sm text-primary/55">
                Trust-first infrastructure for verified global trade.
              </p>
            ) : null}
            <Link href="/login" className="btn-secondary">
              Login
            </Link>
            <Link href="/signup" className="btn-primary">
              Sign up
            </Link>
          </div>

          <button
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
            className="icon-button lg:hidden"
            onClick={() => setMobileOpen((current) => !current)}
            type="button"
          >
            <MenuIcon />
          </button>
        </div>

        {mobileOpen ? (
          <div className="site-header-surface mt-3 space-y-4 px-4 py-4 lg:hidden">
            <nav className="grid gap-2">
              {links.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`site-nav-link justify-center ${item.active ? "site-nav-link-active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/login" className="btn-secondary" onClick={() => setMobileOpen(false)}>
                Login
              </Link>
              <Link href="/signup" className="btn-primary" onClick={() => setMobileOpen(false)}>
                Sign up
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
