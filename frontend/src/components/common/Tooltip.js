"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { tooltipVariants } from "@/lib/motion";

const sideMap = {
  top: "bottom-full left-1/2 mb-3 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-3 -translate-x-1/2",
  left: "right-full top-1/2 mr-3 -translate-y-1/2",
  right: "left-full top-1/2 ml-3 -translate-y-1/2"
};

export default function Tooltip({
  content,
  side = "bottom",
  className = "",
  children
}) {
  const [open, setOpen] = useState(false);

  if (!content) {
    return children;
  }

  return (
    <span
      className={`relative inline-flex ${className}`}
      onBlur={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}

      <AnimatePresence>
        {open ? (
          <motion.span
            animate="animate"
            className={`pointer-events-none absolute z-[90] whitespace-nowrap rounded-2xl border border-primary/10 bg-primary px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white shadow-float ${sideMap[side] || sideMap.bottom}`}
            exit="exit"
            initial="initial"
            role="tooltip"
            variants={tooltipVariants}
          >
            {content}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
