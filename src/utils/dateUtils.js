export const parseDate = (dateString) => {
  if (!dateString) return new Date(0);
  // Handle ISO format
  if (dateString.includes("T") || (dateString.includes("-") && dateString.includes(":"))) {
    return new Date(dateString);
  }
  // Handle DD/MM/YYYY HH:MM:SS
  const parts = dateString.split(" ");
  if (parts.length >= 2) {
    const dateParts = parts[0].split("/");
    const timeParts = parts[1].split(":");
    if (dateParts.length === 3) {
      return new Date(
        parseInt(dateParts[2]),
        parseInt(dateParts[0]) - 1,
        parseInt(dateParts[1]),
        parseInt(timeParts[0] || 0),
        parseInt(timeParts[1] || 0),
        parseInt(timeParts[2] || 0)
      );
    }
  }
  return new Date(dateString);
};

export const getFormattedTimestamp = () => {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { year: 'numeric', month: 'numeric', day: 'numeric' });
  const time = now.toLocaleTimeString("en-US", { hour12: false });
  return `${date} ${time}`;
};