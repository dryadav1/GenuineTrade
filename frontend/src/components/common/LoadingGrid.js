"use client";

import { motion } from "framer-motion";
import SkeletonBlock from "@/components/common/SkeletonBlock";
import { staggerContainer, staggerItem } from "@/lib/motion";

export default function LoadingGrid({ count = 3 }) {
  return (
    <motion.div
      animate="animate"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      initial="initial"
      variants={staggerContainer}
    >
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          className="panel rounded-[28px] p-5"
          variants={staggerItem}
        >
          <SkeletonBlock className="h-3 w-24 rounded-full" />
          <SkeletonBlock className="mt-4 h-8 w-32 rounded-full" />
          <SkeletonBlock className="mt-5 h-20 rounded-2xl" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SkeletonBlock className="h-16 rounded-2xl" />
            <SkeletonBlock className="h-16 rounded-2xl" />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
