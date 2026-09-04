import express from "express";
import { config } from "./config";
import { generateReply } from "./agent";
import { isValidSignature, markMessageRead, parseInboundMessages, sendWhatsAppMessage } from "./whatsapp";

const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);

// Meta calls this once, when you register the webhook URL in the App Dashboard.
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsappVerifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Meta calls this for every inbound message, delivery status, etc.
app.post("/webhook", async (req, res) => {
  const signature = req.header("x-hub-signature-256");
  if (!isValidSignature((req as any).rawBody, signature)) {
    res.sendStatus(401);
    return;
  }

  // Acknowledge immediately; Meta retries if a 2xx isn't returned quickly.
  res.sendStatus(200);

  for (const message of parseInboundMessages(req.body)) {
    try {
      await markMessageRead(message.id);
      const reply = await generateReply(message.from, message.text);
      await sendWhatsAppMessage(message.from, reply);
    } catch (error) {
      console.error(`Failed to handle message ${message.id}:`, error);
    }
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`WhatsApp agent listening on port ${config.port}`);
});
