import { NextResponse } from "next/server.js";
import connectDB from "../../../shared/lib/db/mongodb.js";
import WebhookEvent from "../../../shared/models/WebhookEvent.js";
import { inboundMessageQueue } from "../../../server/queues/queueManager.js";
import { validateTwilioWebhookSignature } from "../../../shared/utils/twilioValidator.js";

export const dynamic = "force-dynamic";

const TWILIO_XML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twilioResponse(status = 200) {
  return new NextResponse(TWILIO_XML, {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

async function parseTwilioBody(req) {
  let body = {};
  const contentType = req.headers.get("content-type") || "";
  const rawText = await req.text();

  if (rawText) {
    if (contentType.includes("application/json")) {
      try {
        body = JSON.parse(rawText);
      } catch {
        body = Object.fromEntries(new URLSearchParams(rawText).entries());
      }
    } else {
      body = Object.fromEntries(new URLSearchParams(rawText).entries());
    }
  }

  if (Object.keys(body).length === 0) {
    const url = new URL(req.url);
    body = Object.fromEntries(url.searchParams.entries());
  }

  return body;
}

export async function POST(req) {
  try {
    const body = await parseTwilioBody(req);
    const twilioSid = body.MessageSid || body.sid || "";
    const fromPhone = body.From || body.from || "";
    const rawTo = body.To || body.to || "";
    const rawMessage = body.Body || body.body || "";
    const messageText = rawMessage.replace(/\\n/g, "\n");
    let numMedia = parseInt(body.NumMedia || body.numMedia || "0", 10);
    if (isNaN(numMedia)) numMedia = 0;
    const profileName = body.ProfileName || body.profileName || "";

    console.log(`[WEBHOOK-INBOUND] received | MessageSid: ${twilioSid} | From: ${fromPhone} | To: ${rawTo}`);

    // 1. Validate Twilio Signature
    const isValidSignature = validateTwilioWebhookSignature(req, body);
    console.log(`[WEBHOOK-INBOUND] signature: ${isValidSignature ? "VALID" : "INVALID"}`);
    if (!isValidSignature) {
      console.warn("🚫 [WEBHOOK] Unauthorized request: Invalid Twilio signature.");
      return twilioResponse(403);
    }

    // 2. Validate Required Fields
    if (!fromPhone || (!messageText && numMedia === 0)) {
      return twilioResponse(200);
    }

    // 3. Atomic Database-Safe Idempotency Check
    await connectDB();
    if (twilioSid) {
      try {
        await WebhookEvent.create({
          provider: "twilio",
          eventId: twilioSid,
          eventType: "inbound_whatsapp",
          payload: body,
          status: "queued",
          receivedAt: new Date(),
        });
        console.log(`[WEBHOOK-INBOUND] WebhookEvent created | eventId: ${twilioSid}`);
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate delivery caught by unique compound index { provider: 1, eventId: 1 }
          console.log(`[WEBHOOK-INBOUND] duplicate event ignored | eventId: ${twilioSid}`);
          return twilioResponse(200);
        }
        throw err;
      }
    }

    // 4. Enqueue Durable BullMQ Job with Deterministic Job ID
    const sanitizedSid = (twilioSid || String(Date.now())).replace(/[:]/g, "_");
    const deterministicJobId = `inbound-msg_${sanitizedSid}`;
    await inboundMessageQueue.add(
      "process-inbound",
      {
        twilioSid,
        fromPhone,
        rawTo,
        messageText,
        numMedia,
        profileName,
        body,
      },
      {
        jobId: deterministicJobId,
      }
    );
    console.log(`[WEBHOOK-INBOUND] inbound job queued | jobId: ${deterministicJobId}`);

    // 5. Fast Synchronous Return
    return twilioResponse(200);
  } catch (error) {
    console.error("❌ [WEBHOOK] Ingestion failure:", error.message);
    return twilioResponse(500);
  }
}
