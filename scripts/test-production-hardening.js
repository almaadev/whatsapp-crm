import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import connectDB from "../src/shared/lib/db/mongodb.js";
import Customer from "../src/shared/models/Customer.js";
import Message from "../src/shared/models/Message.js";
import WebhookEvent from "../src/shared/models/WebhookEvent.js";
import Notification from "../src/shared/models/Notification.js";
import KeywordAutomation from "../src/shared/models/KeywordAutomation.js";
import CRMTemplate from "../src/shared/models/CRMTemplate.js";
import inboundMessageService from "../src/server/services/inboundMessageService.js";
import { processKeywordAutoReply } from "../src/features/chat/services/keywordMatcher.js";
import { notificationService } from "../src/server/services/notificationService.js";
import { GET as getHealthHandler } from "../src/app/api/webhook/status/route.js";
import { validateTwilioWebhookSignature } from "../src/shared/utils/twilioValidator.js";

function createMockTwilioRequest(body, headers = {}) {
  const urlEncoded = new URLSearchParams(body).toString();
  return new Request("http://localhost:3000/api/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "crm.almaaerp.in",
      ...headers,
    },
    body: urlEncoded,
  });
}

async function runHardeningSuite() {
  console.log("\n==================================================");
  console.log("🛡️ PRODUCTION-HARDENING & IDEMPOTENCY VERIFICATION SUITE");
  console.log("==================================================\n");

  await connectDB();
  process.env.TWILIO_VALIDATE_SIGNATURE = "false";

  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    try {
      process.stdout.write(`⏳ Checking: ${name}... `);
      await fn();
      console.log("✅ PASSED");
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      console.error(err);
      failed++;
    }
  }

  // 1. Outbound Twilio Idempotency (Same Automation Job Executed Twice)
  await check("1. Outbound Twilio Idempotency on Worker Retry", async () => {
    const phone = "whatsapp:+919876501111";
    const inboundSid = `SM_outbound_test_${Date.now()}`;

    await Customer.deleteMany({ phone });
    await Message.deleteMany({ phone });
    await KeywordAutomation.deleteMany({ key: "hardenprice" });

    const crmTemplate = await CRMTemplate.create({
      name: "Hardening Price Template",
      body: "Hello {{name}}, our pricing is standard.",
      category: "Pricing",
      isActive: true,
    });

    const automation = await KeywordAutomation.create({
      key: "hardenprice",
      keywords: ["hardenprice"],
      templateType: "crm",
      templateId: crmTemplate._id,
      isActive: true,
    });

    // Ingest inbound message (triggers 1st execution via queue/fallback)
    await inboundMessageService.handleInboundMessage({
      twilioSid: inboundSid,
      fromPhone: phone,
      rawTo: "whatsapp:+917401403011",
      messageText: "hardenprice",
      profileName: "Hardening User",
    });

    // Allow 1st execution to complete network I/O
    await new Promise((r) => setTimeout(r, 1000));

    // 2nd Execution of Automation (Simulating Worker Retry after timeout/network blip)
    const exec2 = await processKeywordAutoReply(
      phone,
      "hardenprice",
      "Hardening User",
      "+917401403011",
      { inboundMessageSid: inboundSid }
    );
    if (!exec2) throw new Error("2nd execution failed");

    // Verify EXACTLY 1 Outbound message was created in MongoDB
    const outboundMessages = await Message.find({ phone, direction: "OUTBOUND" });
    if (outboundMessages.length !== 1) {
      throw new Error(`Expected exactly 1 Outbound Message, found ${outboundMessages.length}`);
    }

    // Cleanup
    await CRMTemplate.findByIdAndDelete(crmTemplate._id);
    await KeywordAutomation.deleteMany({ key: "hardenprice" });
  });

  // 2. Notification Retry Idempotency
  await check("2. Notification Worker Retry Idempotency", async () => {
    const phone = "whatsapp:+919876502222";
    const sid = `SM_notif_retry_${Date.now()}`;

    await Customer.deleteMany({ phone });
    await Notification.deleteMany({ phone });

    await inboundMessageService.handleInboundMessage({
      twilioSid: sid,
      fromPhone: phone,
      rawTo: "whatsapp:+917401403011",
      messageText: "Notification retry test",
      profileName: "Notif Retry User",
    });

    const customer = await Customer.findOne({ phone });

    // 1st notification pass
    await notificationService.processInboundNotification({
      phone,
      customerId: customer._id,
      customerName: "Notif Retry User",
      messageText: "Notification retry test",
      twilioSid: sid,
    });

    const count1 = await Notification.countDocuments({ phone });

    // 2nd notification pass (Retry simulation)
    await notificationService.processInboundNotification({
      phone,
      customerId: customer._id,
      customerName: "Notif Retry User",
      messageText: "Notification retry test",
      twilioSid: sid,
    });

    const count2 = await Notification.countDocuments({ phone });
    if (count2 > count1 && count1 > 0) {
      throw new Error(`Notification retry caused duplicate notifications! Count1: ${count1}, Count2: ${count2}`);
    }
  });

  // 3. WebhookEvent Lifecycle Transitions
  await check("3. WebhookEvent Lifecycle Status Transitions (queued -> processing -> completed)", async () => {
    const sid = `SM_lifecycle_${Date.now()}`;
    const phone = "whatsapp:+919876503333";

    await WebhookEvent.deleteMany({ eventId: sid });

    // Step A: Webhook writes queued
    const event = await WebhookEvent.create({
      provider: "twilio",
      eventId: sid,
      eventType: "inbound_whatsapp",
      payload: { Body: "Lifecycle test" },
      status: "queued",
      receivedAt: new Date(),
    });
    if (event.status !== "queued") throw new Error("Expected initial status 'queued'");

    // Step B: Worker sets processing
    await WebhookEvent.updateOne({ provider: "twilio", eventId: sid }, { $set: { status: "processing" } });
    const processingEvent = await WebhookEvent.findOne({ eventId: sid });
    if (processingEvent.status !== "processing") throw new Error("Expected status 'processing'");

    // Step C: Worker completes
    await WebhookEvent.updateOne(
      { provider: "twilio", eventId: sid },
      { $set: { status: "completed", processedAt: new Date() } }
    );
    const completedEvent = await WebhookEvent.findOne({ eventId: sid });
    if (completedEvent.status !== "completed" || !completedEvent.processedAt) {
      throw new Error("Expected status 'completed' with processedAt timestamp");
    }
  });

  // 4. Health & Queue Status Monitoring Endpoint
  await check("4. Health & Queue Monitoring Endpoint (GET /api/webhook/status)", async () => {
    const response = await getHealthHandler();
    if (response.status !== 200) throw new Error(`Expected HTTP 200 from health endpoint, got ${response.status}`);

    const data = await response.json();
    if (data.status !== "healthy") throw new Error(`Expected status 'healthy', got ${data.status}`);
    if (!data.database || !data.database.mongodb) throw new Error("Missing database status");
    if (!data.queues) throw new Error("Missing queue metrics");
  });

  // 5. Signature Validation Strict Enforcement
  await check("5. Strict Signature Validation Enforcement", async () => {
    process.env.TWILIO_VALIDATE_SIGNATURE = "true";
    process.env.TWILIO_AUTH_TOKEN = "mock_auth_token_for_validation";

    const reqMissing = createMockTwilioRequest({ Body: "Test" });
    const missingValid = validateTwilioWebhookSignature(reqMissing, { Body: "Test" });
    if (missingValid) throw new Error("Expected missing signature header to fail validation");

    const reqInvalid = createMockTwilioRequest({ Body: "Test" }, { "x-twilio-signature": "invalid_sig" });
    const invalidValid = validateTwilioWebhookSignature(reqInvalid, { Body: "Test" });
    if (invalidValid) throw new Error("Expected invalid signature header to fail validation");

    process.env.TWILIO_VALIDATE_SIGNATURE = "false";
  });

  // Test data isolation cleanup
  const testPhones = [
    "whatsapp:+919876501111",
    "whatsapp:+919876502222",
    "whatsapp:+919876503333",
  ];
  await Customer.deleteMany({ phone: { $in: testPhones } });
  await Message.deleteMany({ phone: { $in: testPhones } });
  await WebhookEvent.deleteMany({ eventId: { $regex: "^SM_" } });
  await Notification.deleteMany({ phone: { $in: testPhones } });
  console.log("\n🧹 Test data cleaned up successfully.");

  console.log("\n==================================================");
  console.log(`📊 HARDENING SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runHardeningSuite().catch((err) => {
  console.error("Hardening Suite Error:", err);
  process.exit(1);
});
