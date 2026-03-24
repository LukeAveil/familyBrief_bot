export interface ExtractedEvent {
  title: string;
  date: string;        // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD for multi-day events
  time?: string;       // HH:MM in 24hr
  endTime?: string;    // HH:MM in 24hr
  location?: string;
  description?: string;
  category: "school" | "activity" | "medical" | "social" | "other";
}

export interface ParseResult {
  events: ExtractedEvent[];
  rawText?: string;
  error?: string;
}
