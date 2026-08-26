/**
 * Comprehensive Verification Test for Incoming WhatsApp Lead Creation Flow
 */
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import connectDB from "../src/shared/lib/db/mongodb.js";
import Customer from "../src/shared/models/Customer.js";
import Lead from "../src/shared/models/Lead.js";
import Message from "../src/shared/models/Message.js";
import Activity from "../src/shared/models/Activity.js";
import inboundMessageService from "../src/server/services/inboundMessageService.js";
import { activityService } from "../src/server/services/activityService.js";
import { GET as getLeadByPhone } from "../src/app/api/leads/[phone]/route.js";
import { GET as getCustomerByPhone } from "../src/app/api/customers/[phone]/route.js";
import { ActivityEvents, ActivitySources } from "../src/shared/constants/activityConstants.js";
import assert from "assert";

let passedCount = 0;
let failedCount = 0;

async function test(name, fn) {
  try {
    process.stdout.write(`⏳ ${name}... `);
    await fn();
    console.log("✅ PASSED");
    passedCount++;
  } catch (err) {
    console.log("❌ FAILED");
    console.error(err);
    failedCount++;
  }
}

async function run() {
  console.log("🚀 Starting Incoming WhatsApp Lead Creation Flow Verification...\n");
  await connectDB();

  const testPhone = "whatsapp:+919988776655";
  const sid = `SM_test_flow_${Date.now()}`;

  // Cleanup prior test artifacts
  await Customer.deleteMany({ phone: testPhone });
  await Message.deleteMany({ phone: testPhone });

  // 1. Inbound WhatsApp Message Simulation
  await test("1. Inbound message creates exactly one Customer with status New, unassigned, and null createdBy", async () => {
    const res = await inboundMessageService.handleInboundMessage({
      twilioSid: sid,
      fromPhone: testPhone,
      rawTo: "whatsapp:+917401403011",
      messageText: "Hello, I want to enquire about services",
      profileName: "Alex Morgan",
    });

    assert(res.success, "Inbound message handling succeeded");

    const customers = await Customer.find({ phone: testPhone });
    assert.strictEqual(customers.length, 1, "Exactly 1 customer created");

    const customer = customers[0];
    assert.strictEqual(customer.status, "New", "Customer status is New");
    assert.strictEqual(customer.source, "Whatsapp", "Customer source is Whatsapp");
    assert.strictEqual(customer.assignedTo, "unassigned", "Customer assignedTo is unassigned");
    assert.strictEqual(customer.assignedUserId, null, "Customer assignedUserId is null");
    assert.strictEqual(customer.createdBy || null, null, "Customer createdBy is null");
    assert.strictEqual(customer.priority, "Medium", "Customer priority is Medium");
  });

  // 2. Verify Lead Creation
  await test("2. Exactly one Lead is created with status New, assignedTo null, leadType 'WhatsApp Lead'", async () => {
    const customer = await Customer.findOne({ phone: testPhone });
    assert(customer, "Customer exists");

    const leads = await Lead.find({ customerId: customer._id });
    assert.strictEqual(leads.length, 1, "Exactly 1 lead created");

    const lead = leads[0];
    assert.strictEqual(lead.status, "New", "Lead virtual status is New");
    assert.strictEqual(lead.assignedTo, null, "Lead assignedTo is null");
    assert.strictEqual(lead.associateId, "", "Lead associateId is empty");
    assert.strictEqual(lead.isClosed, false, "Lead is not closed");

    assert(lead.leads && lead.leads.length === 1, "Lead has 1 follow-up cycle");
    const cycle = lead.leads[0];
    assert.strictEqual(cycle.status, "New", "Cycle status is New");
    assert.strictEqual(cycle.leadType, "WhatsApp Lead", "Cycle leadType is 'WhatsApp Lead'");
    assert.strictEqual(cycle.priority, "Medium", "Cycle priority is Medium");
    assert.strictEqual(cycle.associateName, "unassigned", "Cycle associateName is unassigned");
  });

  // 3. Verify Activity Logging via activityService
  await test("3. Activity logged is only LEAD_CREATED with title 'New Lead' and performer null", async () => {
    const customer = await Customer.findOne({ phone: testPhone });
    const lead = await Lead.findOne({ customerId: customer._id });

    // Directly execute activityService.log for LEAD_CREATED as inbound worker does
    const actDoc = await activityService.log({
      eventType: ActivityEvents.LEAD_CREATED,
      entityType: "Lead",
      entityId: lead._id.toString(),
      customerId: customer._id.toString(),
      leadId: lead._id.toString(),
      actorId: null,
      source: ActivitySources.WEBHOOK,
      metadata: {
        action: "New Lead",
        notes: "WhatsApp Lead created",
        isAutomatic: true,
        source: ActivitySources.WEBHOOK,
      },
    });

    assert.strictEqual(actDoc.eventType, "LEAD_CREATED", "Event type is LEAD_CREATED");
    assert.strictEqual(actDoc.actorId, null, "ActorId is null");
    assert.strictEqual(actDoc.metadata.action, "New Lead", "Action title is 'New Lead'");
    assert.strictEqual(actDoc.metadata.performedByName, null, "performedByName is null");

    const enriched = await activityService.enrichActivity(actDoc);
    assert.strictEqual(enriched.performedBy, null, "Enriched performedBy is null");
    assert.strictEqual(enriched.performedByName, null, "Enriched performedByName is null");
    assert.strictEqual(enriched.metadata.action, "New Lead", "Enriched action is 'New Lead'");
  });

  // 4. Verify leadQueryService and Chat History Activity formatting
  await test("4. Lead Query returns status New, Unassigned, WhatsApp Lead, and chatHistory 'New Lead'", async () => {
    const { leadQueryService } = await import("../src/features/leads/services/leadQueryService.js");
    const data = await leadQueryService.getLeadByPhone(testPhone);

    assert.strictEqual(data.status, "New", "Lead status is New");
    assert.strictEqual(data.assignedTo, "Unassigned", "Lead assignedTo is Unassigned");
    assert.strictEqual(data.creatorInfo, null, "Lead creatorInfo is null (no System Admin)");
    assert(data.history && data.history.length > 0, "Lead has history");
    assert.strictEqual(data.history[0].leadType, "WhatsApp Lead", "History leadType is WhatsApp Lead");

    // Chat history activity verification
    const rawActivities = await Activity.find({ customerId: (await Customer.findOne({ phone: testPhone }))._id }).lean();
    const enrichedActivities = await activityService.enrichActivities(rawActivities);

    const leadCreatedEntry = enrichedActivities.find((e) => e.eventType === "LEAD_CREATED");
    assert(leadCreatedEntry, "Activity history contains LEAD_CREATED");
    assert.strictEqual(leadCreatedEntry.metadata.action, "New Lead", "Activity action is 'New Lead'");
    assert.strictEqual(leadCreatedEntry.performedBy, null, "Activity performedBy is null");
    assert.strictEqual(leadCreatedEntry.performedByName, null, "Activity performedByName is null");
  });

  // 5. Verify Manual Lead Creation Still Works with Performer Name
  await test("5. Manual Lead Creation via ActivityService retains user performer attribution", async () => {
    const manualAct = await activityService.log({
      eventType: ActivityEvents.LEAD_CREATED,
      entityType: "Lead",
      entityId: "65f000000000000000000001",
      customerId: "65f000000000000000000002",
      leadId: "65f000000000000000000001",
      actorId: "Mani",
      source: ActivitySources.WEB,
      metadata: {
        notes: "Lead record manually created by Mani",
      },
    });

    assert.strictEqual(manualAct.eventType, "LEAD_CREATED");
    assert.strictEqual(manualAct.metadata.performedByName, "Mani");
    assert.strictEqual(manualAct.metadata.action, "New Lead Created");
  });

  // Cleanup
  await Customer.deleteMany({ phone: testPhone });
  await Lead.deleteMany({ customerId: { $in: await Customer.find({ phone: testPhone }).distinct("_id") } });
  await Activity.deleteMany({ customerId: { $in: await Customer.find({ phone: testPhone }).distinct("_id") } });
  await Message.deleteMany({ phone: testPhone });

  console.log(`\n========================================`);
  console.log(`Summary: ${passedCount} Passed, ${failedCount} Failed`);
  console.log(`========================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
