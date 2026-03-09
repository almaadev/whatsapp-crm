// src/hooks/useHumanDate.js
"use client";
import { useState, useEffect } from "react";

export function useHumanDate(timestamp) {
  const [formattedDate, setFormattedDate] = useState("");

  useEffect(() => {
    if (!timestamp) {
      setFormattedDate("N/A");
      return;
    }

    const date = new Date(timestamp);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      setFormattedDate(timestamp);
      return;
    }

    // Format to: "Mar 09, 2026, 01:03 PM"
    const readable = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
 
    }).format(date);

    setFormattedDate(readable);
  }, [timestamp]);

  return formattedDate; // Returns an empty string on the server, and the actual date on the client
}