import { useState, useEffect } from "react";

/**
 * Custom hook to debounce a value.
 * @param {any} value - The value to debounce.
 * @param {number} delay - Delay in milliseconds.
 * @returns {any} - The debounced value.
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set debouncedValue to value (passed in) after the specified delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Return a cleanup function that will be called every time useEffect is re-called.
    // useEffect will only be re-called if value or delay changes.
    // This is how we prevent debouncedValue from updating if value is changed within the delay period.
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
