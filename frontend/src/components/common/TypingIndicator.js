"use client";

import { motion } from "framer-motion";

const dotTransition = {
  duration: 0.7,
  ease: "easeInOut",
  repeat: Infinity,
  repeatType: "reverse"
};

export default function TypingIndicator({ label = "Typing" }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/92 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary/55 shadow-sm backdrop-blur">
      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-accent/90 shadow-glow" />
      <span>{label}</span>
      <span className="flex items-center gap-1">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
            className="h-1.5 w-1.5 rounded-full bg-accent"
            transition={{
              ...dotTransition,
              delay: index * 0.12
            }}
          />
        ))}
      </span>
    </div>
  );
}
