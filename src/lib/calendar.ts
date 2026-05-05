import { ExtractedEvent } from "../types";

/** Format a YYYY-MM-DD + HH:MM pair into the compact Google Calendar datetime string. */
const formatGCalDateTime = (date: string, time: string): string => {
  const d = date.replace(/-/g, "");
  const t = time.replace(":", "") + "00";
  return `${d}T${t}`;
};

/** Increment a YYYY-MM-DD date by one day (used for all-day event end dates). */
const incrementDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
};

/** Add one hour to a HH:MM time string, wrapping at midnight. */
const addHour = (time: string): string => {
  const [hours, minutes] = time.split(":").map(Number);
  const newHours = (hours + 1) % 24;
  return `${String(newHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

/** Convert a 24-hour HH:MM string to a human-friendly 12-hour format, e.g. `"9am"`, `"2:30pm"`. */
const formatTime = (time24: string): string => {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const hours12 = hours % 12 || 12;
  return minutes === 0
    ? `${hours12}${period}`
    : `${hours12}:${String(minutes).padStart(2, "0")}${period}`;
};

/**
 * Build a pre-filled Google Calendar URL for an event.
 * Uses the TEMPLATE action — no OAuth required, opens directly in the browser.
 */
export const buildGoogleCalendarUrl = (event: ExtractedEvent): string => {
  const base = "https://calendar.google.com/calendar/render";

  let dates: string;
  if (event.time) {
    const start = formatGCalDateTime(event.date, event.time);
    const end = event.endTime
      ? formatGCalDateTime(event.endDate || event.date, event.endTime)
      : formatGCalDateTime(event.date, addHour(event.time));
    dates = `${start}/${end}`;
  } else {
    const start = event.date.replace(/-/g, "");
    const end = event.endDate
      ? incrementDate(event.endDate).replace(/-/g, "")
      : incrementDate(event.date).replace(/-/g, "");
    dates = `${start}/${end}`;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    ...(event.location && { location: event.location }),
    ...(event.description && { details: event.description }),
  });

  return `${base}?${params.toString()}`;
};

/**
 * Format an event's date (and optional time) as a friendly English string,
 * e.g. `"Thursday 20 March"` or `"Thursday 20 March at 9am"`.
 */
export const formatFriendlyDate = (event: ExtractedEvent): string => {
  const date = new Date(event.date + "T12:00:00");
  const dayName = date.toLocaleDateString("en-GB", { weekday: "long" });
  const dayNum = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  const dateStr = `${dayName} ${dayNum} ${month}`;
  return event.time ? `${dateStr} at ${formatTime(event.time)}` : dateStr;
};
