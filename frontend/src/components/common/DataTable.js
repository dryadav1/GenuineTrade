"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";

export default function DataTable({ columns, rows, empty }) {
  if (!rows.length) {
    return empty;
  }

  return (
    <div className="table-wrap rounded-[28px] border border-line shadow-panel">
      <div
        className="hidden grid-cols-[repeat(var(--columns),minmax(0,1fr))] border-b border-line bg-canvas/85 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary/55 md:grid"
        style={{ "--columns": columns.length }}
      >
        {columns.map((column) => (
          <div key={column.key}>{column.label}</div>
        ))}
      </div>

      <motion.div
        animate="animate"
        className="divide-y divide-line"
        initial="initial"
        variants={staggerContainer}
      >
        {rows.map((row) => (
          <motion.div
            key={row.key}
            className="grid gap-4 px-5 py-5 transition duration-200 hover:bg-primary/[0.025] md:grid-cols-[repeat(var(--columns),minmax(0,1fr))]"
            style={{ "--columns": columns.length }}
            variants={staggerItem}
          >
            {columns.map((column) => (
              <div key={column.key}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/45 md:hidden">
                  {column.label}
                </p>
                <div className="text-sm text-text">{row[column.key]}</div>
              </div>
            ))}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
