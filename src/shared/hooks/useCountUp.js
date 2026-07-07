"use client";

import { useState, useEffect } from "react";

export function useCountUp(end, duration = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return count;
}

export function AnimatedCount({ end, duration }) {
  const count = useCountUp(end, duration);
  return <>{count}</>;
}
