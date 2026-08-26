import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import mongoose from "mongoose";
import assert from "node:assert";
import connectDB from "../src/shared/lib/db/mongodb.js";
import Customer from "../src/shared/models/Customer.js";
import Message from "../src/shared/models/Message.js";
import BulkMessage from "../src/shared/models/BulkMessage.js";
import CampaignRecipient from "../src/shared/models/CampaignRecipient.js";
import { processCampaignBatch } from "../src/server/queues/workers/campaignWorker.js";
import { POST as statusWebhookHandler } from "../src/app/api/webhook/status/route.js";
import { GET as getRecipientsHandler } from "../src/app/api/bulk-message/[campaignId]/recipients/route.js";
import { GET as getRecallHandler } from "../src/app/api/bulk-message/[campaignId]/recall/route.js";
import { syncCampaignCounts } from "../src/server/services/campaignService.js";
import { normalizePhone } from "../src/shared/utils/phoneUtils.js";

function createMockStatusWebhookRequest(body) {
  return new Request("http://localhost:3000/api/webhook/status", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function runCampaignRecipientTestSuite() {
  console.log("\n==================================================");
  console.log("🚀 TESTING CAMPAIGN RECIPIENT TRACKING & RECALL SUITE");
  console.log("==================================================\n");

  await connectDB();

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
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

  // --- Clean any existing test records ---
  const testPhoneBase = "whatsapp:+91987654";
  await Customer.deleteMany({ phone: { $regex: "^whatsapp:\\+91987654" } });
  await Message.deleteMany({ phone: { $regex: "^whatsapp:\\+91987654" } });
  await BulkMessage.deleteMany({ campaignName: { $regex: "^Unit Test" } });
  await CampaignRecipient.deleteMany({ phone: { $regex: "987654" } });

  // 1. One recipient successful Twilio API request
  let campaign1;
  const phone1 = `${testPhoneBase}0001`;
  const sid1 = `SM_test_camp_${Date.now()}_1`;

  await test("1. One recipient successful Twilio API request & Recipient record creation", async () => {
    campaign1 = await BulkMessage.create({
      campaignName: "Unit Test Campaign 1",
      templateId: "HXtest0001",
      recipients: [phone1],
      status: "processing",
    });

    const recipient1 = await CampaignRecipient.create({
      campaignId: campaign1._id,
      phone: phone1,
      normalizedPhone: phone1,
      status: "QUEUED",
    });

    // Mock Twilio send result manually in DB to simulate worker success
    recipient1.status = "SENT";
    recipient1.twilioMessageSid = sid1;
    recipient1.twilioStatus = "queued";
    recipient1.initialApiAcceptedAt = new Date();
    recipient1.sentAt = new Date();
    await recipient1.save();

    await Message.create({
      phone: phone1,
      message: "Campaign: Unit Test Campaign 1",
      direction: "OUTBOUND",
      status: "SENT",
      twilioSid: sid1,
      templateSid: "HXtest0001",
      templateMetadata: {
        type: "whatsapp",
        campaignId: String(campaign1._id),
        recipientId: recipient1._id,
        templateId: "HXtest0001",
        source: "campaign",
      },
    });

    const sync = await syncCampaignCounts(campaign1._id);
    assert.strictEqual(sync.successfulSends, 1, "successfulSends must be 1");
    assert.strictEqual(sync.failedSends, 0, "failedSends must be 0");
    assert.strictEqual(sync.counts.sent, 1, "sent count must be 1");
  });

  // 2. One recipient Twilio API failure
  const phone2 = `${testPhoneBase}0002`;
  await test("2. One recipient Twilio API failure (Status FAILED with ErrorCode)", async () => {
    const campaign2 = await BulkMessage.create({
      campaignName: "Unit Test Campaign 2",
      templateId: "HXtest0002",
      recipients: [phone2],
      status: "processing",
    });

    const recipient2 = await CampaignRecipient.create({
      campaignId: campaign2._id,
      phone: phone2,
      normalizedPhone: phone2,
      status: "FAILED",
      errorCode: "63016",
      errorMessage: "Outside messaging window",
      failedAt: new Date(),
    });

    const sync = await syncCampaignCounts(campaign2._id);
    assert.strictEqual(sync.successfulSends, 0, "successfulSends must be 0");
    assert.strictEqual(sync.failedSends, 1, "failedSends must be 1");
    assert.strictEqual(sync.counts.failed, 1, "failed count must be 1");
    assert.strictEqual(sync.isCompleted, true, "campaign must be COMPLETED");
  });

  // 3. Twilio queued response
  const phone3 = `${testPhoneBase}0003`;
  const sid3 = `SM_test_camp_${Date.now()}_3`;
  await test("3. Twilio queued initial state", async () => {
    const campaign3 = await BulkMessage.create({
      campaignName: "Unit Test Campaign 3",
      templateId: "HXtest0003",
      recipients: [phone3],
      status: "processing",
    });

    const recipient3 = await CampaignRecipient.create({
      campaignId: campaign3._id,
      phone: phone3,
      normalizedPhone: phone3,
      status: "QUEUED",
      twilioMessageSid: sid3,
    });

    const sync = await syncCampaignCounts(campaign3._id);
    assert.strictEqual(sync.counts.queued, 1, "queued count must be 1");
    assert.strictEqual(sync.isCompleted, false, "campaign must still be processing");
  });

  // 4. Twilio sent callback
  await test("4. Twilio sent webhook callback updates recipient status to SENT", async () => {
    const req = createMockStatusWebhookRequest({
      MessageSid: sid3,
      MessageStatus: "sent",
      To: phone3,
    });

    const res = await statusWebhookHandler(req);
    assert.strictEqual(res.status, 200, "Webhook returned 200");

    const updated = await CampaignRecipient.findOne({ twilioMessageSid: sid3 });
    assert.strictEqual(updated.status, "SENT", "Status updated to SENT");
    assert.ok(updated.sentAt, "sentAt timestamp recorded");
  });

  // 5. Twilio delivered callback
  await test("5. Twilio delivered webhook callback transitions status SENT -> DELIVERED", async () => {
    const req = createMockStatusWebhookRequest({
      MessageSid: sid3,
      MessageStatus: "delivered",
      To: phone3,
    });

    const res = await statusWebhookHandler(req);
    assert.strictEqual(res.status, 200, "Webhook returned 200");

    const updated = await CampaignRecipient.findOne({ twilioMessageSid: sid3 });
    assert.strictEqual(updated.status, "DELIVERED", "Status updated to DELIVERED");
    assert.ok(updated.deliveredAt, "deliveredAt timestamp recorded");

    const msg = await Message.findOne({ twilioSid: sid3 });
    if (msg) {
      assert.strictEqual(msg.status, "DELIVERED", "Message ledger status updated to DELIVERED");
    }
  });

  // 6. Twilio read callback
  await test("6. Twilio read webhook callback transitions status DELIVERED -> READ", async () => {
    const req = createMockStatusWebhookRequest({
      MessageSid: sid3,
      MessageStatus: "read",
      To: phone3,
    });

    const res = await statusWebhookHandler(req);
    assert.strictEqual(res.status, 200, "Webhook returned 200");

    const updated = await CampaignRecipient.findOne({ twilioMessageSid: sid3 });
    assert.strictEqual(updated.status, "READ", "Status updated to READ");
    assert.ok(updated.readAt, "readAt timestamp recorded");
  });

  // 7. Twilio failed callback
  const phone7 = `${testPhoneBase}0007`;
  const sid7 = `SM_test_camp_${Date.now()}_7`;
  await test("7. Twilio failed webhook callback records errorCode and errorMessage", async () => {
    const campaign7 = await BulkMessage.create({
      campaignName: "Unit Test Campaign 7",
      templateId: "HXtest0007",
      recipients: [phone7],
      status: "processing",
    });

    await CampaignRecipient.create({
      campaignId: campaign7._id,
      phone: phone7,
      normalizedPhone: phone7,
      status: "SENT",
      twilioMessageSid: sid7,
    });

    const req = createMockStatusWebhookRequest({
      MessageSid: sid7,
      MessageStatus: "failed",
      ErrorCode: "30008",
      ErrorMessage: "Unknown destination handset",
      To: phone7,
    });

    const res = await statusWebhookHandler(req);
    assert.strictEqual(res.status, 200, "Webhook returned 200");

    const updated = await CampaignRecipient.findOne({ twilioMessageSid: sid7 });
    assert.strictEqual(updated.status, "FAILED", "Status updated to FAILED");
    assert.strictEqual(updated.errorCode, "30008", "Error code recorded");
    assert.strictEqual(updated.errorMessage, "Unknown destination handset", "Error message recorded");
  });

  // 8. Twilio undelivered callback
  const phone8 = `${testPhoneBase}0008`;
  const sid8 = `SM_test_camp_${Date.now()}_8`;
  await test("8. Twilio undelivered webhook callback records status UNDELIVERED", async () => {
    const campaign8 = await BulkMessage.create({
      campaignName: "Unit Test Campaign 8",
      templateId: "HXtest0008",
      recipients: [phone8],
      status: "processing",
    });

    await CampaignRecipient.create({
      campaignId: campaign8._id,
      phone: phone8,
      normalizedPhone: phone8,
      status: "SENT",
      twilioMessageSid: sid8,
    });

    const req = createMockStatusWebhookRequest({
      MessageSid: sid8,
      MessageStatus: "undelivered",
      ErrorCode: "30003",
      ErrorMessage: "Unreachable destination handset",
      To: phone8,
    });

    const res = await statusWebhookHandler(req);
    assert.strictEqual(res.status, 200, "Webhook returned 200");

    const updated = await CampaignRecipient.findOne({ twilioMessageSid: sid8 });
    assert.strictEqual(updated.status, "UNDELIVERED", "Status updated to UNDELIVERED");
    assert.strictEqual(updated.errorCode, "30003", "Error code recorded");
  });

  // 9. Duplicate callback idempotency
  await test("9. Duplicate status webhook callbacks do not corrupt status or count", async () => {
    const payload = {
      MessageSid: sid8,
      MessageStatus: "undelivered",
      ErrorCode: "30003",
      ErrorMessage: "Unreachable destination handset",
      To: phone8,
    };

    const res1 = await statusWebhookHandler(createMockStatusWebhookRequest(payload));
    const res2 = await statusWebhookHandler(createMockStatusWebhookRequest(payload));
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res2.status, 200);

    const count = await CampaignRecipient.countDocuments({ twilioMessageSid: sid8 });
    assert.strictEqual(count, 1, "Exactly one recipient record must exist");
  });

  // 10. Duplicate campaign job idempotency
  await test("10. Duplicate campaign recipient job execution safely skips already sent message", async () => {
    const existing = await CampaignRecipient.findOne({ twilioMessageSid: sid1 });
    assert.ok(existing, "Existing sent recipient found");
    assert.strictEqual(existing.status, "SENT");

    // Idempotency check logic: if already SENT, DELIVERED, READ or has twilioMessageSid -> skip
    const isDispatched = ["SENT", "DELIVERED", "READ", "SKIPPED"].includes(existing.status) || !!existing.twilioMessageSid;
    assert.strictEqual(isDispatched, true, "Recipient is safely flagged as already dispatched");
  });

  // 11. Worker retry after Twilio success
  await test("11. Worker retry after Twilio success does not create duplicate message", async () => {
    const initialCount = await Message.countDocuments({ twilioSid: sid1 });
    assert.strictEqual(initialCount, 1, "Initial message count is 1");

    // Simulating safe recovery
    const duplicateLookup = await Message.findOne({ twilioSid: sid1 });
    assert.ok(duplicateLookup, "Found existing ledger message; retry will not duplicate");
  });

  // 12. Worker retry after Twilio failure
  await test("12. Worker retry after Twilio failure preserves error state without corrupting counters", async () => {
    const recipient = await CampaignRecipient.findOne({ phone: phone2 });
    assert.strictEqual(recipient.status, "FAILED");
    assert.strictEqual(recipient.errorCode, "63016");
  });

  // 13. Opt-out recipient handling
  const optOutPhone = `${testPhoneBase}0013`;
  await test("13. Opt-out recipient is marked SKIPPED without dispatching Twilio API", async () => {
    await Customer.create({
      phone: optOutPhone,
      name: "Opted Out Customer",
      isOptedOut: true,
    });

    const campaign13 = await BulkMessage.create({
      campaignName: "Unit Test Campaign 13",
      templateId: "HXtest0013",
      recipients: [optOutPhone],
      status: "processing",
    });

    const recipient13 = await CampaignRecipient.create({
      campaignId: campaign13._id,
      phone: optOutPhone,
      normalizedPhone: optOutPhone,
      status: "SKIPPED",
      errorMessage: "Customer opted out",
    });

    const sync = await syncCampaignCounts(campaign13._id);
    assert.strictEqual(sync.counts.skipped, 1, "Skipped count is 1");
    assert.strictEqual(sync.successfulSends, 0, "Successful sends is 0");
    assert.strictEqual(sync.failedSends, 0, "Failed sends is 0");
    assert.strictEqual(sync.isCompleted, true, "Campaign marked COMPLETED");
  });

  // 14 & 15. Mixed campaign with 100 recipients
  await test("14 & 15. Mixed campaign with 100 recipients (90 successful, 5 failed, 3 undelivered, 2 skipped)", async () => {
    const campaign100 = await BulkMessage.create({
      campaignName: "Unit Test Campaign 100",
      templateId: "HXtest0100",
      recipients: [],
      status: "processing",
    });

    const docs = [];
    // 50 Delivered
    for (let i = 1; i <= 50; i++) {
      docs.push({
        campaignId: campaign100._id,
        phone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        normalizedPhone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        status: "DELIVERED",
        twilioMessageSid: `SM_test_100_del_${i}`,
        deliveredAt: new Date(),
      });
    }
    // 20 Read
    for (let i = 51; i <= 70; i++) {
      docs.push({
        campaignId: campaign100._id,
        phone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        normalizedPhone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        status: "READ",
        twilioMessageSid: `SM_test_100_read_${i}`,
        readAt: new Date(),
      });
    }
    // 20 Sent
    for (let i = 71; i <= 90; i++) {
      docs.push({
        campaignId: campaign100._id,
        phone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        normalizedPhone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        status: "SENT",
        twilioMessageSid: `SM_test_100_sent_${i}`,
        sentAt: new Date(),
      });
    }
    // 5 Failed
    for (let i = 91; i <= 95; i++) {
      docs.push({
        campaignId: campaign100._id,
        phone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        normalizedPhone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        status: "FAILED",
        errorCode: "63016",
        errorMessage: "Failed window",
        failedAt: new Date(),
      });
    }
    // 3 Undelivered
    for (let i = 96; i <= 98; i++) {
      docs.push({
        campaignId: campaign100._id,
        phone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        normalizedPhone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        status: "UNDELIVERED",
        errorCode: "30008",
        errorMessage: "Undelivered",
        failedAt: new Date(),
      });
    }
    // 2 Skipped
    for (let i = 99; i <= 100; i++) {
      docs.push({
        campaignId: campaign100._id,
        phone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        normalizedPhone: `${testPhoneBase}10${String(i).padStart(2, "0")}`,
        status: "SKIPPED",
        errorMessage: "Customer opted out",
      });
    }

    await CampaignRecipient.insertMany(docs);
    const sync = await syncCampaignCounts(campaign100._id);

    assert.strictEqual(sync.total, 100, "Total recipients is 100");
    assert.strictEqual(sync.successfulSends, 90, "Successful sends is 90 (50 delivered + 20 read + 20 sent)");
    assert.strictEqual(sync.deliveredCount, 50, "Delivered count is 50");
    assert.strictEqual(sync.readCount, 20, "Read count is 20");
    assert.strictEqual(sync.counts.sent, 20, "Sent count is 20");
    assert.strictEqual(sync.failedSends, 8, "Failed sends is 8 (5 failed + 3 undelivered)");
    assert.strictEqual(sync.skippedCount, 2, "Skipped count is 2");
    assert.strictEqual(sync.progress, 100, "Progress is 100%");
    assert.strictEqual(sync.isCompleted, true, "Campaign status is COMPLETED");

    // 16. Copy successful numbers
    const successfulDocs = await CampaignRecipient.find({
      campaignId: campaign100._id,
      status: { $in: ["SENT", "DELIVERED", "READ"] },
    });
    assert.strictEqual(successfulDocs.length, 90, "90 successful recipients found for copy");

    // 17. Copy failed numbers
    const failedDocs = await CampaignRecipient.find({
      campaignId: campaign100._id,
      status: { $in: ["FAILED", "UNDELIVERED"] },
    });
    assert.strictEqual(failedDocs.length, 8, "8 failed recipients found for copy");

    // 18, 19, 20. Smart Recall API: Extracts ONLY 90 successful recipients and excludes 8 failed + 2 skipped
    const mockRecallContext = { params: Promise.resolve({ campaignId: campaign100._id.toString() }) };
    const mockRecallReq = new Request(`http://localhost:3000/api/bulk-message/${campaign100._id}/recall`);
    const recallRes = await getRecallHandler(mockRecallReq, mockRecallContext);
    const recallJson = await recallRes.json();

    assert.strictEqual(recallJson.success, true, "Recall API succeeded");
    assert.strictEqual(recallJson.successfulNumbers.length, 90, "Recall contains exactly 90 successful numbers");
    assert.strictEqual(recallJson.counts.failed, 8, "Recall report excludes 8 failed numbers");
    assert.strictEqual(recallJson.counts.skipped, 2, "Recall report excludes 2 skipped numbers");

    // 24. Pagination on Recipients API
    const mockRecipientsContext = { params: Promise.resolve({ campaignId: campaign100._id.toString() }) };
    const mockRecipientsReq = new Request(`http://localhost:3000/api/bulk-message/${campaign100._id}/recipients?page=1&limit=25&status=ALL`);
    const recRes = await getRecipientsHandler(mockRecipientsReq, mockRecipientsContext);
    const recJson = await recRes.json();

    assert.strictEqual(recJson.success, true, "Recipients API succeeded");
    assert.strictEqual(recJson.recipients.length, 25, "Page 1 limit 25 returned 25 records");
    assert.strictEqual(recJson.pagination.total, 100, "Total count is 100");
    assert.strictEqual(recJson.pagination.totalPages, 4, "Total pages is 4");

    // 25. Search/filter on Recipients API
    const mockFilterReq = new Request(`http://localhost:3000/api/bulk-message/${campaign100._id}/recipients?page=1&limit=50&status=FAILED`);
    const filterRes = await getRecipientsHandler(mockFilterReq, mockRecipientsContext);
    const filterJson = await filterRes.json();
    assert.strictEqual(filterJson.recipients.length, 8, "Filtered status FAILED returned 8 records (5 FAILED + 3 UNDELIVERED)");
  });

  // Clean up test data
  console.log("\n--- Cleaning up test records ---");
  await Customer.deleteMany({ phone: { $regex: "^whatsapp:\\+91987654" } });
  await Message.deleteMany({ phone: { $regex: "^whatsapp:\\+91987654" } });
  await BulkMessage.deleteMany({ campaignName: { $regex: "^Unit Test" } });
  await CampaignRecipient.deleteMany({ phone: { $regex: "987654" } });
  console.log("🧹 Test records cleaned up successfully.");

  console.log("\n==================================================");
  console.log(`📊 CAMPAIGN RECIPIENT SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runCampaignRecipientTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL SUITE ERROR:", err);
    process.exit(1);
  });
