import { ExtractedEvent } from "../types";
import { buildGoogleCalendarUrl, formatFriendlyDate } from "./calendar";

const CATEGORY_EMOJI: Record<string, string> = {
  school: "🎒",
  activity: "⚽",
  medical: "🏥",
  social: "🎉",
  other: "📌",
};

const MAX_CHARS = 1500;

function buildEventBlock(event: ExtractedEvent, index: number): string {
  const emoji = CATEGORY_EMOJI[event.category] || "📌";
  const calUrl = buildGoogleCalendarUrl(event);
  const dateStr = formatFriendlyDate(event);

  const lines = [
    `${index}. ${emoji} *${event.title}*`,
    `   📆 ${dateStr}`,
  ];
  if (event.location) lines.push(`   📍 ${event.location}`);
  if (event.description) lines.push(`   ℹ️ ${event.description}`);
  lines.push(`   ➕ Add to Google Calendar:`);
  lines.push(`   ${calUrl}`);
  return lines.join("\n");
}

export function buildReplyMessage(events: ExtractedEvent[]): string[] {
  if (events.length === 0) {
    return [
      "I couldn't find any events or dates in that document 🤔\n" +
      "Try sending a clearer photo or a different file. " +
      "Make sure the text is readable.",
    ];
  }

  const header =
    events.length === 1 ? "Found 1 event! 📅\n" : `Found ${events.length} events! 📅\n`;
  const footer = "\n_Powered by FamilyBrief_ 🗓️";
  const chunks: string[] = [];
  let current = header;

  events.forEach((event, i) => {
    const block = buildEventBlock(event, i + 1);
    const separator = current === header ? "" : "\n\n";
    const candidate = current + separator + block;

    const isLast = i === events.length - 1;
    const withFooter = isLast ? candidate + footer : candidate;

    if (withFooter.length > MAX_CHARS && current !== header) {
      chunks.push(current);
      current = block;
    } else {
      current = candidate;
    }

    if (isLast) {
      chunks.push(current + footer);
    }
  });

  return chunks;
}

export function buildErrorMessage(): string {
  return (
    "Sorry, something went wrong reading that file 😕\n" +
    "Please try again with a clearer photo or different file."
  );
}

export function buildNonMediaMessage(): string {
  return (
    "Hi! 👋 I'm the FamilyBrief bot.\n" +
    "Send me any of these and I'll extract the dates and " +
    "create Google Calendar links automatically:\n" +
    "📸 *Photo* of a school letter\n" +
    "🖼️ *Screenshot* of a school app or WhatsApp message\n" +
    "📄 *PDF* attached to a school email\n" +
    "Just send the file here!"
  );
}

export function buildUnsupportedFileMessage(mediaType: string): string {
  return (
    `Sorry, I can't read that file type yet 😕\n` +
    "I can handle:\n" +
    "📸 Photos (JPG, PNG, WebP, HEIC)\n" +
    "📄 PDF documents\n" +
    "🖼️ Screenshots (PNG, JPG)\n" +
    "Try sending one of those instead!"
  );
}