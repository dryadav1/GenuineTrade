"use client";

import { motion } from "framer-motion";
import AnimatedCounter from "@/components/common/AnimatedCounter";
import { hoverLift, staggerItem } from "@/lib/motion";

export default function StatCard({
  label,
  value,
  detail,
  valueFormatter = null
}) {
  const isNumericValue =
    typeof value === "number" ||
    (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.replace(/,/g, "").trim()));

  return (
    <motion.div
      {...hoverLift}
      className="metric-card rounded-[28px] p-5 sweep-highlight"
      initial="initial"
      viewport={{ once: true, amount: 0.25 }}
      whileInView="animate"
      variants={staggerItem}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/48">
        {label}
      </p>
      <p className="mt-4 text-3xl font-bold text-primary sm:text-[2rem]">
        {isNumericValue ? (
          <AnimatedCounter
            formatter={valueFormatter || undefined}
            value={Number(value)}
          />
        ) : (
          value
        )}
      </p>
      {detail ? <p className="mt-3 text-sm leading-6 text-muted">{detail}</p> : null}
    </motion.div>
  );
}
