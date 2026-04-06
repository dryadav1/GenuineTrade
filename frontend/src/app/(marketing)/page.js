"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import SiteHeader from "@/components/marketing/SiteHeader";
import { staggerContainer, staggerItem } from "@/lib/motion";

const platformCards = [
  {
    title: "Verified exporters",
    copy: "Showcase compliance, documents, and trust signals before the first buyer conversation."
  },
  {
    title: "Qualified buyers",
    copy: "Capture sourcing intent through structured RFQs instead of scattered chat threads and spreadsheets."
  },
  {
    title: "Operational control",
    copy: "Keep approvals, pricing, messaging, and onboarding inside one premium admin workspace."
  }
];

const launchSequence = [
  "Choose your role and create the account.",
  "Complete guided onboarding with validation and document uploads.",
  "Move into dashboards, RFQs, chat, pricing, and admin review without dead ends."
];

export default function MarketingPage() {
  return (
    <main className="relative min-h-screen bg-canvas pb-10">
      <SiteHeader />

      <div className="px-3 pt-4 sm:px-5 lg:px-6">
        <div className="mx-auto max-w-[1480px]">
        <motion.section
          animate="animate"
          className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]"
          initial="initial"
          variants={staggerContainer}
        >
          <motion.div className="panel rounded-[32px] bg-hero-wash p-8 lg:p-10" variants={staggerItem}>
            <div className="flex flex-wrap gap-2">
              <span className="shell-chip">Trusted onboarding</span>
              <span className="shell-chip">Verified identities</span>
              <span className="shell-chip">Premium workflows</span>
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-bold leading-tight text-ink sm:text-6xl">
              A trust-first B2B trade platform that feels ready for global scale.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-muted">
              GenuineTrade brings verified exporters, serious buyers, RFQ workflows, clean messaging,
              and subscription controls into one polished SaaS-grade experience.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary">
                Start onboarding
              </Link>
              <Link href="/exporter" className="btn-secondary">
                Explore exporter flow
              </Link>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="surface-muted p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                  Roles
                </p>
                <p className="mt-3 text-3xl font-bold text-ink">2-sided</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Built for exporter and buyer onboarding from day one.
                </p>
              </div>
              <div className="surface-muted p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                  Trust layer
                </p>
                <p className="mt-3 text-3xl font-bold text-ink">G-Check Lite</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Verification, document review, and visible trust signals.
                </p>
              </div>
              <div className="surface-muted p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                  Readiness
                </p>
                <p className="mt-3 text-3xl font-bold text-ink">Launch mode</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  Premium UX, admin controls, and cleaner navigation throughout.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div className="grid gap-4" variants={staggerItem}>
            {platformCards.map((feature, index) => (
              <motion.article
                key={feature.title}
                className="panel rounded-[28px] p-6"
                custom={index}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.07, duration: 0.34 }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                  Feature {index + 1}
                </p>
                <h2 className="mt-3 text-xl font-semibold text-ink">{feature.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted">{feature.copy}</p>
              </motion.article>
            ))}
          </motion.div>
        </motion.section>

        <motion.section
          animate="animate"
          className="mt-4 grid gap-4 xl:grid-cols-[0.96fr_1.04fr]"
          initial="initial"
          variants={staggerContainer}
        >
          <motion.article className="panel rounded-[32px] p-8" variants={staggerItem}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
              Built for launch
            </p>
            <h2 className="mt-4 text-3xl font-bold text-ink">Clear onboarding, cleaner operations.</h2>
            <div className="mt-6 space-y-4">
              {launchSequence.map((item, index) => (
                <div key={item} className="surface-muted flex items-start gap-4 p-4">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-white">
                    0{index + 1}
                  </span>
                  <p className="text-sm leading-7 text-muted">{item}</p>
                </div>
              ))}
            </div>
          </motion.article>

          <motion.article className="panel rounded-[32px] bg-hero-wash p-8" variants={staggerItem}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
              Choose your side
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Link href="/exporter" className="surface-muted block p-6 hover:-translate-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/45">
                  Exporters
                </p>
                <h3 className="mt-3 text-2xl font-bold text-ink">Win trust faster.</h3>
                <p className="mt-3 text-sm leading-7 text-muted">
                  Showcase products, verification assets, and response-ready workflows.
                </p>
              </Link>
              <Link href="/buyer" className="surface-muted block p-6 hover:-translate-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/45">
                  Buyers
                </p>
                <h3 className="mt-3 text-2xl font-bold text-ink">Source with confidence.</h3>
                <p className="mt-3 text-sm leading-7 text-muted">
                  Post structured RFQs, shortlist suppliers, and keep procurement conversations clean.
                </p>
              </Link>
            </div>
          </motion.article>
        </motion.section>
        </div>
      </div>
    </main>
  );
}
