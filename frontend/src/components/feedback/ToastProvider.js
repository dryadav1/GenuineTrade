"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { dropdownVariants } from "@/lib/motion";

const ToastContext = createContext(null);

const toastToneMap = {
  success: {
    container: "border-accent/25 bg-white text-ink",
    chip: "bg-accent/14 text-success"
  },
  error: {
    container: "border-danger/20 bg-white text-ink",
    chip: "bg-danger/10 text-danger"
  },
  info: {
    container: "border-primary/15 bg-white text-ink",
    chip: "bg-primary/10 text-primary"
  }
};

const ToastIcon = ({ type }) => {
  if (type === "success") {
    return (
      <motion.svg
        animate={{ scale: [0.85, 1.08, 1] }}
        className="h-5 w-5 text-success"
        fill="none"
        viewBox="0 0 24 24"
      >
        <motion.circle
          animate={{ pathLength: 1, opacity: 1 }}
          cx="12"
          cy="12"
          initial={{ pathLength: 0, opacity: 0.4 }}
          r="9"
          stroke="currentColor"
          strokeWidth="1.8"
          transition={{ duration: 0.35 }}
        />
        <motion.path
          animate={{ pathLength: 1, opacity: 1 }}
          d="m8.5 12.3 2.3 2.4 4.8-5.5"
          initial={{ pathLength: 0, opacity: 0 }}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          transition={{ delay: 0.1, duration: 0.28 }}
        />
      </motion.svg>
    );
  }

  if (type === "error") {
    return (
      <motion.svg
        animate={{ rotate: [0, -6, 6, 0] }}
        className="h-5 w-5 text-danger"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
        <path d="m9 9 6 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="m15 9-6 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </motion.svg>
    );
  }

  return (
    <motion.svg
      animate={{ rotate: [0, 10, -8, 0] }}
      className="h-5 w-5 text-primary"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="12" cy="15.8" r="1" fill="currentColor" />
    </motion.svg>
  );
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = (id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const pushToast = ({ type = "info", title = "", description = "", duration = 3200 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextToast = {
      id,
      type,
      title,
      description,
      duration
    };

    setToasts((current) => [...current, nextToast]);

    if (duration > 0) {
      window.setTimeout(() => {
        dismissToast(id);
      }, duration);
    }

    return id;
  };

  const value = useMemo(
    () => ({
      pushToast,
      success: (description, options = {}) =>
        pushToast({
          type: "success",
          title: options.title || "Success",
          description,
          duration: options.duration ?? 3200
        }),
      error: (description, options = {}) =>
        pushToast({
          type: "error",
          title: options.title || "Something went wrong",
          description,
          duration: options.duration ?? 4200
        }),
      info: (description, options = {}) =>
        pushToast({
          type: "info",
          title: options.title || "Heads up",
          description,
          duration: options.duration ?? 3200
        }),
      dismissToast
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-full max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const tone = toastToneMap[toast.type] || toastToneMap.info;

            return (
              <motion.div
                key={toast.id}
                animate="animate"
                className={`pointer-events-auto overflow-hidden rounded-[24px] border p-4 shadow-shell ${tone.container}`}
                exit="exit"
                initial="initial"
                variants={dropdownVariants}
              >
                <div className="flex items-start gap-3">
                  <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone.chip}`}>
                    <ToastIcon type={toast.type} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{toast.title}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{toast.description}</p>
                      </div>
                      <button
                        className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/40 transition hover:text-primary"
                        onClick={() => dismissToast(toast.id)}
                        type="button"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return context;
};

export const useToastOnChange = ({
  successMessage = "",
  errorMessage = "",
  successTitle = "Success",
  errorTitle = "Something went wrong"
}) => {
  const toast = useToast();
  const previousMessages = useRef({
    successMessage: "",
    errorMessage: ""
  });

  useEffect(() => {
    if (
      successMessage &&
      successMessage !== previousMessages.current.successMessage
    ) {
      toast.success(successMessage, {
        title: successTitle
      });
      previousMessages.current.successMessage = successMessage;
    }
  }, [successMessage, successTitle, toast]);

  useEffect(() => {
    if (
      errorMessage &&
      errorMessage !== previousMessages.current.errorMessage
    ) {
      toast.error(errorMessage, {
        title: errorTitle
      });
      previousMessages.current.errorMessage = errorMessage;
    }
  }, [errorMessage, errorTitle, toast]);
};
