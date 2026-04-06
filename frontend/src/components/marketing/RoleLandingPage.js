"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import SiteHeader from "@/components/marketing/SiteHeader";
import { staggerContainer, staggerItem } from "@/lib/motion";

export default function RoleLandingPage({
  eyebrow,
  title,
  subtitle,
  stats,
  pillars,
  ctaLabel
}) {
  return (
    <main className="min-h-screen bg-canvas pb-10">
      <SiteHeader />

      <div className="px-3 pt-4 sm:px-5 lg:px-6">
        <div className="mx-auto max-w-[1480px]">
          <motion.section
            animate="animate"
            className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]"
            initial="initial"
            variants={staggerContainer}
          >
            <motion.div className="panel rounded-[32px] bg-hero-wash p-8 lg:p-10" variants={staggerItem}>
              <p className="shell-chip w-fit">{eyebrow}</p>
              <h1 className="mt-6 max-w-4xl text-5xl font-bold leading-tight text-ink sm:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-muted">{subtitle}</p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="btn-primary">
                  {ctaLabel}
                </Link>
                <Link href="/pricing" className="btn-secondary">
                  View pricing
                </Link>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {stats.map((item) => (
                  <div key={item.label} className="surface-muted p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                      {item.label}
                    </p>
                    <p className="mt-3 text-3xl font-bold text-ink">{item.value}</p>
                    <p className="mt-2 text-sm leading-7 text-muted">{item.detail}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div className="grid gap-4" variants={staggerItem}>
              {pillars.map((pillar, index) => (
                <motion.article
                  key={pillar.title}
                  className="panel rounded-[28px] p-6"
                  custom={index}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + index * 0.06, duration: 0.34 }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/45">
                    Pillar {index + 1}
                  </p>
                  <h2 className="mt-3 text-2xl font-bold text-ink">{pillar.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-muted">{pillar.description}</p>
                </motion.article>
              ))}
            </motion.div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}
