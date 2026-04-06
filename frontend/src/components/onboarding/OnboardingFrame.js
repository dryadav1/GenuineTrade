"use client";

import { motion } from "framer-motion";
import SiteHeader from "@/components/marketing/SiteHeader";
import { staggerContainer, staggerItem } from "@/lib/motion";

export default function OnboardingFrame({
  eyebrow,
  title,
  description,
  asideTitle,
  asideBody,
  children,
  footer,
  compact = false
}) {
  return (
    <main className="relative min-h-screen bg-canvas px-3 py-3 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1480px]">
        <SiteHeader compact />

        <motion.section
          animate="animate"
          className={`mt-4 grid gap-4 ${compact ? "xl:grid-cols-[0.92fr_1.08fr]" : "xl:grid-cols-[0.96fr_1.04fr]"}`}
          initial="initial"
          variants={staggerContainer}
        >
          <motion.aside
            className="panel overflow-hidden rounded-[32px] bg-hero-wash p-6 sm:p-8"
            variants={staggerItem}
          >
            <p className="shell-chip w-fit text-primary/55">{eyebrow}</p>
            <h1 className="mt-5 max-w-xl text-4xl font-bold leading-tight text-ink sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:text-base">
              {description}
            </p>

            <div className="mt-8 rounded-[28px] border border-white/65 bg-white/80 p-5 shadow-panel backdrop-blur">
              <p className="text-sm font-semibold text-ink">{asideTitle}</p>
              <p className="mt-3 text-sm leading-7 text-muted">{asideBody}</p>
            </div>
          </motion.aside>

          <motion.section
            className="panel rounded-[32px] bg-white/95 p-6 sm:p-8"
            variants={staggerItem}
          >
            {children}
            {footer ? <div className="mt-6 border-t border-line pt-5">{footer}</div> : null}
          </motion.section>
        </motion.section>
      </div>
    </main>
  );
}
