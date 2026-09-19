import { register } from "node:module";
try {
  register("./loader-hook.js", import.meta.url);
} catch {}

import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import mongoose from "mongoose";
import twilioSdk from "twilio";
import fs from "node:fs";
import path from "node:path";
import connectDB from "../src/shared/lib/db/mongodb.js";
import Message from "../src/shared/models/Message.js";
import CampaignRecipient from "../src/shared/models/CampaignRecipient.js";
import BulkMessage from "../src/shared/models/BulkMessage.js";
import { getStatusCallbackUrl, CANONICAL_PRODUCTION_STATUS_CALLBACK_URL } from "../src/features/admin/services/twilioService.js";
import { validateTwilioWebhookSignature } from "../src/shared/utils/twilioValidator.js";
import { emitMessageStatusUpdate } from "../src/shared/utils/socketPublisher.js";

async function runTests() {
  console.log("==================================================");
  console.log("STARTING DELIVERY STATUS LIFECYCLE TEST SUITE");
  console.log("==================================================");

  await connectDB();
  console.log("✅ Connected to MongoDB");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // MOCK Socket.IO for verification
  const emittedEvents = [];
  global.io = {
    emit: (event, data) => {
      emittedEvents.push({ scope: "global", event, data });
    },
    to: (room) => ({
      emit: (event, data) => {
        emittedEvents.push({ scope: `room:${room}`, event, data });
      },
    }),
    sockets: {
      adapter: {
        rooms: new Map([["919876543210", new Set(["socket1"])], ["branch:b1", new Set(["socket2"])]])
      }
    }
  };

  const testSid1 = `SM_test_${Date.now()}_1`;
  const testSid2 = `SM_test_${Date.now()}_2`;
  const testCampaignSid = `SM_camp_${Date.now()}`;
  let testCampaign = null;
  const testPhone = "919876543210";
  const testBranchId = new mongoose.Types.ObjectId();

  const canonicalWebhookUrl = "https://whatsapp.almaaerp.in/api/webhook/status";

  // Helper to create properly signed Twilio webhook requests
  function createSignedRequest(bodyParams, canonicalUrl = canonicalWebhookUrl) {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = twilioSdk.getExpectedTwilioSignature(authToken, canonicalUrl, bodyParams);
    return new Request("http://localhost:3000/api/webhook/status", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": signature,
        "x-forwarded-proto": "https",
        "x-forwarded-host": "whatsapp.almaaerp.in",
      },
      body: new URLSearchParams(bodyParams).toString(),
    });
  }

  try {
    // ----------------------------------------------------
    // TEST 1: StatusCallback URL Generation & Production Hardening
    // ----------------------------------------------------
    console.log("\n[TEST 1] Testing Dynamic StatusCallback URL Resolution & Isolation from NEXTAUTH_URL...");
    const originalNodeEnv = process.env.NODE_ENV;
    const originalStatusUrl = process.env.TWILIO_STATUS_CALLBACK_URL;
    const originalNextAuth = process.env.NEXTAUTH_URL;

    // Production mode test: NEXTAUTH_URL must NEVER be used
    process.env.NODE_ENV = "production";
    delete process.env.TWILIO_STATUS_CALLBACK_URL;
    process.env.NEXTAUTH_URL = "https://unrelated-domain.evil.com";
    const prodDefaultUrl = getStatusCallbackUrl();
    assert(
      prodDefaultUrl === "https://whatsapp.almaaerp.in/api/webhook/status",
      `Production defaults strictly to canonical URL and ignores NEXTAUTH_URL: ${prodDefaultUrl}`
    );

    // Production mode with explicit TWILIO_STATUS_CALLBACK_URL
    process.env.TWILIO_STATUS_CALLBACK_URL = "https://whatsapp.almaaerp.in/api/webhook/status";
    const prodConfiguredUrl = getStatusCallbackUrl();
    assert(
      prodConfiguredUrl === "https://whatsapp.almaaerp.in/api/webhook/status",
      `Production respects explicit TWILIO_STATUS_CALLBACK_URL: ${prodConfiguredUrl}`
    );

    // Development mode resolution: TWILIO_STATUS_CALLBACK_URL -> NEXT_PUBLIC_BASE_URL -> APP_URL
    process.env.NODE_ENV = "development";
    delete process.env.TWILIO_STATUS_CALLBACK_URL;
    process.env.NEXT_PUBLIC_BASE_URL = "https://dev.almaaerp.in";
    const devUrl = getStatusCallbackUrl();
    assert(
      devUrl === "https://dev.almaaerp.in/api/webhook/status",
      `Development resolution uses NEXT_PUBLIC_BASE_URL: ${devUrl}`
    );

    // Restore original env vars
    process.env.NODE_ENV = originalNodeEnv;
    if (originalStatusUrl) process.env.TWILIO_STATUS_CALLBACK_URL = originalStatusUrl;
    else delete process.env.TWILIO_STATUS_CALLBACK_URL;
    if (originalNextAuth) process.env.NEXTAUTH_URL = originalNextAuth;
    else delete process.env.NEXTAUTH_URL;

    // ----------------------------------------------------
    // TEST 1B: State Machine Unit Assertions (ALLOWED_TRANSITIONS & shouldUpdateStatus)
    // ----------------------------------------------------
    console.log("\n[TEST 1B] Testing Explicit State Machine Allowed Transitions...");
    const { ALLOWED_TRANSITIONS, shouldUpdateStatus } = await import("../src/app/api/webhook/status/route.js");
    // READ cannot regress
    assert(shouldUpdateStatus("READ", "DELIVERED") === false, "READ cannot regress to DELIVERED");
    assert(shouldUpdateStatus("READ", "SENT") === false, "READ cannot regress to SENT");
    assert(shouldUpdateStatus("READ", "QUEUED") === false, "READ cannot regress to QUEUED");
    assert(shouldUpdateStatus("READ", "SENDING") === false, "READ cannot regress to SENDING");
    assert(shouldUpdateStatus("READ", "FAILED") === false, "READ cannot regress to FAILED");
    assert(shouldUpdateStatus("READ", "READ") === true, "READ allows idempotency (READ -> READ)");

    // DELIVERED cannot regress to SENT/QUEUED/SENDING
    assert(shouldUpdateStatus("DELIVERED", "SENT") === false, "DELIVERED cannot regress to SENT");
    assert(shouldUpdateStatus("DELIVERED", "QUEUED") === false, "DELIVERED cannot regress to QUEUED");
    assert(shouldUpdateStatus("DELIVERED", "SENDING") === false, "DELIVERED cannot regress to SENDING");
    assert(shouldUpdateStatus("DELIVERED", "READ") === true, "DELIVERED can advance to READ");

    // FAILED and UNDELIVERED cannot regress to SENT/QUEUED/SENDING
    assert(shouldUpdateStatus("FAILED", "SENT") === false, "FAILED cannot regress to SENT");
    assert(shouldUpdateStatus("FAILED", "QUEUED") === false, "FAILED cannot regress to QUEUED");
    assert(shouldUpdateStatus("UNDELIVERED", "SENT") === false, "UNDELIVERED cannot regress to SENT");

    // SENT and QUEUED can advance
    assert(shouldUpdateStatus("QUEUED", "SENT") === true, "QUEUED can advance to SENT");
    assert(shouldUpdateStatus("SENT", "DELIVERED") === true, "SENT can advance to DELIVERED");

    // ----------------------------------------------------
    // TEST 1C: Verify Outbound Implementations pass getStatusCallbackUrl()
    // ----------------------------------------------------
    console.log("\n[TEST 1C] Verifying All Outbound Codebase References pass getStatusCallbackUrl()...");
    const twilioServiceCode = fs.readFileSync(path.resolve("src/features/admin/services/twilioService.js"), "utf-8");
    const inboundServiceCode = fs.readFileSync(path.resolve("src/server/services/inboundMessageService.js"), "utf-8");
    const campaignWorkerCode = fs.readFileSync(path.resolve("src/server/queues/workers/campaignWorker.js"), "utf-8");

    assert(
      twilioServiceCode.includes("statusCallback: getStatusCallbackUrl()"),
      "twilioService.js includes statusCallback: getStatusCallbackUrl()"
    );
    assert(
      inboundServiceCode.includes("const callbackUrl = getStatusCallbackUrl()") &&
      inboundServiceCode.includes("statusCallback: callbackUrl"),
      "inboundMessageService.js includes statusCallback: getStatusCallbackUrl()"
    );
    assert(
      campaignWorkerCode.includes("const statusCallback = getStatusCallbackUrl()") &&
      campaignWorkerCode.includes("statusCallback,"),
      "campaignWorker.js includes statusCallback: getStatusCallbackUrl()"
    );

    // ----------------------------------------------------
    // TEST 2: Initial Message Creation (CRM Send)
    // ----------------------------------------------------
    console.log("\n[TEST 2] Testing Initial Outbound Message Creation...");
    const msgDoc = await Message.create({
      phone: testPhone,
      message: "Test outbound delivery message",
      direction: "OUTBOUND",
      status: "SENT",
      twilioSid: testSid1,
      branchId: testBranchId,
      senderName: "Test Associate",
      senderNumber: "+14155238886",
      read: "FALSE",
      timestamp: new Date(),
    });
    assert(msgDoc._id && msgDoc.status === "SENT" && msgDoc.twilioSid === testSid1, "Initial Message stored with status 'SENT' and Twilio SID");

    // ----------------------------------------------------
    // TEST 3: Status Callback Handling (SENT -> DELIVERED)
    // ----------------------------------------------------
    console.log("\n[TEST 3] Testing Callback: SENT -> DELIVERED (with authentic Twilio signature)...");
    const { POST: statusHandler } = await import("../src/app/api/webhook/status/route.js");

    const reqDelivered = createSignedRequest({
      MessageSid: testSid1,
      MessageStatus: "delivered",
      To: `whatsapp:+${testPhone}`,
    });

    const resDelivered = await statusHandler(reqDelivered);
    const jsonDelivered = await resDelivered.json();
    assert(jsonDelivered.success === true && jsonDelivered.statusUpdated === true, "Delivered callback accepted and updated doc");

    const updatedDeliveredMsg = await Message.findOne({ twilioSid: testSid1 });
    assert(updatedDeliveredMsg.status === "DELIVERED", `Message status updated to 'DELIVERED' in DB (actual: ${updatedDeliveredMsg.status})`);

    // Check Socket.IO emission
    const deliveredSocket = emittedEvents.find(
      (e) => e.event === "message_status_update" && e.data.sid === testSid1 && e.data.status === "DELIVERED"
    );
    assert(deliveredSocket !== undefined, "Socket event 'message_status_update' emitted with status 'DELIVERED'");

    // ----------------------------------------------------
    // TEST 4: Status Callback Handling (DELIVERED -> READ)
    // ----------------------------------------------------
    console.log("\n[TEST 4] Testing Callback: DELIVERED -> READ (with authentic Twilio signature)...");
    const reqRead = createSignedRequest({
      MessageSid: testSid1,
      MessageStatus: "read",
      To: `whatsapp:+${testPhone}`,
    });

    const resRead = await statusHandler(reqRead);
    const jsonRead = await resRead.json();
    assert(jsonRead.success === true && jsonRead.statusUpdated === true, "Read callback accepted and updated doc");

    const updatedReadMsg = await Message.findOne({ twilioSid: testSid1 });
    assert(updatedReadMsg.status === "READ" && updatedReadMsg.read === "TRUE", `Message status updated to 'READ' and read='TRUE' in DB`);

    // ----------------------------------------------------
    // TEST 4B: WhatsApp Read Receipt via EventType=READ
    // ----------------------------------------------------
    console.log("\n[TEST 4B] Testing WhatsApp Callback via EventType=READ...");
    const testSidReadEvent = `SM_test_eventtype_${Date.now()}`;
    await Message.create({
      phone: testPhone,
      message: "Test EventType=READ message",
      direction: "OUTBOUND",
      status: "DELIVERED",
      twilioSid: testSidReadEvent,
      branchId: testBranchId,
      senderName: "Test Associate",
      senderNumber: "+14155238886",
      read: "FALSE",
      timestamp: new Date(),
    });

    const reqEventTypeRead = createSignedRequest({
      MessageSid: testSidReadEvent,
      MessageStatus: "delivered", // Twilio may keep MessageStatus as delivered while attaching EventType=READ
      EventType: "READ",
      To: `whatsapp:+${testPhone}`,
    });

    const resEventTypeRead = await statusHandler(reqEventTypeRead);
    const jsonEventTypeRead = await resEventTypeRead.json();
    assert(jsonEventTypeRead.success === true && jsonEventTypeRead.statusUpdated === true, "EventType=READ callback accepted");

    const msgAfterEventTypeRead = await Message.findOne({ twilioSid: testSidReadEvent });
    assert(
      msgAfterEventTypeRead.status === "READ" && msgAfterEventTypeRead.read === "TRUE",
      `Message correctly promoted to 'READ' via EventType=READ (actual: ${msgAfterEventTypeRead.status})`
    );
    await Message.deleteOne({ twilioSid: testSidReadEvent });

    // ----------------------------------------------------
    // TEST 5: Out-of-Order / Delayed Callback Protection (DELIVERED arrives after READ)
    // ----------------------------------------------------
    console.log("\n[TEST 5] Testing Out-of-Order Callback: Delayed 'delivered' arriving after 'read'...");
    const reqLateDelivered = createSignedRequest({
      MessageSid: testSid1,
      MessageStatus: "delivered",
      To: `whatsapp:+${testPhone}`,
    });

    await statusHandler(reqLateDelivered);
    const msgAfterLateDelivered = await Message.findOne({ twilioSid: testSid1 });
    assert(msgAfterLateDelivered.status === "READ", `Message status remained 'READ' and was not downgraded by delayed 'delivered'`);

    // ----------------------------------------------------
    // TEST 6: Out-of-Order / Delayed Callback Protection (SENT arrives after READ)
    // ----------------------------------------------------
    console.log("\n[TEST 6] Testing Out-of-Order Callback: Delayed 'sent' arriving after 'read'...");
    const reqLateSent = createSignedRequest({
      MessageSid: testSid1,
      MessageStatus: "sent",
      To: `whatsapp:+${testPhone}`,
    });

    await statusHandler(reqLateSent);
    const msgAfterLateSent = await Message.findOne({ twilioSid: testSid1 });
    assert(msgAfterLateSent.status === "READ", `Message status remained 'READ' and was not downgraded by delayed 'sent'`);

    // ----------------------------------------------------
    // TEST 7: Failure / Undelivered Handling with ErrorCode
    // ----------------------------------------------------
    console.log("\n[TEST 7] Testing Failure Callback with ErrorCode (FAILED / 30008)...");
    const msgDocFail = await Message.create({
      phone: testPhone,
      message: "Test failed message",
      direction: "OUTBOUND",
      status: "SENT",
      twilioSid: testSid2,
      senderName: "Test Associate",
      senderNumber: "+14155238886",
      read: "FALSE",
      timestamp: new Date(),
    });

    const reqFailed = createSignedRequest({
      MessageSid: testSid2,
      MessageStatus: "failed",
      ErrorCode: "30008",
      ErrorMessage: "Unknown destination handset error",
      To: `whatsapp:+${testPhone}`,
    });

    const resFailed = await statusHandler(reqFailed);
    const jsonFailed = await resFailed.json();
    assert(jsonFailed.success === true, "Failed callback accepted");

    const failedMsg = await Message.findOne({ twilioSid: testSid2 });
    assert(
      failedMsg.status === "FAILED" && failedMsg.errorCode === "30008" && failedMsg.errorMessage.includes("Unknown destination"),
      `Failed status, errorCode (${failedMsg.errorCode}), and errorMessage persisted to DB`
    );

    // ----------------------------------------------------
    // TEST 8: Terminal Failure State Protection (SENT arriving after FAILED)
    // ----------------------------------------------------
    console.log("\n[TEST 8] Testing Protection against downgrading terminal failure...");
    const reqLateSentToFailed = createSignedRequest({
      MessageSid: testSid2,
      MessageStatus: "sent",
      To: `whatsapp:+${testPhone}`,
    });

    await statusHandler(reqLateSentToFailed);
    const failedMsgAfterLateSent = await Message.findOne({ twilioSid: testSid2 });
    assert(failedMsgAfterLateSent.status === "FAILED", "Message status remained 'FAILED' and was not overwritten by late 'sent'");

    // ----------------------------------------------------
    // TEST 9: Idempotency / Duplicate Callbacks
    // ----------------------------------------------------
    console.log("\n[TEST 9] Testing Idempotency on repeated duplicate callbacks...");
    const reqDuplicate = createSignedRequest({
      MessageSid: testSid2,
      MessageStatus: "failed",
      ErrorCode: "30008",
      To: `whatsapp:+${testPhone}`,
    });

    const resDup = await statusHandler(reqDuplicate);
    const jsonDup = await resDup.json();
    assert(jsonDup.success === true, "Duplicate status callback handled cleanly without error");

    // ----------------------------------------------------
    // TEST 10: Unknown SID Callback Handling
    // ----------------------------------------------------
    console.log("\n[TEST 10] Testing Unknown SID Callback Handling...");
    const reqUnknown = createSignedRequest({
      MessageSid: `SM_unknown_${Date.now()}`,
      MessageStatus: "delivered",
      To: `whatsapp:+919999999999`,
    });

    const resUnknown = await statusHandler(reqUnknown);
    const jsonUnknown = await resUnknown.json();
    assert(jsonUnknown.success === true, "Unknown SID callback handled gracefully without throwing");

    // ----------------------------------------------------
    // TEST 11: CampaignRecipient Aggregation & Status Tracking
    // ----------------------------------------------------
    console.log("\n[TEST 11] Testing Campaign Recipient Status Pipeline...");
    testCampaign = await BulkMessage.create({
      campaignName: `Test Campaign ${Date.now()}`,
      templateId: "HXtest123",
      senderNumber: "+14155238886",
      status: "processing",
    });

    const recipient = await CampaignRecipient.create({
      campaignId: testCampaign._id,
      phone: testPhone,
      normalizedPhone: testPhone,
      twilioMessageSid: testCampaignSid,
      status: "SENT",
      sentAt: new Date(),
    });

    const reqCampDelivered = createSignedRequest({
      MessageSid: testCampaignSid,
      MessageStatus: "delivered",
      To: `whatsapp:+${testPhone}`,
    });

    await statusHandler(reqCampDelivered);
    const updatedRec = await CampaignRecipient.findOne({ twilioMessageSid: testCampaignSid });
    assert(
      updatedRec.status === "DELIVERED" && updatedRec.deliveredAt !== null,
      `CampaignRecipient updated to 'DELIVERED' with deliveredAt timestamp`
    );

    // ----------------------------------------------------
    // TEST 12: Socket Publisher Multi-Room Targeting
    // ----------------------------------------------------
    console.log("\n[TEST 12] Testing Socket Publisher Multi-Room Targeting...");
    emittedEvents.length = 0;
    emitMessageStatusUpdate({
      sid: testSid1,
      status: "READ",
      phone: testPhone,
      branchId: "b1",
    });

    const targetedPhoneRoom = emittedEvents.some((e) => e.scope === `room:${testPhone}`);
    const targetedBranchRoom = emittedEvents.some((e) => e.scope === "room:branch:b1");
    const targetedGlobal = emittedEvents.some((e) => e.scope === "global");
    assert(targetedPhoneRoom && targetedBranchRoom && targetedGlobal, "Status update emitted to phone room, branch room, and global");

    // ----------------------------------------------------
    // TEST 13: Frontend Store - In-flight Send -> Sent -> Delivered -> Read
    // ----------------------------------------------------
    console.log("\n[TEST 13] Testing Frontend Zustand Chat Store Status Progression...");
    const { useChatStore } = await import("../src/features/chat/stores/chatStore.js");
    const storePhone = "919998887777";
    const tempMsgId = `temp_${Date.now()}`;
    const storeSid = `SM_store_${Date.now()}`;

    // Add conversation with optimistic message
    useChatStore.getState().addMessage({
      tempId: tempMsgId,
      phone: storePhone,
      message: "Hello world optimistic",
      direction: "OUTBOUND",
      status: "SENDING",
      timestamp: new Date().toISOString(),
    });

    const initialChat = useChatStore.getState().messages.find((c) => c.phone === storePhone);
    assert(initialChat && initialChat.history[0].status === "SENDING", "Optimistic message added with status 'SENDING'");

    // Server returns SENT with Twilio SID
    useChatStore.getState().updateMessageStatus(storePhone, tempMsgId, "SENT", storeSid);
    const sentChat = useChatStore.getState().messages.find((c) => c.phone === storePhone);
    assert(
      sentChat && sentChat.history[0].status === "SENT" && sentChat.history[0].twilioSid === storeSid,
      "Message updated to 'SENT' and twilioSid attached"
    );

    // Socket receives DELIVERED
    useChatStore.getState().updateMessageStatus(storePhone, storeSid, "DELIVERED", storeSid);
    const deliveredChat = useChatStore.getState().messages.find((c) => c.phone === storePhone);
    assert(
      deliveredChat && deliveredChat.history[0].status === "DELIVERED",
      "Message updated to 'DELIVERED' via Twilio SID"
    );

    // Socket receives READ
    useChatStore.getState().updateMessageStatus(storePhone, storeSid, "READ", storeSid);
    const readChat = useChatStore.getState().messages.find((c) => c.phone === storePhone);
    assert(
      readChat && readChat.history[0].status === "READ",
      "Message updated to 'READ' via Twilio SID"
    );

    // ----------------------------------------------------
    // TEST 14: Frontend Store - Protection against out-of-order regression
    // ----------------------------------------------------
    console.log("\n[TEST 14] Testing Frontend Zustand Chat Store Out-of-Order Downgrade Prevention...");
    useChatStore.getState().updateMessageStatus(storePhone, storeSid, "DELIVERED", storeSid);
    const postLateDelivered = useChatStore.getState().messages.find((c) => c.phone === storePhone);
    assert(
      postLateDelivered && postLateDelivered.history[0].status === "READ",
      "Frontend store preserved 'READ' status when delayed 'DELIVERED' arrived"
    );

    useChatStore.getState().updateMessageStatus(storePhone, storeSid, "SENT", storeSid);
    const postLateSent = useChatStore.getState().messages.find((c) => c.phone === storePhone);
    assert(
      postLateSent && postLateSent.history[0].status === "READ",
      "Frontend store preserved 'READ' status when delayed 'SENT' arrived"
    );

    // ----------------------------------------------------
    // TEST 15: Frontend Store - Syncing Active selectedChat in-place
    // ----------------------------------------------------
    console.log("\n[TEST 15] Testing Frontend selectedChat sync in-place without page reload...");
    const activePhone = "918887776666";
    const activeTempId = `temp_active_${Date.now()}`;
    const activeSid = `SM_active_${Date.now()}`;

    useChatStore.getState().addMessage({
      tempId: activeTempId,
      phone: activePhone,
      message: "Active thread message",
      direction: "OUTBOUND",
      status: "SENDING",
      timestamp: new Date().toISOString(),
    });

    const activeChatDoc = useChatStore.getState().messages.find((c) => c.phone === activePhone);
    useChatStore.getState().setSelectedChat(activeChatDoc);
    assert(useChatStore.getState().selectedChat !== null, "selectedChat is active");

    useChatStore.getState().updateMessageStatus(activePhone, activeTempId, "DELIVERED", activeSid);
    const activeSelected = useChatStore.getState().selectedChat;
    assert(
      activeSelected && activeSelected.history[0].status === "DELIVERED" && activeSelected.history[0].twilioSid === activeSid,
      "selectedChat.history was updated directly to 'DELIVERED' with twilioSid in-place without requiring refresh"
    );

    // ----------------------------------------------------
    // TEST 16: Canonical Signature Validation with Twilio Official SDK
    // ----------------------------------------------------
    console.log("\n[TEST 16] Testing Official Twilio SDK Signature Validation on Canonical URL...");
    const dummyAuthToken = process.env.TWILIO_AUTH_TOKEN || "test_token_for_validation";
    const canonicalUrl = "https://whatsapp.almaaerp.in/api/webhook/status";
    const testPayload = {
      MessageSid: "SM_sig_test_123",
      MessageStatus: "delivered",
      To: "whatsapp:+919876543210"
    };

    // Calculate valid signature using Twilio SDK
    const validSignature = twilioSdk.getExpectedTwilioSignature(dummyAuthToken, canonicalUrl, testPayload);

    // Mock incoming Request arriving behind reverse proxy
    const mockRequestBehindProxy = new Request("http://localhost:3000/api/webhook/status", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": validSignature,
        "x-forwarded-proto": "https",
        "x-forwarded-host": "whatsapp.almaaerp.in",
      },
    });

    const isSigValid = validateTwilioWebhookSignature(mockRequestBehindProxy, testPayload, canonicalUrl);
    assert(isSigValid === true, "Twilio official SDK signature validated successfully for canonical URL behind reverse proxy");

    // Negative test: Tampered signature must fail
    const mockRequestTampered = new Request("http://localhost:3000/api/webhook/status", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "tampered_signature_xyz",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "whatsapp.almaaerp.in",
      },
    });

    const isTamperedValid = validateTwilioWebhookSignature(mockRequestTampered, testPayload, canonicalUrl);
    assert(isTamperedValid === false, "Tampered/invalid signature was correctly rejected (returned false)");

    // Production mode signature bypass test: In production, TWILIO_VALIDATE_SIGNATURE=false MUST NOT bypass
    process.env.NODE_ENV = "production";
    process.env.TWILIO_VALIDATE_SIGNATURE = "false";
    const isBypassAttempted = validateTwilioWebhookSignature(mockRequestTampered, testPayload, canonicalUrl);
    assert(isBypassAttempted === false, "In production mode, TWILIO_VALIDATE_SIGNATURE=false is ignored and does NOT bypass validation");
    process.env.NODE_ENV = originalNodeEnv;
    process.env.TWILIO_VALIDATE_SIGNATURE = "true";

    // Cleanup test data
    await Message.deleteMany({ twilioSid: { $in: [testSid1, testSid2] } });
    await CampaignRecipient.deleteMany({ twilioMessageSid: testCampaignSid });
    if (testCampaign?._id) {
      await BulkMessage.deleteOne({ _id: testCampaign._id });
    }
    console.log("🧹 Test records cleaned up");

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    console.log("\n==================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
    console.log("==================================================");
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
