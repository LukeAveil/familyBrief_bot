/**
 * A single calendar event extracted from a school document.
 */
export interface ExtractedEvent {
  /** Human-readable event name. */
  title: string;
  /** Start date in YYYY-MM-DD format. */
  date: string;
  /** End date for multi-day events, YYYY-MM-DD. */
  endDate?: string;
  /** Start time in 24-hour HH:MM format. */
  time?: string;
  /** End time in 24-hour HH:MM format. */
  endTime?: string;
  /** Physical location or venue. */
  location?: string;
  /** Extra context parents need to know. */
  description?: string;
  /** Broad classification for display purposes. */
  category: "school" | "activity" | "medical" | "social" | "other";
}

/**
 * Result returned by the Claude extraction pipeline.
 * `events` is always present (may be empty). `error` is set when something
 * went wrong; `rawText` preserves the raw model response for debugging.
 */
export interface ParseResult {
  events: ExtractedEvent[];
  /** Raw model output — only populated on a JSON parse failure. */
  rawText?: string;
  /** Human-readable error description. */
  error?: string;
}
