import twilio from "twilio";

let client: twilio.Twilio | null = null;

export function getTwilioClient(): twilio.Twilio {
  if (!client) {
    client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }
  return client;
}

export async function sendWhatsAppMessage(
  to: string,
  body: string
): Promise<void> {
  const client = getTwilioClient();
  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER!,
    to,
    body,
  });
}