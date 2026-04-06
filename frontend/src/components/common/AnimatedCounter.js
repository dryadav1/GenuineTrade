"use client";

import { useEffect, useMemo, useState } from "react";

const parseNumericValue = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/,/g, "").trim();
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  return Number(normalized);
};

export default function AnimatedCounter({
  value,
  duration = 1.1,
  formatter = (nextValue) => nextValue.toLocaleString("en-IN"),
  decimals = 0
}) {
  const numericValue = useMemo(() => parseNumericValue(value), [value]);
  const [displayValue, setDisplayValue] = useState(numericValue ?? value);

  useEffect(() => {
    if (!Number.isFinite(numericValue)) {
      setDisplayValue(value);
      return undefined;
    }

    const start = performance.now();
    let frame = 0;

    const tick = (timestamp) => {
      const progress = Math.min((timestamp - start) / (duration * 1000), 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = numericValue * easedProgress;

      setDisplayValue(Number(nextValue.toFixed(decimals)));

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [decimals, duration, numericValue, value]);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return formatter(Number(displayValue || 0));
}
