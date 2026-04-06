"use client";

import { motion } from "framer-motion";

export default function LoadingSpinner({
  className = "h-4 w-4",
  tone = "currentColor"
}) {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      aria-hidden="true"
      className={`inline-flex ${className}`}
      transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
    >
      <svg className="h-full w-full" fill="none" viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke={tone}
          strokeOpacity="0.2"
          strokeWidth="3"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke={tone}
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
    </motion.span>
  );
}
