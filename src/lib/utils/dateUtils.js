export function getMonthDateRange(month, year) {
  const m = month ? parseInt(month) : new Date().getUTCMonth() + 1;
  const y = year ? parseInt(year) : new Date().getUTCFullYear();

  const startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  
  return { startDate, endDate };
}

export function getTodayDateRange() {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  
  return { startDate, endDate };
}

export function getCustomDateRange(from, to) {
  let startDate, endDate;
  if (from) startDate = new Date(from);
  if (to) {
    endDate = new Date(to);
    endDate.setHours(23, 59, 59, 999);
  }
  return { startDate, endDate };
}
