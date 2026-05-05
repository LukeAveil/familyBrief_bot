import "dotenv/config";
import crypto from "crypto";
import express, { Request, Response } from "express";
import { parseMediaToEvents } from "./lib/anthropic";
import { downloadMedia, sendWhatsAppMessage } from "./lib/twilio";
import {
  buildReplyMessage,
  buildErrorMessage,
  buildNonMediaMessage,
  buildUnsupportedFileMessage,
} from "./lib/messages";
import { log } from "./lib/logger";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const SUPPORTED_TYPES = [
  "image/jpeg", "image/jpg", "image/png",
  "image/webp", "image/gif", "image/heic", "image/heif",
  "application/pdf",
];

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/webhook", async (req: Request, res: Response) => {
  // Respond immediately — Twilio expects 200 within a few seconds
  res.status(200).send("<Response></Response>");

  const reqId = crypto.randomUUID().slice(0, 8);

  try {
    const from: string = req.body.From;
    const numMedia = parseInt(req.body.NumMedia || "0", 10);
    const mediaUrl: string | undefined = req.body.MediaUrl0;
    const mediaType: string | undefined = req.body.MediaContentType0;

    log("INFO", "webhook_received", { reqId, from, numMedia, mediaType });

    if (numMedia === 0 || !mediaUrl || !mediaType) {
      log("INFO", "no_media", { reqId, from });
      await sendWhatsAppMessage(from, buildNonMediaMessage());
      return;
    }

    const isSupported = SUPPORTED_TYPES.some((t) =>
      mediaType.toLowerCase().includes(t.split("/")[1])
    );
    if (!isSupported) {
      log("WARN", "unsupported_type", { reqId, from, mediaType });
      await sendWhatsAppMessage(from, buildUnsupportedFileMessage(mediaType));
      return;
    }

    const isPdf = mediaType.includes("pdf");
    log("INFO", "processing_start", { reqId, from, contentType: isPdf ? "document" : "image" });
    await sendWhatsAppMessage(
      from,
      isPdf ? "Reading your PDF... ⏳" : "Reading your photo... ⏳"
    );

    const { base64, mediaType: confirmedType } = await downloadMedia(mediaUrl, reqId);
    const result = await parseMediaToEvents(base64, confirmedType, reqId);

    if (result.error && result.events.length === 0) {
      log("WARN", "parse_failed", { reqId, error: result.error });
      await sendWhatsAppMessage(from, buildErrorMessage());
      return;
    }

    const chunks = buildReplyMessage(result.events);
    for (const chunk of chunks) {
      await sendWhatsAppMessage(from, chunk);
    }
    log("INFO", "whatsapp_sent", { reqId, to: from, eventCount: result.events.length, chunks: chunks.length });

  } catch (error) {
    log("ERROR", "webhook_error", { reqId, message: String(error) });
    try {
      await sendWhatsAppMessage(req.body.From, buildErrorMessage());
    } catch {
      // nothing we can do
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log("INFO", "server_start", { port: PORT, webhook: `http://localhost:${PORT}/webhook` });
});
