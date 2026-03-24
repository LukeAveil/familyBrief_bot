import "dotenv/config";
import express, { Request, Response } from "express";
import { parseMediaToEvents } from "./lib/anthropic";
import { sendWhatsAppMessage } from "./lib/twilio";
import {
  buildReplyMessage,
  buildErrorMessage,
  buildNonMediaMessage,
  buildUnsupportedFileMessage,
} from "./lib/messages";

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

  try {
    const from: string = req.body.From;
    const numMedia = parseInt(req.body.NumMedia || "0", 10);
    const mediaUrl: string | undefined = req.body.MediaUrl0;
    const mediaType: string | undefined = req.body.MediaContentType0;

    console.log(`From: ${from} | Media: ${numMedia} | Type: ${mediaType}`);

    // No attachment sent
    if (numMedia === 0 || !mediaUrl || !mediaType) {
      await sendWhatsAppMessage(from, buildNonMediaMessage());
      return;
    }

    // Unsupported file type
    const isSupported = SUPPORTED_TYPES.some((t) =>
      mediaType.toLowerCase().includes(t.split("/")[1])
    );
    if (!isSupported) {
      await sendWhatsAppMessage(from, buildUnsupportedFileMessage(mediaType));
      return;
    }

    // Let the user know we are working on it
    const isPdf = mediaType.includes("pdf");
    await sendWhatsAppMessage(
      from,
      isPdf ? "Reading your PDF... ⏳" : "Reading your photo... ⏳"
    );

    // Parse with Claude
    const result = await parseMediaToEvents(
      mediaUrl,
      mediaType,
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );

    if (result.error && result.events.length === 0) {
      await sendWhatsAppMessage(from, buildErrorMessage());
      return;
    }

    await sendWhatsAppMessage(from, buildReplyMessage(result.events));

  } catch (error) {
    console.error("Webhook error:", error);
    try {
      await sendWhatsAppMessage(req.body.From, buildErrorMessage());
    } catch {
      // nothing we can do
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FamilyBrief bot running on port ${PORT}`);
  console.log(`Webhook: http://localhost:${PORT}/webhook`);
  console.log(`Health: http://localhost:${PORT}/health`);
});