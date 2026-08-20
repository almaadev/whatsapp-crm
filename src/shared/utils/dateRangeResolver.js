export function getISTCalendarDateString(dateInput) {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "";
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(istDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function calculateFollowUpCalendarDay(followUpCreatedDate, currentDate = new Date()) {
  if (!followUpCreatedDate) return 1;
  const startStr = getISTCalendarDateString(followUpCreatedDate);
  const currentStr = getISTCalendarDateString(currentDate);
  if (!startStr || !currentStr) return 1;

  const startUtc = new Date(startStr + "T00:00:00Z").getTime();
  const currentUtc = new Date(currentStr + "T00:00:00Z").getTime();

  const diffDays = Math.floor((currentUtc - startUtc) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return 1;
  if (diffDays === 1) return 2;
  return 3; // Day 3 or higher
}

export function getOperationalDateBounds(dateRange, customStart, customEnd) {
  const now = new Date();
  
  // IST offset is UTC+05:30. Offset in milliseconds is 5.5 hours.
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  
  const getISTMidnight = (date) => {
    // Get components of the date shifted by the IST offset
    const istDate = new Date(date.getTime() + istOffsetMs);
    const y = istDate.getUTCFullYear();
    const m = istDate.getUTCMonth();
    const d = istDate.getUTCDate();
    
    // Construct midnight of that day in UTC, then subtract the offset to get the UTC Date representing IST midnight
    return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - istOffsetMs);
  };

  let startDate = null;
  let endDate = null;

  const todayStart = getISTMidnight(now);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1); // 23:59:59.999

  switch (dateRange) {
    case "today":
      startDate = todayStart;
      endDate = todayEnd;
      break;
    case "yesterday":
      startDate = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      endDate = new Date(todayEnd.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "thisWeek": {
      const istDate = new Date(now.getTime() + istOffsetMs);
      const dayOfWeek = istDate.getUTCDay(); // Sunday is 0, Monday is 1...
      
      startDate = new Date(todayStart.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
      endDate = todayEnd;
      break;
    }
    case "7days":
    case "last7days":
      startDate = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
      endDate = todayEnd;
      break;
    case "30days":
    case "last30days":
      startDate = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);
      endDate = todayEnd;
      break;
    case "thisMonth": {
      const istDate = new Date(now.getTime() + istOffsetMs);
      const y = istDate.getUTCFullYear();
      const m = istDate.getUTCMonth();
      startDate = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - istOffsetMs);
      endDate = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999) - istOffsetMs);
      break;
    }
    case "lastMonth": {
      const istDate = new Date(now.getTime() + istOffsetMs);
      const y = istDate.getUTCFullYear();
      const m = istDate.getUTCMonth();
      startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0) - istOffsetMs);
      endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999) - istOffsetMs);
      break;
    }
    case "custom": {
      if (customStart) {
        const parts = String(customStart).split("-");
        if (parts.length === 3) {
          const [y, m, d] = parts.map(Number);
          startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - istOffsetMs);
        } else {
          startDate = new Date(customStart);
          startDate.setHours(0, 0, 0, 0);
        }
      }
      if (customEnd) {
        const parts = String(customEnd).split("-");
        if (parts.length === 3) {
          const [y, m, d] = parts.map(Number);
          endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - istOffsetMs);
        } else {
          endDate = new Date(customEnd);
          endDate.setHours(23, 59, 59, 999);
        }
      }
      break;
    }
    default: {
      // Default to this month
      const istDate = new Date(now.getTime() + istOffsetMs);
      const y = istDate.getUTCFullYear();
      const m = istDate.getUTCMonth();
      startDate = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - istOffsetMs);
      endDate = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999) - istOffsetMs);
      break;
    }
  }

  return { startDate, endDate };
}

/**
 * Format timestamp to IST Time (e.g., 04:30:15 PM)
 */
export function formatISTTime(dateInput) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/**
 * Format timestamp to IST Date (e.g., 19 Aug 2026)
 */
export function formatISTDate(dateInput) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
