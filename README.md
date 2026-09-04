# WhatsApp Agent Kit

A minimal starter kit for building a Claude-powered agent on top of the
[WhatsApp Business Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started).
It wires up a webhook that receives WhatsApp messages, runs them through
Claude (including a tool-use loop), and sends the reply back — with a
short per-user conversation history kept in memory.

## How it works

```
WhatsApp user  →  Meta Cloud API  →  POST /webhook  →  Claude (agent.ts)  →  WhatsApp send API
```

- `src/server.ts` — Express app exposing the webhook (`GET` for Meta's
  verification handshake, `POST` for inbound messages) and a `/health` check.
- `src/whatsapp.ts` — parses inbound webhook payloads, verifies the
  `X-Hub-Signature-256` header, and sends outbound messages via the Graph API.
- `src/agent.ts` — the Claude agent loop: keeps a short rolling history per
  WhatsApp sender, calls the Messages API, and executes any tool calls Claude
  requests before returning a final reply.
- `src/tools.ts` — example tool (`get_current_time`) showing how to add more.
  Add a new entry to `toolDefinitions` and `toolHandlers` to give the agent a
  new capability.

Conversation history is kept in an in-memory `Map`, which is fine for local
testing but will not survive a restart or scale across multiple server
instances — swap it for a database or Redis for production use.

## Setup

1. **Install dependencies**

   ```
   npm install
   ```

2. **Configure environment variables**

   ```
   cp .env.example .env
   ```

   - `ANTHROPIC_API_KEY` — from the [Anthropic Console](https://console.anthropic.com/).
   - `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` — from a
     [Meta app](https://developers.facebook.com/apps/) with the WhatsApp
     product added.
   - `WHATSAPP_VERIFY_TOKEN` — any string you choose; enter the same value
     when configuring the webhook in the Meta App Dashboard.
   - `WHATSAPP_APP_SECRET` — optional but recommended; enables signature
     verification on inbound webhooks.

3. **Run locally**

   ```
   npm run dev
   ```

   Expose it publicly (e.g. `ngrok http 3000`) and register
   `https://<your-tunnel>/webhook` as the webhook URL in the Meta App
   Dashboard, subscribing to the `messages` field.

4. **Build for production**

   ```
   npm run build
   npm start
   ```

## Extending the agent

- **Add a tool**: define it in `toolDefinitions` and implement its handler in
  `toolHandlers` (`src/tools.ts`) — e.g. looking up order status, scheduling
  a meeting, or querying a database.
- **Persist conversations**: replace the `Map` in `src/agent.ts` with a
  database-backed store keyed by WhatsApp sender ID.
- **Support media**: extend `parseInboundMessages` in `src/whatsapp.ts` to
  handle `image`, `audio`, or `document` message types in addition to `text`.
