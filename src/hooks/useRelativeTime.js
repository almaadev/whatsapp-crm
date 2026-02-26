"use client";
import { useState, useEffect } from "react";

export function useRelativeTime(timestamp) {
  const [timeString, setTimeString] = useState("");

  useEffect(() => {
    if (!timestamp) return;

    const updateTime = () => {
      const now = new Date();
      const date = new Date(timestamp);
      const diff = Math.floor((now - date) / 1000);

      // 1. Just Now (Less than 30 seconds)
      if (diff < 30) {
        setTimeString("Just now");
        return;
      }

      // 2. Seconds (Less than 1 minute)
      if (diff < 60) {
        setTimeString(`${diff} seconds ago`);
        return;
      }

      // 3. Minutes (Less than 1 hour)
      if (diff < 3600) {
        const mins = Math.floor(diff / 60);
        setTimeString(`${mins} ${mins === 1 ? "minute" : "minutes"} ago`);
        return;
      }

      // 4. Hours (Less than 24 hours)
      if (diff < 86400) {
        const hours = Math.floor(diff / 3600);
        setTimeString(`${hours} ${hours === 1 ? "hour" : "hours"} ago`);
        return;
      }

      // 5. Yesterday
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      if (
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()
      ) {
        setTimeString(`Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        return;
      }

      // 6. Older Dates (e.g., "Oct 24, 2025")
      setTimeString(
        date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      );
    };

    updateTime();

    // Update every 60 seconds automatically
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, [timestamp]);

  return timeString;
}