import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { ExtractedEvent, ParseResult } from "../types";
import { log } from "./logger";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function downloadTwilioMedia(
  url: string,
  accountSid: string,
  authToken: string
): Promise<{ base64: string; mediaType: string; bytes: number }> {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    auth: { username: accountSid, password: authToken },
  });
  const buffer = Buffer.from(response.data, "binary");
  const base64 = buffer.toString("base64");
  const mediaType = response.headers["content-type"] || "image/jpeg";
  return { base64, mediaType, bytes: buffer.length };
}

const EXTRACTION_PROMPT = `You are a helpful assistant that extracts calendar
events from school letters, newsletters, and activity schedules for parents.

Look at this document and extract ALL events, deadlines, and important dates.

Today's date is ${new Date().toISOString().split("T")[0]}.

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

const MODEL = "claude-sonnet-4-20250514";

export async function parseMediaToEvents(
  mediaUrl: string,
  mediaType: string,
  accountSid: string,
  authToken: string,
  requestId?: string
): Promise<ParseResult> {
  const reqId = requestId ?? "unknown";

  try {
    log("INFO", "media_download_start", { reqId, url: mediaUrl, mediaType });
    const t0 = Date.now();
    const { base64, mediaType: confirmedType, bytes } = await downloadTwilioMedia(
      mediaUrl,
      accountSid,
      authToken
    );
    log("INFO", "media_download_complete", {
      reqId,
      bytes,
      confirmedType,
      durationMs: Date.now() - t0,
    });

    const isPdf = confirmedType.includes("pdf") || mediaType.includes("pdf");
    const contentType = isPdf ? "document" : "image";

    let messageContent: Anthropic.MessageParam["content"];

    if (isPdf) {
      messageContent = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        } as Anthropic.Messages.DocumentBlockParam,
        { type: "text", text: EXTRACTION_PROMPT },
      ];
    } else {
      const validImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      const safeMediaType = validImageTypes.includes(confirmedType)
        ? (confirmedType as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
        : "image/jpeg";

      messageContent = [
        {
          type: "image",
          source: { type: "base64", media_type: safeMediaType, data: base64 },
        },
        { type: "text", text: EXTRACTION_PROMPT },
      ];
    }

    log("INFO", "claude_request_start", { reqId, model: MODEL, contentType });
    const t1 = Date.now();
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
      durationMs: Date.now() - t1,
    });

    const raw =
      response.content[0].type === "text" ? response.content[0].text : "[]";
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
}
