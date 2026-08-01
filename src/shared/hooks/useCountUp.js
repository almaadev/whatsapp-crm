"use client";

import { useState, useEffect } from "react";

export function useCountUp(end, duration = 1000) {
  // Check if end is numeric or can be parsed as a number.
  const isNumeric =
    typeof end === "number" ||
    (typeof end === "string" && !isNaN(Number(end)) && end.trim() !== "");
  const numericEnd = isNumeric ? Number(end) : 0;
  const [count, setCount] = useState(isNumeric ? 0 : end);

  useEffect(() => {
    if (!isNumeric) {
      setCount(end);
      return;
    }
    let startTime = null;
    let animationFrameId;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * numericEnd));
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [end, numericEnd, isNumeric, duration]);

  return count;
}

export function AnimatedCount({ end, duration }) {
  const count = useCountUp(end, duration);
  return <>{count}</>;
}
