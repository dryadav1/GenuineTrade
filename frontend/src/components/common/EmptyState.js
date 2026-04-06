import { motion } from "framer-motion";
import { staggerItem } from "@/lib/motion";

export default function EmptyState({ title, description, action }) {
  return (
    <motion.div
      className="panel flex min-h-56 flex-col items-center justify-center bg-grid-light bg-[length:22px_22px] p-8 text-center"
      initial="initial"
      viewport={{ once: true, amount: 0.25 }}
      whileInView="animate"
      variants={staggerItem}
    >
      <div className="rounded-full bg-primary/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        GenuineTrade
      </div>
      <h3 className="mt-5 text-2xl font-bold text-primary">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </motion.div>
  );
}
