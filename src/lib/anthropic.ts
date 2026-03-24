import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { ExtractedEvent, ParseResult } from "../types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Download media from Twilio — requires auth credentials
async function downloadTwilioMedia(
  url: string,
  accountSid: string,
  authToken: string
): Promise<{ base64: string; mediaType: string }> {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    auth: { username: accountSid, password: authToken },
  });
  const base64 = Buffer.from(response.data, "binary").toString("base64");
  const mediaType = response.headers["content-type"] || "image/jpeg";
  return { base64, mediaType };
}

// Shared extraction prompt for both images and PDFs
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

export async function parseMediaToEvents(
  mediaUrl: string,
  mediaType: string,
  accountSid: string,
  authToken: string
): Promise<ParseResult> {
  try {
    const { base64, mediaType: confirmedType } = await downloadTwilioMedia(
      mediaUrl,
      accountSid,
      authToken
    );

    const isPdf =
      confirmedType.includes("pdf") || mediaType.includes("pdf");

    let messageContent: Anthropic.MessageParam["content"];

    if (isPdf) {
      // PDF — use Claude native document type
      messageContent = [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        } as Anthropic.Messages.RequestDocumentBlock,
        { type: "text", text: EXTRACTION_PROMPT },
      ];
    } else {
      // Image — use Claude vision
      const validImageTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: messageContent }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "[]";

    try {
      const events = JSON.parse(text) as ExtractedEvent[];
      return { events };
    } catch {
      return { events: [], error: "Could not parse response", rawText: text };
    }
  } catch (error) {
    console.error("Claude API error:", error);
    return { events: [], error: String(error) };
  }
}