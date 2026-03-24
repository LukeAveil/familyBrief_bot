import { ExtractedEvent } from "../types";

// Build a pre-filled Google Calendar URL — no OAuth needed
export function buildGoogleCalendarUrl(event: ExtractedEvent): string {
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
}

export function formatFriendlyDate(event: ExtractedEvent): string {
  const date = new Date(event.date + "T12:00:00");
  const dayName = date.toLocaleDateString("en-GB", { weekday: "long" });
  const dayNum = date.getDate();
  const month = date.toLocaleDateString("en-GB", { month: "long" });
  const dateStr = `${dayName} ${dayNum} ${month}`;
  return event.time ? `${dateStr} at ${formatTime(event.time)}` : dateStr;
}

function formatGCalDateTime(date: string, time: string): string {
  const d = date.replace(/-/g, "");
  const t = time.replace(":", "") + "00";
  return `${d}T${t}`;
}

function addHour(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const newHours = (hours + 1) % 24;
  return `${String(newHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function incrementDate(dateStr: string): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split("T")[0];
}

function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const hours12 = hours % 12 || 12;
  return minutes === 0
    ? `${hours12}${period}`
    : `${hours12}:${String(minutes).padStart(2, "0")}${period}`;
}