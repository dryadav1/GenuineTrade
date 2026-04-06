"use client";

import { motion } from "framer-motion";
import { hoverLift, staggerItem } from "@/lib/motion";

export default function SectionCard({ eyebrow, title, description, children }) {
  return (
    <motion.section
      {...hoverLift}
      className="panel rounded-[30px] p-6 sm:p-7"
      initial="initial"
      viewport={{ once: true, amount: 0.2 }}
      whileInView="animate"
      variants={staggerItem}
    >
      {eyebrow ? (
        <p className="shell-chip w-fit text-primary/55">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-4 text-2xl font-bold text-primary sm:text-[1.75rem]">{title}</h2>
      {description ? (
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </motion.section>
  );
}
