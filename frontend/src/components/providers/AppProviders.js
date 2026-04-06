"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { pageTransitionVariants } from "@/lib/motion";

function RouteTransition({ children }) {
  const pathname = usePathname();

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={pathname}
        animate="animate"
        className="min-h-screen"
        exit="exit"
        initial="initial"
        variants={pageTransitionVariants}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default function AppProviders({ children }) {
  return (
    <ToastProvider>
      <RouteTransition>{children}</RouteTransition>
    </ToastProvider>
  );
}
