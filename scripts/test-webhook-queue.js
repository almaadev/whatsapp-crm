import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import mongoose from "mongoose";
import connectDB from "../src/shared/lib/db/mongodb.js";
import Customer from "../src/shared/models/Customer.js";
import Lead from "../src/shared/models/Lead.js";
import Message from "../src/shared/models/Message.js";
import WebhookEvent from "../src/shared/models/WebhookEvent.js";
import Notification from "../src/shared/models/Notification.js";
import Activity from "../src/shared/models/Activity.js";
import KeywordAutomation from "../src/shared/models/KeywordAutomation.js";
import CRMTemplate from "../src/shared/models/CRMTemplate.js";
import ChatWorkspace from "../src/shared/models/ChatWorkspace.js";
import inboundMessageService from "../src/server/services/inboundMessageService.js";
import { POST as webhookPostHandler } from "../src/app/api/webhook/route.js";
import { validateTwilioWebhookSignature } from "../src/shared/utils/twilioValidator.js";
import { normalizePhone } from "../src/shared/utils/phoneUtils.js";

// Mock Request Helper for Webhook testing
function createMockTwilioRequest(body, headers = {}) {
  const urlEncoded = new URLSearchParams(body).toString();
  const req = new Request("http://localhost:3000/api/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "crm.almaaerp.in",
      ...headers,
    },
    body: urlEncoded,
  });
  return req;
}

async function runTests() {
  console.log("\n==================================================");
  console.log("🧪 STARTING WHATSAPP CRM WEBHOOK + QUEUE REFACTOR TEST SUITE");
  console.log("==================================================\n");

  await connectDB();
  process.env.TWILIO_VALIDATE_SIGNATURE = "false"; // Disable Twilio signature for mock requests during testing

  let passed = 0;
  let failed = 0;

  async function assertTest(name, fn) {
    try {
      process.stdout.write(`⏳ Testing: ${name}... `);
      await fn();
      console.log("✅ PASSED");
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      console.error(err);
      failed++;
    }
  }

  // TEST 1: Twilio Signature Validation Logic
  await assertTest("1. Twilio Signature Validation (Bypass & Verification)", async () => {
    process.env.TWILIO_VALIDATE_SIGNATURE = "false";
    const reqBypass = createMockTwilioRequest({ Body: "Test", From: "whatsapp:+919876543210" });
    const isBypassValid = validateTwilioWebhookSignature(reqBypass, { Body: "Test" });
    if (!isBypassValid) throw new Error("Expected signature validation to succeed with bypass");

    process.env.TWILIO_VALIDATE_SIGNATURE = "true";
    const reqMissingSig = createMockTwilioRequest({ Body: "Test", From: "whatsapp:+919876543210" });
    const isInvalid = validateTwilioWebhookSignature(reqMissingSig, { Body: "Test" });
    if (isInvalid) throw new Error("Expected missing signature to fail validation in strict mode");

    process.env.TWILIO_VALIDATE_SIGNATURE = "false"; // Reset
  });

  // TEST 2: Thin Webhook Ingestion & Atomic WebhookEvent Idempotency
  const testPhone1 = "whatsapp:+919876543210";
  const sid1 = `SM_test_single_${Date.now()}`;

  await assertTest("2. Thin Webhook Ingestion (Returns 200 & Stores WebhookEvent)", async () => {
    // Cleanup prior test artifacts
    await WebhookEvent.deleteMany({ eventId: { $in: [sid1] } });
    await Customer.deleteMany({ phone: testPhone1 });
    await Message.deleteMany({ phone: testPhone1 });

    const req = createMockTwilioRequest({
      MessageSid: sid1,
      From: testPhone1,
      To: "whatsapp:+917401403011",
      Body: "Hello from test suite",
      NumMedia: "0",
      ProfileName: "Test User One",
    });

    const start = performance.now();
    const res = await webhookPostHandler(req);
    const duration = performance.now() - start;

    if (res.status !== 200) throw new Error(`Expected HTTP 200, got ${res.status}`);

    const webhookEvent = await WebhookEvent.findOne({ eventId: sid1 });
    if (!webhookEvent) throw new Error("Expected WebhookEvent document to be created in DB");
    if (webhookEvent.status !== "queued") throw new Error(`Expected status 'queued', got ${webhookEvent.status}`);

    console.log(`[LATENCY: ${duration.toFixed(2)}ms]`);
  });

  // TEST 3: MANDATORY CRITICAL DUPLICATE TEST (10 Concurrent Webhook Requests)
  const sidDup = `SM_test_concurrent_dup_${Date.now()}`;
  const testPhoneDup = "whatsapp:+919876500000";

  await assertTest("3. MANDATORY CRITICAL DUPLICATE TEST (10 Concurrent Webhooks with Same MessageSid)", async () => {
    await WebhookEvent.deleteMany({ eventId: sidDup });
    await Customer.deleteMany({ phone: testPhoneDup });
    await Message.deleteMany({ twilioSid: sidDup });

    const requests = Array.from({ length: 10 }, () =>
      createMockTwilioRequest({
        MessageSid: sidDup,
        From: testPhoneDup,
        To: "whatsapp:+917401403011",
        Body: "Duplicate Burst Test",
        ProfileName: "Burst User",
      })
    );

    // Send 10 requests concurrently
    const results = await Promise.all(requests.map((r) => webhookPostHandler(r)));

    // Verify all 10 return HTTP 200
    for (const r of results) {
      if (r.status !== 200) throw new Error(`Expected HTTP 200 on all duplicate requests, got ${r.status}`);
    }

    // Verify EXACTLY 1 WebhookEvent record exists in DB
    const eventCount = await WebhookEvent.countDocuments({ eventId: sidDup });
    if (eventCount !== 1) throw new Error(`Expected exactly 1 WebhookEvent record, found ${eventCount}`);

    // Now execute InboundMessageService once (simulating queue processing)
    const procResult = await inboundMessageService.handleInboundMessage({
      twilioSid: sidDup,
      fromPhone: testPhoneDup,
      rawTo: "whatsapp:+917401403011",
      messageText: "Duplicate Burst Test",
      profileName: "Burst User",
    });

    // Process a second time with same twilioSid to verify service-level idempotency
    const procResult2 = await inboundMessageService.handleInboundMessage({
      twilioSid: sidDup,
      fromPhone: testPhoneDup,
      rawTo: "whatsapp:+917401403011",
      messageText: "Duplicate Burst Test",
      profileName: "Burst User",
    });

    if (!procResult2.duplicate) throw new Error("Expected second processing attempt to return duplicate: true");

    // Verify EXACTLY 1 Message document exists in DB
    const msgCount = await Message.countDocuments({ twilioSid: sidDup });
    if (msgCount !== 1) throw new Error(`Expected exactly 1 Message document, found ${msgCount}`);

    // Verify EXACTLY 1 Customer document exists
    const custCount = await Customer.countDocuments({ phone: testPhoneDup });
    if (custCount !== 1) throw new Error(`Expected exactly 1 Customer document, found ${custCount}`);
  });

  // TEST 4: Normal Inbound Message Full Pipeline Processing
  const sidNorm = `SM_test_normal_${Date.now()}`;
  const testPhoneNorm = "whatsapp:+919876511111";

  await assertTest("4. Inbound Message Processing (Customer, Lead, Message, Activity)", async () => {
    await Customer.deleteMany({ phone: testPhoneNorm });
    await Message.deleteMany({ twilioSid: sidNorm });

    const result = await inboundMessageService.handleInboundMessage({
      twilioSid: sidNorm,
      fromPhone: testPhoneNorm,
      rawTo: "whatsapp:+917401403011",
      messageText: "Hello CRM team",
      profileName: "Ramesh Kumar",
    });

    if (!result.success) throw new Error("Expected inboundMessageService to return success: true");

    const customer = await Customer.findOne({ phone: testPhoneNorm });
    if (!customer) throw new Error("Customer document was not created");
    if (customer.name !== "Ramesh Kumar") throw new Error(`Expected name 'Ramesh Kumar', got '${customer.name}'`);
    if (customer.unreadCount !== 1) throw new Error(`Expected unreadCount 1, got ${customer.unreadCount}`);

    const lead = await Lead.findOne({ customerId: customer._id });
    if (!lead) throw new Error("Lead document was not created");

    const message = await Message.findOne({ twilioSid: sidNorm });
    if (!message) throw new Error("Message document was not created");
    if (message.direction !== "INBOUND") throw new Error("Message direction must be INBOUND");
  });

  // TEST 5: STOP (Opt-Out) Command Processing
  const sidStop = `SM_test_stop_${Date.now()}`;
  const testPhoneStop = "whatsapp:+919876522222";

  await assertTest("5. STOP / Opt-Out Command Processing", async () => {
    await Customer.deleteMany({ phone: testPhoneStop });

    const result = await inboundMessageService.handleInboundMessage({
      twilioSid: sidStop,
      fromPhone: testPhoneStop,
      rawTo: "whatsapp:+917401403011",
      messageText: "STOP",
      profileName: "Stop User",
    });

    if (!result.optedOut) throw new Error("Expected optedOut: true");

    const customer = await Customer.findOne({ phone: testPhoneStop });
    if (!customer || !customer.isOptedOut) throw new Error("Customer isOptedOut should be true");
  });

  // TEST 6: START (Opt-In) Command Processing
  const sidStart = `SM_test_start_${Date.now()}`;

  await assertTest("6. START / Opt-In Command Processing", async () => {
    const result = await inboundMessageService.handleInboundMessage({
      twilioSid: sidStart,
      fromPhone: testPhoneStop, // reusing opted-out customer
      rawTo: "whatsapp:+917401403011",
      messageText: "START",
      profileName: "Stop User",
    });

    const customer = await Customer.findOne({ phone: testPhoneStop });
    if (!customer || customer.isOptedOut !== false) throw new Error("Customer isOptedOut should now be false");
  });

  // TEST 7: Keyword Automation (CRM Template Variable Resolution)
  const testPhoneAuto = "whatsapp:+919876533333";
  const sidAuto = `SM_test_auto_${Date.now()}`;

  await assertTest("7. Keyword Automation (CRM Template Variable Resolution)", async () => {
    await Customer.deleteMany({ phone: testPhoneAuto });
    await Message.deleteMany({ phone: testPhoneAuto });
    await KeywordAutomation.deleteMany({ key: "testprice" });

    // Create a test CRM Template
    const testCrmTemplate = await CRMTemplate.create({
      name: "Price Inquiry Template",
      body: "Hello {{name}}, thank you for inquiring about our pricing for {{leadType}}.",
      category: "Pricing",
      isActive: true,
      isArchived: false,
    });

    // Create a Keyword Automation linked to this CRM Template
    await KeywordAutomation.create({
      key: "testprice",
      keywords: ["testprice", "pricingtest"],
      templateType: "crm",
      templateId: testCrmTemplate._id,
      isActive: true,
    });

    // Ingest inbound message matching keyword
    const inResult = await inboundMessageService.handleInboundMessage({
      twilioSid: sidAuto,
      fromPhone: testPhoneAuto,
      rawTo: "whatsapp:+917401403011",
      messageText: "testprice",
      profileName: "Karthik Raja",
    });

    if (!inResult.success) throw new Error("Inbound message processing failed");

    // Execute Keyword auto reply
    const { processKeywordAutoReply } = await import("../src/features/chat/services/keywordMatcher.js");
    const autoResult = await processKeywordAutoReply(testPhoneAuto, "testprice", "Karthik Raja", "+917401403011");

    // Verify outbound message was created with resolved template variables
    const outboundMsg = await Message.findOne({ phone: testPhoneAuto, direction: "OUTBOUND" });
    if (!outboundMsg) throw new Error("Expected outbound automated message in database");
    if (!outboundMsg.message.includes("Hello Karthik Raja")) {
      throw new Error(`Expected resolved variable 'Karthik Raja' in message, got: '${outboundMsg.message}'`);
    }

    // Cleanup template and automation
    await CRMTemplate.findByIdAndDelete(testCrmTemplate._id);
    await KeywordAutomation.deleteMany({ key: "testprice" });
  });

  // TEST 8: Active ChatWorkspace Suppression Test
  const testPhoneSupp = "whatsapp:+919876544444";
  const sidSupp = `SM_test_supp_${Date.now()}`;

  await assertTest("8. Notification Suppression for Active ChatWorkspace", async () => {
    await Customer.deleteMany({ phone: testPhoneSupp });
    await ChatWorkspace.deleteMany({ activePhone: testPhoneSupp });

    // Ingest customer
    const inResult = await inboundMessageService.handleInboundMessage({
      twilioSid: sidSupp,
      fromPhone: testPhoneSupp,
      rawTo: "whatsapp:+917401403011",
      messageText: "Hello there",
      profileName: "Workspace User",
    });

    const customer = await Customer.findOne({ phone: testPhoneSupp });

    // Mock an active workspace handler for this customer
    const mockUserId = new mongoose.Types.ObjectId();
    await ChatWorkspace.create({
      userId: mockUserId,
      activePhone: testPhoneSupp,
      activeCustomerId: customer._id,
      lastActiveAt: new Date(),
    });

    // Trigger notification processing
    const { notificationService } = await import("../src/server/services/notificationService.js");
    const notifs = await notificationService.processInboundNotification({
      phone: testPhoneSupp,
      customerId: customer._id,
      customerName: "Workspace User",
      messageText: "Hello there",
      twilioSid: `SM_supp_notif_${Date.now()}`,
    });

    if (notifs && notifs.length > 0) {
      throw new Error(`Expected notifications to be suppressed (0), but got ${notifs.length}`);
    }

    // Cleanup
    await ChatWorkspace.deleteMany({ userId: mockUserId });
  });

  console.log("\n==================================================");
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Fatal Test Suite Error:", err);
  process.exit(1);
});
