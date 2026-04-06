"use client";

import { motion } from "framer-motion";

const maxValue = (items = []) =>
  Math.max(...items.map((item) => Number(item.value || 0)), 1);

export default function AdminBarChart({
  data = [],
  valueFormatter = null,
  emptyLabel = "No chart data available."
}) {
  if (!data.length) {
    return (
      <div className="rounded-[28px] border border-dashed border-line bg-canvas/70 px-5 py-10 text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  const peak = maxValue(data);

  return (
    <div className="grid gap-3">
      {data.map((item, index) => {
        const width = `${Math.max((Number(item.value || 0) / peak) * 100, 6)}%`;
        const value = valueFormatter ? valueFormatter(Number(item.value || 0)) : item.value;

        return (
          <div key={`${item.label}-${index}`} className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{item.label}</span>
              <span className="text-primary">{value}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-canvas">
              <motion.div
                animate={{ width }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                initial={{ width: 0 }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
