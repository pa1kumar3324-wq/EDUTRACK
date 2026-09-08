"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { motion } from "framer-motion";

/** Animated count-up stat value. Snaps instantly if the person prefers reduced motion. */
export function AnimatedNumber({
  value,
  className,
  suffix = "",
  duration = 0.8,
}: {
  value: number;
  className?: string;
  suffix?: string;
  duration?: number;
}) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v).toLocaleString());
  const prevValue = useRef(0);

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      prevValue.current = value;
      return;
    }
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
    });
    prevValue.current = value;
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotion]);

  return (
    <span className={className}>
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}
