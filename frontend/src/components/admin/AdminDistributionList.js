"use client";

import { motion } from "framer-motion";

export default function AdminDistributionList({
  items = [],
  emptyLabel = "No distribution data is available yet.",
  valueFormatter = (value) => value
}) {
  if (!items.length) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  const maxValue = Math.max(...items.map((item) => Number(item.value || 0)), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const numericValue = Number(item.value || 0);
        const width = Math.max((numericValue / maxValue) * 100, numericValue > 0 ? 8 : 0);

        return (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{item.label}</span>
              <span className="text-muted">{valueFormatter(numericValue)}</span>
            </div>
            <div className="h-2 rounded-full bg-canvas">
              <motion.div
                animate={{ width: `${width}%` }}
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
