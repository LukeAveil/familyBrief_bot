import Anthropic from "@anthropic-ai/sdk";
import { ExtractedEvent, ParseResult } from "../types";
import { log } from "./logger";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MODEL = "claude-sonnet-4-20250514";

/**
 * Build the extraction prompt with today's date injected at call time
 * so the date never goes stale on long-running servers.
 */
const buildExtractionPrompt = (): string => {
  const today = new Date().toISOString().split("T")[0];
  return `You are a helpful assistant that extracts calendar events from school letters, newsletters, and activity schedules for parents.

Look at this document and extract ALL events, deadlines, and important dates.

Today's date is ${today}.

For each event found, extract:
- title: clear, concise event name
- date: YYYY-MM-DD format (infer the year if not shown — use next upcoming)
- endDate: YYYY-MM-DD if multi-day (optional)
- time: HH:MM in 24hr format (optional)
- endTime: HH:MM in 24hr format (optional)
- location: where it takes place (optional)
- description: any important details parents need to know (optional)
- category: one of school|activity|medical|social|other

Respond ONLY with a valid JSON array. No preamble, no explanation.
If no events are found, return an empty array [].`;
};

/**
 * Extract calendar events from a base64-encoded image or PDF using Claude.
 * This function is Twilio-agnostic — it only handles the Claude API call.
 *
 * @param base64 - Base64-encoded file contents.
 * @param confirmedType - MIME type of the file (e.g. `"application/pdf"`, `"image/jpeg"`).
 * @param reqId - Optional correlation ID for structured logging.
 */
export const parseMediaToEvents = async (
  base64: string,
  confirmedType: string,
  reqId = "unknown"
): Promise<ParseResult> => {
  const isPdf = confirmedType.includes("pdf");
  const contentType = isPdf ? "document" : "image";

  let messageContent: Anthropic.MessageParam["content"];

  if (isPdf) {
    messageContent = [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: base64 },
      } as Anthropic.Messages.DocumentBlockParam,
      { type: "text", text: buildExtractionPrompt() },
    ];
  } else {
    const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
    type ValidImageType = typeof validImageTypes[number];
    const safeMediaType: ValidImageType = (validImageTypes as readonly string[]).includes(confirmedType)
      ? (confirmedType as ValidImageType)
      : "image/jpeg";

    messageContent = [
      {
        type: "image",
        source: { type: "base64", media_type: safeMediaType, data: base64 },
      },
      { type: "text", text: buildExtractionPrompt() },
    ];
  }

  log("INFO", "claude_request_start", { reqId, model: MODEL, contentType });
  const t0 = Date.now();

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: messageContent }],
    });

    log("INFO", "claude_response", {
      reqId,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason,
      durationMs: Date.now() - t0,
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    // Strip markdown code fences that Claude sometimes adds despite the prompt
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    try {
      const events = JSON.parse(text) as ExtractedEvent[];
      const categories = [...new Set(events.map((e) => e.category))];
      log("INFO", "events_extracted", { reqId, count: events.length, categories });
      return { events };
    } catch {
      log("WARN", "claude_parse_error", { reqId, rawTextLength: text.length, rawText: text.slice(0, 200) });
      return { events: [], error: "Could not parse response", rawText: text };
    }
  } catch (error: unknown) {
    const status = (error as { status?: number }).status;
    const message = (error as { message?: string }).message ?? String(error);
    log("ERROR", "claude_api_error", { reqId, status, message });
    return { events: [], error: String(error) };
  }
};
