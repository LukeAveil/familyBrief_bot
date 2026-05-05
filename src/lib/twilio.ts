import twilio from "twilio";
import axios from "axios";
import { log } from "./logger";

/** Lazy-initialised Twilio client — credentials read from env on first call. */
const getTwilioClient = (): twilio.Twilio => {
  if (!getTwilioClient._instance) {
    getTwilioClient._instance = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }
  return getTwilioClient._instance;
};
getTwilioClient._instance = null as twilio.Twilio | null;

export interface DownloadedMedia {
  /** Base64-encoded file contents. */
  base64: string;
  /** MIME type confirmed by the Content-Type response header. */
  mediaType: string;
  /** Raw byte size of the downloaded file. */
  bytes: number;
}

/**
 * Download a Twilio-hosted media file using HTTP basic auth.
 * Logs download start, completion, and timing.
 * @param url - The Twilio media URL (`MediaUrl0` from the webhook body).
 * @param reqId - Correlation ID for structured logging.
 */
export const downloadMedia = async (url: string, reqId: string): Promise<DownloadedMedia> => {
  log("INFO", "media_download_start", { reqId, url });
  const t0 = Date.now();

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    auth: {
      username: process.env.TWILIO_ACCOUNT_SID!,
      password: process.env.TWILIO_AUTH_TOKEN!,
    },
  });

  const buffer = Buffer.from(response.data, "binary");
  const base64 = buffer.toString("base64");
  const mediaType = (response.headers["content-type"] as string) || "image/jpeg";

  log("INFO", "media_download_complete", {
    reqId,
    bytes: buffer.length,
    confirmedType: mediaType,
    durationMs: Date.now() - t0,
  });

  return { base64, mediaType, bytes: buffer.length };
};

/**
 * Send a WhatsApp message via Twilio.
 * @param to - Recipient in `whatsapp:+44...` format.
 * @param body - Message text (max 1600 chars per WhatsApp limit).
 */
export const sendWhatsAppMessage = async (to: string, body: string): Promise<void> => {
  const client = getTwilioClient();
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER!,
    to,
    body,
  });
};
