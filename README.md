# FamilyBrief Bot 🤖

> WhatsApp bot that reads school letters and generates Google Calendar links.

## What it does

1. Parent sends a photo or PDF of a school letter via WhatsApp
2. Claude AI reads the document and extracts all events and dates
3. Bot replies with a formatted list and one-tap Google Calendar links
4. Parent taps a link → event opens pre-filled in Google Calendar → Save

## Supports
- 📸 Photos of school letters (JPG, PNG, WebP, HEIC)
- 🖼️ Screenshots of school apps or WhatsApp messages
- 📄 PDFs attached to school emails

## Tech stack
- Express.js + TypeScript
- Twilio WhatsApp API (sandbox for dev, Business API for prod)
- Anthropic Claude API (vision + document reading)
- Google Calendar pre-filled URLs (no OAuth needed)

## Quick start

### 1. Install
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Add your Twilio and Anthropic keys
```

### 3. Set up Twilio sandbox
1. Sign up free at twilio.com
2. Go to Messaging → Try it out → Send a WhatsApp message
3. Join the sandbox by sending the join code to the sandbox number
4. In Sandbox Settings, set the webhook to your ngrok URL:
   https://your-ngrok-url.ngrok.io/webhook

### 4. Run locally
```bash
# Terminal 1 — start the server
npm run dev

# Terminal 2 — expose it publicly
npx ngrok http 3000
```

### 5. Test
Send a photo or PDF of any document with dates to the Twilio sandbox number.

## Deploy to Railway
1. Push to GitHub
2. Connect repo to Railway (railway.app)
3. Add environment variables in Railway dashboard
4. Railway auto-deploys on every push
5. Update Twilio webhook URL to your Railway URL

## Project structure
```
src/
├── index.ts              # Express server + webhook handler
├── types/index.ts        # TypeScript types
└── lib/
    ├── anthropic.ts      # Claude vision + PDF reading
    ├── calendar.ts       # Google Calendar URL builder
    ├── messages.ts       # WhatsApp reply formatting
    └── twilio.ts         # Twilio client
```

## Notes

### WhatsApp message length
WhatsApp caps messages at 1600 characters. A school newsletter with 7+ events — each with a description and a Google Calendar URL — blows straight past that.

The bot handles it by splitting the reply into multiple messages, each kept under 1500 characters. You'll get two or three messages back-to-back when there are a lot of events. The "Powered by FamilyBrief" footer only appears on the last one.

No action needed from the user — it just works.

## Example conversation

Parent sends a photo of a school letter.

Bot replies:
```
Found 2 events! 📅

1. 🎒 *Year 4 Science Museum Trip*
   📆 Thursday 20 March at 8:15am
   📍 Meet at school gates
   ℹ️ Packed lunch required. Return by 4pm.
   ➕ Add to Google Calendar:
   https://calendar.google.com/...

2. 🎒 *Permission Slip Deadline*
   📆 Wednesday 19 March
   ➕ Add to Google Calendar:
   https://calendar.google.com/...

_Powered by FamilyBrief_ 🗓️
```