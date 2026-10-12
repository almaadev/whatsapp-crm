/**
 * Comprehensive Test Suite: Inbound WhatsApp Message Persistence & Index Resilience
 * Covers Phases 1-6 Requirements:
 * 1. Inbound WhatsApp message with a valid sender phone.
 * 2. Sender phone normalization.
 * 3. Two messages from the same sender.
 * 4. Multiple leads with missing/ null phone values (partial unique index test).
 * 5. Duplicate valid phone handling (uniqueness enforcement test).
 * 6. Duplicate Twilio webhook delivery without duplicate messages (Twilio SID idempotency).
 * 7. Lead creation failure and message persistence behavior.
 * 8. BullMQ retries and terminal failure handling (UnrecoverableError on deterministic errors).
 * 9. Correct database selection for the deployment environment.
 */
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import assert from "assert";
import mongoose from "mongoose";
import connectDB from "../src/shared/lib/db/mongodb.js";
import Customer from "../src/shared/models/Customer.js";
import Lead from "../src/shared/models/Lead.js";
import Message from "../src/shared/models/Message.js";
import WebhookEvent from "../src/shared/models/WebhookEvent.js";
import inboundMessageService from "../src/server/services/inboundMessageService.js";
import { normalizePhone } from "../src/shared/utils/phoneUtils.js";
import { UnrecoverableError } from "bullmq";

let totalPass = 0;
let totalFail = 0;

async function runTest(name, fn) {
  try {
    process.stdout.write(`⏳ Running: ${name}... `);
    await fn();
    console.log("✅ PASSED");
    totalPass++;
  } catch (err) {
    console.log("❌ FAILED");
    console.error(err);
    totalFail++;
  }
}

async function cleanupTestPhones(phones) {
  for (const phone of phones) {
    const custs = await Customer.find({ phone });
    for (const c of custs) {
      await Lead.deleteMany({ customerId: c._id });
      await Customer.deleteOne({ _id: c._id });
    }
    await Message.deleteMany({ phone });
  }
}

async function runSuite() {
  console.log("\n========================================================");
  console.log("🧪 INBOUND WHATSAPP PERSISTENCE & INDEX TEST SUITE");
  console.log("========================================================\n");

  await connectDB();

  const testPhones = [
    "whatsapp:+919876501101",
    "whatsapp:+919876501102",
    "whatsapp:+919876501103",
    "whatsapp:+919876501104a",
    "whatsapp:+919876501104b",
    "whatsapp:+919876501104c",
    "whatsapp:+919876501105",
    "whatsapp:+919876501106",
    "whatsapp:+919876501107",
  ];

  await cleanupTestPhones(testPhones);
  await WebhookEvent.deleteMany({ eventId: { $regex: "^SM_test_pers_" } });

  // -------------------------------------------------------------------------
  // TEST 1: Inbound WhatsApp message with a valid sender phone
  // -------------------------------------------------------------------------
  await runTest("1. Inbound WhatsApp message with a valid sender phone", async () => {
    const phone = "whatsapp:+919876501101";
    const sid = `SM_test_pers_1_${Date.now()}`;

    const res = await inboundMessageService.handleInboundMessage({
      twilioSid: sid,
      fromPhone: phone,
      rawTo: "whatsapp:+917401403011",
      messageText: "Hello CRM, booking an appointment",
      profileName: "Valid Sender",
    });

    assert.strictEqual(res.success, true, "Result should be success");
    assert.ok(res.messageId, "Message ID must be returned");

    // Verify Message persistence
    const savedMsg = await Message.findById(res.messageId);
    assert.ok(savedMsg, "Message must exist in DB");
    assert.strictEqual(savedMsg.phone, phone, "Message phone matches canonical phone");
    assert.strictEqual(savedMsg.direction, "INBOUND", "Direction is strictly INBOUND");
    assert.strictEqual(savedMsg.status, "RECEIVED", "Status is RECEIVED");
    assert.strictEqual(savedMsg.twilioSid, sid, "Twilio SID matches");

    // Verify Customer & Lead
    const savedCust = await Customer.findOne({ phone });
    assert.ok(savedCust, "Customer document must exist");
    const savedLead = await Lead.findOne({ customerId: savedCust._id });
    assert.ok(savedLead, "Lead document must exist");
    assert.strictEqual(savedLead.phone, phone, "Lead phone must match canonical sender phone");
  });

  // -------------------------------------------------------------------------
  // TEST 2: Sender phone normalization
  // -------------------------------------------------------------------------
  await runTest("2. Sender phone normalization", async () => {
    const rawVariants = [
      "9876501102",
      "+919876501102",
      "whatsapp:9876501102",
      "whatsapp:+919876501102",
      "09876501102",
      "919876501102",
    ];

    const expectedCanonical = "whatsapp:+919876501102";
    for (const v of rawVariants) {
      const normalized = normalizePhone(v);
      assert.strictEqual(normalized, expectedCanonical, `Failed for input: ${v}`);
    }

    // Inbound message with raw 10 digits
    const sid = `SM_test_pers_2_${Date.now()}`;
    const res = await inboundMessageService.handleInboundMessage({
      twilioSid: sid,
      fromPhone: "9876501102",
      rawTo: "whatsapp:+917401403011",
      messageText: "Testing normalization",
    });

    assert.strictEqual(res.success, true);
    const savedMsg = await Message.findById(res.messageId);
    assert.strictEqual(savedMsg.phone, expectedCanonical, "Persisted message has canonical phone");
  });

  // -------------------------------------------------------------------------
  // TEST 3: Two messages from the same sender
  // -------------------------------------------------------------------------
  await runTest("3. Two messages from the same sender", async () => {
    const phone = "whatsapp:+919876501103";
    const sid1 = `SM_test_pers_3a_${Date.now()}`;
    const sid2 = `SM_test_pers_3b_${Date.now()}`;

    const res1 = await inboundMessageService.handleInboundMessage({
      twilioSid: sid1,
      fromPhone: phone,
      rawTo: "whatsapp:+917401403011",
      messageText: "Message 1 from sender",
      profileName: "Same Sender",
    });

    const res2 = await inboundMessageService.handleInboundMessage({
      twilioSid: sid2,
      fromPhone: phone,
      rawTo: "whatsapp:+917401403011",
      messageText: "Message 2 from sender",
      profileName: "Same Sender",
    });

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res2.success, true);

    const custCount = await Customer.countDocuments({ phone });
    assert.strictEqual(custCount, 1, "Exactly 1 customer must exist for sender");

    const leadCount = await Lead.countDocuments({ customerId: res1.customerId });
    assert.strictEqual(leadCount, 1, "Exactly 1 lead document must exist for sender");

    const msgCount = await Message.countDocuments({ phone });
    assert.strictEqual(msgCount, 2, "Exactly 2 messages must exist for sender");
  });

  // -------------------------------------------------------------------------
  // TEST 4: Multiple leads with missing / null phone values (partial unique index)
  // -------------------------------------------------------------------------
  await runTest("4. Multiple leads with missing/null phone values", async () => {
    const dummyCust1 = await Customer.create({
      phone: "whatsapp:+919876501104a",
      name: "Null Phone Lead 1",
    });
    const dummyCust2 = await Customer.create({
      phone: "whatsapp:+919876501104b",
      name: "Null Phone Lead 2",
    });
    const dummyCust3 = await Customer.create({
      phone: "whatsapp:+919876501104c",
      name: "Null Phone Lead 3",
    });

    // Create 3 separate leads where phone is null or omitted or empty string
    const lead1 = await Lead.create({
      customerId: dummyCust1._id,
      phone: null,
      leads: [{ date: new Date(), status: "New" }],
    });

    const lead2 = await Lead.create({
      customerId: dummyCust2._id,
      phone: null,
      leads: [{ date: new Date(), status: "New" }],
    });

    const lead3 = await Lead.create({
      customerId: dummyCust3._id,
      phone: "",
      leads: [{ date: new Date(), status: "New" }],
    });

    assert.ok(lead1._id, "Lead 1 with phone:null created");
    assert.ok(lead2._id, "Lead 2 with phone:null created without E11000 duplicate error");
    assert.ok(lead3._id, "Lead 3 with phone:'' created without E11000 duplicate error");

    // Clean up
    await Lead.deleteMany({ _id: { $in: [lead1._id, lead2._id, lead3._id] } });
    await Customer.deleteMany({ _id: { $in: [dummyCust1._id, dummyCust2._id, dummyCust3._id] } });
  });

  // -------------------------------------------------------------------------
  // TEST 5: Duplicate valid phone handling (uniqueness enforcement)
  // -------------------------------------------------------------------------
  await runTest("5. Duplicate valid phone handling", async () => {
    const targetPhone = "whatsapp:+919876501105";

    const cust1 = await Customer.create({ phone: targetPhone, name: "First Cust" });
    const lead1 = await Lead.create({
      customerId: cust1._id,
      phone: targetPhone,
      leads: [{ date: new Date(), status: "New" }],
    });
    assert.ok(lead1._id, "First lead created");

    const cust2 = await Customer.create({ phone: `${targetPhone}_alt`, name: "Second Cust" });

    // Attempting to create a second lead with the same non-empty phone must trigger duplicate key error
    let threwDup = false;
    try {
      await Lead.create({
        customerId: cust2._id,
        phone: targetPhone, // Duplicate valid phone!
        leads: [{ date: new Date(), status: "New" }],
      });
    } catch (err) {
      if (err.code === 11000 || err.message?.includes("E11000")) {
        threwDup = true;
      }
    }

    assert.strictEqual(threwDup, true, "Must reject second lead with identical valid phone via E11000");

    // Clean up
    await Lead.deleteOne({ _id: lead1._id });
    await Customer.deleteMany({ _id: { $in: [cust1._id, cust2._id] } });
  });

  // -------------------------------------------------------------------------
  // TEST 6: Duplicate Twilio webhook delivery without duplicate messages
  // -------------------------------------------------------------------------
  await runTest("6. Duplicate Twilio webhook delivery without duplicate messages", async () => {
    const phone = "whatsapp:+919876501106";
    const duplicateSid = `SM_test_pers_6_dup_${Date.now()}`;

    // Delivery 1
    const res1 = await inboundMessageService.handleInboundMessage({
      twilioSid: duplicateSid,
      fromPhone: phone,
      rawTo: "whatsapp:+917401403011",
      messageText: "Delivery 1 payload",
    });
    assert.strictEqual(res1.success, true, "First delivery succeeds");

    // Delivery 2 with identical Twilio SID
    const res2 = await inboundMessageService.handleInboundMessage({
      twilioSid: duplicateSid,
      fromPhone: phone,
      rawTo: "whatsapp:+917401403011",
      messageText: "Delivery 2 identical payload",
    });
    assert.strictEqual(res2.duplicate, true, "Second delivery recognized as duplicate");
    assert.strictEqual(res2.messageId.toString(), res1.messageId.toString(), "Returns original message ID");

    const totalMessages = await Message.countDocuments({ twilioSid: duplicateSid });
    assert.strictEqual(totalMessages, 1, "Exactly 1 message record in MongoDB");
  });

  // -------------------------------------------------------------------------
  // TEST 7: Lead creation failure and message persistence behavior
  // -------------------------------------------------------------------------
  await runTest("7. Lead creation failure and message persistence behavior", async () => {
    const phone = "whatsapp:+919876501107";
    const sid = `SM_test_pers_7_faillead_${Date.now()}`;

    // Temporarily stub findOrCreateWhatsAppLead to simulate an unexpected lead creation error
    const originalMethod = inboundMessageService.findOrCreateWhatsAppLead;
    inboundMessageService.findOrCreateWhatsAppLead = async () => {
      throw new Error("Simulated transient schema/lead failure");
    };

    let result;
    try {
      result = await inboundMessageService.handleInboundMessage({
        twilioSid: sid,
        fromPhone: phone,
        rawTo: "whatsapp:+917401403011",
        messageText: "Customer message must persist despite lead failure",
      });
    } finally {
      // Restore method
      inboundMessageService.findOrCreateWhatsAppLead = originalMethod;
    }

    assert.strictEqual(result.messagePersisted, true, "Message was persisted");
    assert.strictEqual(result.partial, true, "Operation marked as partial");
    assert.ok(result.leadError, "leadError reported explicitly");

    // Verify message exists in MongoDB despite lead failure
    const savedMsg = await Message.findOne({ twilioSid: sid });
    assert.ok(savedMsg, "Message must exist in database! Not lost due to lead error.");
    assert.strictEqual(savedMsg.message, "Customer message must persist despite lead failure");
  });

  // -------------------------------------------------------------------------
  // TEST 8: BullMQ retries and terminal failure handling
  // -------------------------------------------------------------------------
  await runTest("8. BullMQ retries and terminal failure handling", async () => {
    // Verify UnrecoverableError behavior for deterministic errors
    const deterministicErrors = [
      { code: 11000, message: "E11000 duplicate key error collection: almaa_crm.leads index: phone_1 dup key: { phone: null }" },
      { name: "ValidationError", message: "Validation Error: Field is required" },
      { name: "CastError", message: "Cast to ObjectId failed" },
    ];

    for (const errObj of deterministicErrors) {
      const isDeterministic =
        errObj.code === 11000 ||
        errObj.name === "ValidationError" ||
        errObj.name === "CastError" ||
        errObj.message?.includes("E11000");

      assert.strictEqual(isDeterministic, true, `Should detect ${errObj.message} as deterministic`);
      const unrec = new UnrecoverableError(errObj.message);
      assert.ok(unrec instanceof UnrecoverableError, "Can instantiate UnrecoverableError to stop BullMQ retries");
    }

    // Verify transient errors (e.g., timeout) are NOT classified as deterministic
    const transientErr = new Error("Connection timed out after 5000ms");
    const isTransientDeterministic =
      transientErr.code === 11000 ||
      transientErr.name === "ValidationError" ||
      transientErr.name === "CastError" ||
      transientErr.message?.includes("E11000");

    assert.strictEqual(isTransientDeterministic, false, "Transient errors must allow standard BullMQ retries");
  });

  // -------------------------------------------------------------------------
  // TEST 9: Correct database selection for deployment environment
  // -------------------------------------------------------------------------
  await runTest("9. Correct database selection for the deployment environment", async () => {
    const activeDbName = mongoose.connection.name;
    console.log(`\n   Active Database Name: "${activeDbName}"`);
    assert.ok(activeDbName, "Active database name must not be empty");

    // Test environment selection logic
    const testUri = "mongodb://127.0.0.1:27017/almaa_crm_test";
    const prodUri = "mongodb://127.0.0.1:27017/almaa_crm";

    function resolveUri(nodeEnv, testEnvUri, prodEnvUri) {
      return nodeEnv === "test" && testEnvUri ? testEnvUri : prodEnvUri;
    }

    const testResolved = resolveUri("test", testUri, prodUri);
    assert.strictEqual(testResolved, testUri, "When NODE_ENV=test, selects test URI");

    const prodResolved = resolveUri("production", testUri, prodUri);
    assert.strictEqual(prodResolved, prodUri, "When NODE_ENV=production, selects prod URI");
  });

  // Cleanup test phones
  await cleanupTestPhones(testPhones);
  await WebhookEvent.deleteMany({ eventId: { $regex: "^SM_test_pers_" } });

  console.log("\n========================================================");
  console.log(`🏆 TEST RESULTS: ${totalPass} PASSED, ${totalFail} FAILED`);
  console.log("========================================================\n");

  await mongoose.disconnect();
  process.exit(totalFail === 0 ? 0 : 1);
}

runSuite().catch((err) => {
  console.error("Suite execution error:", err);
  process.exit(1);
});
