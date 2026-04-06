"use client";

import { AnimatePresence, motion } from "framer-motion";
import { modalBackdropVariants, modalPanelVariants } from "@/lib/motion";

export default function ActionModal({
  open,
  title,
  description,
  children,
  onClose
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate="animate"
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/45 px-4 py-8 backdrop-blur-sm"
          exit="exit"
          initial="initial"
          onClick={onClose}
          variants={modalBackdropVariants}
        >
          <motion.div
            animate="animate"
            className="panel w-full max-w-2xl rounded-[32px] p-6 sm:p-7"
            exit="exit"
            initial="initial"
            onClick={(event) => event.stopPropagation()}
            variants={modalPanelVariants}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="shell-chip w-fit">
                  Action
                </p>
                <h3 className="mt-4 text-2xl font-bold text-primary">{title}</h3>
                {description ? (
                  <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
                ) : null}
              </div>
              <button className="btn-secondary px-3 py-2" onClick={onClose} type="button">
                Close
              </button>
            </div>
            <div className="mt-6">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
