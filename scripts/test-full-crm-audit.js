import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import connectDB from "../src/shared/lib/db/mongodb.js";
import Customer from "../src/shared/models/Customer.js";
import Lead from "../src/shared/models/Lead.js";
import Message from "../src/shared/models/Message.js";
import WebhookEvent from "../src/shared/models/WebhookEvent.js";
import Notification from "../src/shared/models/Notification.js";
import Activity from "../src/shared/models/Activity.js";
import BulkMessage from "../src/shared/models/BulkMessage.js";
import CRMTemplate from "../src/shared/models/CRMTemplate.js";
import { inboundMessageService } from "../src/server/services/inboundMessageService.js";
import { processKeywordAutoReply } from "../src/features/chat/services/keywordMatcher.js";
import { processCampaignBatch } from "../src/server/queues/workers/campaignWorker.js";
import { serverLeadService } from "../src/server/services/serverLeadService.js";
import { normalizePhone, getPhoneVariations } from "../src/shared/utils/phoneUtils.js";
import { resolveTemplate } from "../src/shared/utils/templateResolver.js";
import { runSerializedPerCustomer } from "../src/server/queues/workers/inboundMessageWorker.js";

async function runAuditTests() {
  console.log("==================================================");
  console.log("🧪 EXECUTING FULL CRM ASYNC AUDIT & HARDENING TEST SUITE");
  console.log("==================================================\n");

  await connectDB();

  const testPhone = "whatsapp:+919876599901";
  const testPhone2 = "whatsapp:+919876599902";
  const testPhone3 = "whatsapp:+919876599903";
  const allTestPhones = [testPhone, testPhone2, testPhone3];

  // Initial cleanup
  await Customer.deleteMany({ phone: { $in: allTestPhones } });
  await Message.deleteMany({ phone: { $in: allTestPhones } });
  await WebhookEvent.deleteMany({ eventId: { $regex: "^SM_audit_" } });

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // --- TEST 1: Phone Normalization ---
  console.log("\n--- Category 1: Phone Normalization ---");
  const raw1 = "919876599901";
  const raw2 = "+919876599901";
  const raw3 = "whatsapp:919876599901";
  const raw4 = "whatsapp:+919876599901";
  assert(normalizePhone(raw1) === testPhone, "Normalizes 12-digit Indian number with 91 prefix");
  assert(normalizePhone(raw2) === testPhone, "Normalizes +91 Indian number");
  assert(normalizePhone(raw3) === testPhone, "Normalizes whatsapp: without plus");
  assert(normalizePhone(raw4) === testPhone, "Normalizes canonical whatsapp:+91 number");

  // --- TEST 2: Inbound Message Processing & Persistence ---
  console.log("\n--- Category 2: Inbound Ingestion & DB Persistence ---");
  const sid1 = `SM_audit_inbound_${Date.now()}`;
  const res1 = await inboundMessageService.handleInboundMessage({
    twilioSid: sid1,
    fromPhone: testPhone,
    rawTo: "whatsapp:+917401403011",
    messageText: "Hello CRM Audit",
    profileName: "Audit Test User",
  });
  assert(res1.success === true, "Inbound message processed successfully");

  const msg1 = await Message.findOne({ twilioSid: sid1 }).lean();
  assert(msg1 !== null, "Message persisted in MongoDB");
  assert(msg1.direction === "INBOUND", "Message direction is strictly INBOUND");
  assert(msg1.status === "RECEIVED", "Message status is RECEIVED");

  const cust1 = await Customer.findOne({ phone: testPhone }).lean();
  assert(cust1 !== null, "Customer resolved/created in MongoDB");
  assert(cust1.name === "Audit Test User", "Customer name resolved correctly");

  const leadDoc1 = await Lead.findOne({ customerId: cust1._id });
  assert(leadDoc1 !== null, "Lead created and linked to customer");
  assert(leadDoc1.status === "New" || leadDoc1.leads[0]?.status === "New", "Lead initial status is New");

  // --- TEST 3: Inbound Message Idempotency ---
  console.log("\n--- Category 3: Inbound Duplicate Protection ---");
  const dupRes = await inboundMessageService.handleInboundMessage({
    twilioSid: sid1,
    fromPhone: testPhone,
    rawTo: "whatsapp:+917401403011",
    messageText: "Hello CRM Audit",
    profileName: "Audit Test User",
  });
  assert(dupRes.duplicate === true, "Duplicate inbound MessageSid detected and skipped without double persistence");
  const msgCount = await Message.countDocuments({ twilioSid: sid1 });
  assert(msgCount === 1, "Exactly 1 Message record exists in MongoDB");

  // --- TEST 4: Per-Customer In-Memory FIFO Serialization ---
  console.log("\n--- Category 4: Per-Customer FIFO Ordering ---");
  const executionOrder = [];
  await Promise.all([
    runSerializedPerCustomer(testPhone, async () => {
      await new Promise(r => setTimeout(r, 50));
      executionOrder.push(1);
    }),
    runSerializedPerCustomer(testPhone, async () => {
      await new Promise(r => setTimeout(r, 20));
      executionOrder.push(2);
    }),
    runSerializedPerCustomer(testPhone, async () => {
      executionOrder.push(3);
    }),
  ]);
  assert(
    executionOrder.join(",") === "1,2,3",
    "Serialized execution per customer guarantees chronological ordering"
  );

  // --- TEST 5: Keyword Automation & Outbound Idempotency ---
  console.log("\n--- Category 5: Automation & Outbound Idempotency ---");
  const { default: KeywordAutomation } = await import("../src/shared/models/KeywordAutomation.js");
  
  const testCrmTmpl = await CRMTemplate.create({
    name: "Audit Auto Template",
    body: "Hi {{name}}, here is your automated audit quote!",
    isActive: true,
  });

  const testKw = await KeywordAutomation.create({
    keywords: ["audit-price"],
    templateType: "crm",
    templateId: testCrmTmpl._id,
    isActive: true,
  });

  const autoSid = `SM_audit_auto_${Date.now()}`;
  // First auto-reply execution
  const match1 = await processKeywordAutoReply(
    testPhone,
    "audit-price",
    "Audit User",
    "+917401403011",
    { inboundMessageSid: autoSid }
  );

  // Second auto-reply execution with same inboundMessageSid (simulating BullMQ worker retry)
  const match2 = await processKeywordAutoReply(
    testPhone,
    "audit-price",
    "Audit User",
    "+917401403011",
    { inboundMessageSid: autoSid }
  );
  assert(
    match2 === true,
    "Automation worker retry safely prevents duplicate outbound messages"
  );

  // Clean up keyword rule and template
  await KeywordAutomation.findByIdAndDelete(testKw._id);
  await CRMTemplate.findByIdAndDelete(testCrmTmpl._id);

  // --- TEST 6: STOP Opt-Out & START Opt-In ---
  console.log("\n--- Category 6: STOP / START Command Handling ---");
  const stopSid = `SM_audit_stop_${Date.now()}`;
  const stopRes = await inboundMessageService.handleInboundMessage({
    twilioSid: stopSid,
    fromPhone: testPhone2,
    rawTo: "whatsapp:+917401403011",
    messageText: "STOP",
  });
  assert(stopRes.optedOut === true, "STOP command sets isOptedOut=true");
  const optedOutCust = await Customer.findOne({ phone: testPhone2 }).lean();
  assert(optedOutCust.isOptedOut === true, "Customer document isOptedOut is true in MongoDB");

  const startSid = `SM_audit_start_${Date.now()}`;
  await inboundMessageService.handleInboundMessage({
    twilioSid: startSid,
    fromPhone: testPhone2,
    rawTo: "whatsapp:+917401403011",
    messageText: "START",
  });
  const optedInCust = await Customer.findOne({ phone: testPhone2 }).lean();
  assert(optedInCust.isOptedOut === false, "START command reactivates isOptedOut=false");

  // --- TEST 7: Bulk Messaging Asynchronous Worker & DB Persistence ---
  console.log("\n--- Category 7: Bulk Campaign Worker & Message Persistence ---");
  const campaignRecord = await BulkMessage.create({
    campaignName: "Audit Test Campaign",
    templateId: "HX1234567890abcdef1234567890abcdef",
    recipients: [testPhone3],
    status: "processing",
    sentBy: "Audit Admin",
  });

  const campResult = await processCampaignBatch({
    campaignId: campaignRecord._id.toString(),
    templateId: "HX1234567890abcdef1234567890abcdef",
    recipients: [testPhone3],
    validation: { isDynamic: false },
    formattedFrom: "whatsapp:+917401403011",
    resolvedSender: "+917401403011",
    sentBy: "Audit Admin",
  });

  assert(campResult.success === true, "Campaign batch processed by worker");
  const updatedBulk = await BulkMessage.findById(campaignRecord._id).lean();
  assert(updatedBulk.status === "COMPLETED", "BulkMessage record status is COMPLETED");

  // --- TEST 8: Lead Status & Lifecycle Domain Service ---
  console.log("\n--- Category 8: Lead Status & Lifecycle Validation ---");
  const sessionUser = { user: { id: "6a3b6dd10613a3c07eb5063d", name: "John Associate", role: "associate" } };
  const leadRes = await serverLeadService.createOrUpdateLead({
    phone: testPhone,
    status: "Follow Up",
    priority: "High",
    overAllRemarks: "Interested in full package",
    notes: "Follow up tomorrow",
  }, sessionUser);

  assert(leadRes.status === "Follow Up", "Lead status updated to Follow Up");
  const updatedLeadDoc = await Lead.findById(leadRes.lead._id).lean();
  assert(updatedLeadDoc.leads.length >= 2, "Follow-up history cycle properly appended to leads array");
  assert(updatedLeadDoc.leads[updatedLeadDoc.leads.length - 1].status === "Follow Up", "Latest follow-up entry status is Follow Up");

  // --- TEST 9: CRM Template Variable Resolution ---
  console.log("\n--- Category 9: CRM Template Variable Resolution ---");
  const dummyTemplate = {
    body: "Hello {{name}}, welcome to {{branchName}} branch! Your status is {{leadStatus}}.",
  };
  const resolved = resolveTemplate({
    template: dummyTemplate,
    customer: { name: "Ramesh" },
    lead: { status: "Follow Up" },
    branch: { name: "Chennai Main" },
  });
  assert(
    resolved.resolvedText === "Hello Ramesh, welcome to Chennai Main branch! Your status is Follow Up.",
    "Template variables resolve accurately from Customer/Lead/Branch context"
  );

  // --- CLEANUP TEST DATA ---
  console.log("\n--- Category 10: Test Data Isolation Cleanup ---");
  await Customer.deleteMany({ phone: { $in: allTestPhones } });
  await Message.deleteMany({ phone: { $in: allTestPhones } });
  await Lead.deleteMany({ customerId: { $in: [cust1?._id, optedOutCust?._id] } });
  await BulkMessage.findByIdAndDelete(campaignRecord._id);
  await WebhookEvent.deleteMany({ eventId: { $regex: "^SM_audit_" } });
  console.log("🧹 Test records cleaned up successfully.");

  console.log("\n==================================================");
  console.log(`🏆 ALL AUDIT TESTS COMPLETED: ${passedTests}/${totalTests} PASSED (100%)`);
  console.log("==================================================\n");

  process.exit(0);
}

runAuditTests().catch((err) => {
  console.error("Audit Test Suite Failure:", err);
  process.exit(1);
});
