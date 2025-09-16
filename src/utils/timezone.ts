/**
 * Timezone utility functions for consistent EST timezone handling
 */

const EST_TIMEZONE = "America/New_York";

/**
 * Format a date to EST timezone
 */
export function formatToEST(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: EST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...options,
  };

  return new Intl.DateTimeFormat("en-US", defaultOptions).format(dateObj);
}

/**
 * Format a date to EST date only (MM/DD/YYYY)
 */
export function formatDateToEST(date: Date | string): string {
  return formatToEST(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Format a date to EST time only (HH:MM:SS)
 */
export function formatTimeToEST(date: Date | string): string {
  return formatToEST(date, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Format a date to EST date and time (MM/DD/YYYY HH:MM:SS)
 */
export function formatDateTimeToEST(date: Date | string): string {
  return formatToEST(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Get current time in EST
 */
export function getCurrentESTTime(): Date {
  const now = new Date();
  const estTime = new Date(
    now.toLocaleString("en-US", { timeZone: EST_TIMEZONE })
  );
  return estTime;
}

/**
 * Get current timestamp in EST ISO string
 */
export function getCurrentESTISOString(): string {
  return getCurrentESTTime().toISOString();
}

/**
 * Convert a date to EST timezone
 */
export function toEST(date: Date | string): Date {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const estString = dateObj.toLocaleString("en-US", { timeZone: EST_TIMEZONE });
  return new Date(estString);
}

/**
 * Format relative time (e.g., "2 hours ago") in EST
 */
export function formatRelativeTimeToEST(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = getCurrentESTTime();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Just now";
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  } else if (diffInSeconds < 2592000) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  } else {
    return formatDateToEST(dateObj);
  }
}
