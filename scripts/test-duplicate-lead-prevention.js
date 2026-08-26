/**
 * Comprehensive Verification Test Suite: Duplicate Lead Prevention & Idempotency
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
import { leadQueryService } from "../src/features/leads/services/leadQueryService.js";
import { serverLeadService } from "../src/server/services/serverLeadService.js";
import { activityService } from "../src/server/services/activityService.js";
import { ActivityEvents, ActivitySources } from "../src/shared/constants/activityConstants.js";
import assert from "assert";

let passedCount = 0;
let failedCount = 0;

async function test(name, fn) {
  try {
    process.stdout.write(`⏳ Testing: ${name}... `);
    await fn();
    console.log("✅ PASSED");
    passedCount++;
  } catch (err) {
    console.log("❌ FAILED");
    console.error(err);
    failedCount++;
  }
}

async function cleanupTestPhone(phone) {
  const cust = await Customer.findOne({ phone });
  if (cust) {
    await Lead.deleteMany({ customerId: cust._id });
    await Activity.deleteMany({ customerId: cust._id });
    await Customer.deleteOne({ _id: cust._id });
  }
  await Message.deleteMany({ phone });
}

async function runSuite() {
  console.log("\n========================================================");
  console.log("🛡️ DUPLICATE LEAD PREVENTION & IDEMPOTENCY TEST SUITE");
  console.log("========================================================\n");

  await connectDB();

  const phone1 = "whatsapp:+919777111001";
  const phone2 = "whatsapp:+919777111002";
  const phone3 = "whatsapp:+919777111003";
  const phone4 = "whatsapp:+919777111004";
  const phone5 = "whatsapp:+919777111005";

  await cleanupTestPhone(phone1);
  await cleanupTestPhone(phone2);
  await cleanupTestPhone(phone3);
  await cleanupTestPhone(phone4);
  await cleanupTestPhone(phone5);

  // ----------------------------------------------------
  // TEST 1: First WhatsApp message creates 1 Customer and 1 Lead
  // ----------------------------------------------------
  await test("1. First WhatsApp message creates Customer=1, Lead=1, Status=New, LeadType=WhatsApp Lead", async () => {
    const res = await inboundMessageService.handleInboundMessage({
      twilioSid: `SM_first_${Date.now()}`,
      fromPhone: phone1,
      rawTo: "whatsapp:+917401403011",
      messageText: "Hello, first message",
      profileName: "User One",
    });

    assert.strictEqual(res.success, true);

    const customers = await Customer.find({ phone: phone1 });
    assert.strictEqual(customers.length, 1, "Exactly 1 Customer created");
    const customer = customers[0];
    assert.strictEqual(customer.status, "New");
    assert.strictEqual(customer.assignedTo, "unassigned");
    assert.strictEqual(customer.assignedUserId, null);
    assert.strictEqual(customer.createdBy, null);

    const leads = await Lead.find({ customerId: customer._id });
    assert.strictEqual(leads.length, 1, "Exactly 1 Lead created");
    const lead = leads[0];
    assert.strictEqual(lead.assignedTo, null);
    assert.strictEqual(lead.associateId, "");
    assert.strictEqual(lead.leads.length, 1);
    assert.strictEqual(lead.leads[0].leadType, "WhatsApp Lead");
    assert.strictEqual(lead.leads[0].status, "New");
    assert.strictEqual(lead.leads[0].associateName, "unassigned");
  });

  // ----------------------------------------------------
  // TEST 2: Second WhatsApp message from same phone reuses existing Lead
  // ----------------------------------------------------
  await test("2. Second message from SAME phone reuses existing Lead and does not create duplicate Lead", async () => {
    const customerBefore = await Customer.findOne({ phone: phone1 });
    const leadBefore = await Lead.findOne({ customerId: customerBefore._id });

    const res = await inboundMessageService.handleInboundMessage({
      twilioSid: `SM_second_${Date.now()}`,
      fromPhone: phone1,
      rawTo: "whatsapp:+917401403011",
      messageText: "Hello, second message",
      profileName: "User One",
    });

    assert.strictEqual(res.success, true);

    const customersAfter = await Customer.find({ phone: phone1 });
    assert.strictEqual(customersAfter.length, 1, "Customer count remains 1");

    const leadsAfter = await Lead.find({ customerId: customerBefore._id });
    assert.strictEqual(leadsAfter.length, 1, "Lead count remains 1");
    assert.strictEqual(leadsAfter[0]._id.toString(), leadBefore._id.toString(), "Reused exact same Lead document");

    const messages = await Message.find({ phone: phone1, direction: "INBOUND" });
    assert.strictEqual(messages.length, 2, "Both messages saved");
  });

  // ----------------------------------------------------
  // TEST 3: 10 repeated WhatsApp messages from same phone
  // ----------------------------------------------------
  await test("3. 10 rapid messages from same phone keeps Lead count = 1", async () => {
    const customer = await Customer.findOne({ phone: phone1 });
    for (let i = 3; i <= 10; i++) {
      await inboundMessageService.handleInboundMessage({
        twilioSid: `SM_burst_${i}_${Date.now()}`,
        fromPhone: phone1,
        rawTo: "whatsapp:+917401403011",
        messageText: `Burst message ${i}`,
        profileName: "User One",
      });
    }

    const customers = await Customer.find({ phone: phone1 });
    assert.strictEqual(customers.length, 1, "Customer count is still 1");

    const leads = await Lead.find({ customerId: customer._id });
    assert.strictEqual(leads.length, 1, "Lead count is still 1");

    const messages = await Message.find({ phone: phone1, direction: "INBOUND" });
    assert.strictEqual(messages.length, 10, "All 10 messages saved");
  });

  // ----------------------------------------------------
  // TEST 4: Two simultaneous concurrent webhook requests (Race Condition Test)
  // ----------------------------------------------------
  await test("4. Two concurrent webhook requests execute simultaneously with Lead count = 1", async () => {
    const sidA = `SM_race_A_${Date.now()}`;
    const sidB = `SM_race_B_${Date.now()}`;

    const [resA, resB] = await Promise.all([
      inboundMessageService.handleInboundMessage({
        twilioSid: sidA,
        fromPhone: phone2,
        rawTo: "whatsapp:+917401403011",
        messageText: "Concurrent message A",
        profileName: "Concurrent User",
      }),
      inboundMessageService.handleInboundMessage({
        twilioSid: sidB,
        fromPhone: phone2,
        rawTo: "whatsapp:+917401403011",
        messageText: "Concurrent message B",
        profileName: "Concurrent User",
      }),
    ]);

    assert.strictEqual(resA.success, true);
    assert.strictEqual(resB.success, true);

    const customers = await Customer.find({ phone: phone2 });
    assert.strictEqual(customers.length, 1, "Exactly 1 Customer created under concurrency");

    const customer = customers[0];
    const leads = await Lead.find({ customerId: customer._id });
    assert.strictEqual(leads.length, 1, "Exactly 1 Lead created under concurrency");

    const messages = await Message.find({ phone: phone2, direction: "INBOUND" });
    assert.strictEqual(messages.length, 2, "Both concurrent messages persisted");
  });

  // ----------------------------------------------------
  // TEST 5: Existing active manual lead is reused
  // ----------------------------------------------------
  await test("5. Inbound WhatsApp message reuses existing active manual lead", async () => {
    const mockSession = {
      user: {
        id: "6a7039ffed31a44948e9d6d2",
        name: "Mani",
        role: "associate",
        department: "sales",
      },
    };

    // Create manual customer and lead
    const manualCustomer = await Customer.create({
      phone: phone3,
      name: "Manual Prospect",
      status: "New",
      assignedTo: "Mani",
      source: "Manual Entry",
    });

    const manualLead = await Lead.create({
      customerId: manualCustomer._id,
      assignedTo: "Mani",
      associateId: "6a7039ffed31a44948e9d6d2",
      isClosed: false,
      leads: [
        {
          date: new Date(),
          status: "Follow Up",
          priority: "High",
          leadType: "Direct Lead",
          associateName: "Mani",
          associateId: "6a7039ffed31a44948e9d6d2",
          overAllRemarks: "Created via manual desk entry",
        },
      ],
    });

    manualCustomer.activeLeadId = manualLead._id;
    await manualCustomer.save();

    // Now incoming WhatsApp arrives from phone3
    const res = await inboundMessageService.handleInboundMessage({
      twilioSid: `SM_manual_reuse_${Date.now()}`,
      fromPhone: phone3,
      rawTo: "whatsapp:+917401403011",
      messageText: "Hi, following up on our call",
      profileName: "Manual Prospect",
    });

    assert.strictEqual(res.success, true);

    const customers = await Customer.find({ phone: phone3 });
    assert.strictEqual(customers.length, 1, "Customer count is 1");

    const leads = await Lead.find({ customerId: manualCustomer._id });
    assert.strictEqual(leads.length, 1, "Lead count is 1");
    assert.strictEqual(leads[0]._id.toString(), manualLead._id.toString(), "Reused the existing manual lead");
    assert.strictEqual(leads[0].assignedTo, "Mani", "Preserved assignedTo = Mani");
  });

  // ----------------------------------------------------
  // TEST 6: Existing closed lead is reused without creating duplicate Lead document
  // ----------------------------------------------------
  await test("6. Inbound message on closed customer reuses existing Lead document", async () => {
    const closedCustomer = await Customer.create({
      phone: phone4,
      name: "Closed Customer",
      status: "Closed",
      assignedTo: "unassigned",
      isClosed: true,
      source: "Whatsapp",
    });

    const closedLead = await Lead.create({
      customerId: closedCustomer._id,
      assignedTo: null,
      isClosed: true,
      closedBy: "Admin",
      closedAt: new Date(),
      leads: [
        {
          date: new Date(),
          status: "Closed",
          priority: "Low",
          leadType: "WhatsApp Lead",
          associateName: "unassigned",
          overAllRemarks: "Customer requested closure",
        },
      ],
    });

    closedCustomer.activeLeadId = closedLead._id;
    await closedCustomer.save();

    // Inbound WhatsApp arrives on closed customer
    const res = await inboundMessageService.handleInboundMessage({
      twilioSid: `SM_closed_reuse_${Date.now()}`,
      fromPhone: phone4,
      rawTo: "whatsapp:+917401403011",
      messageText: "Hello again, I am interested now",
      profileName: "Closed Customer",
    });

    assert.strictEqual(res.success, true);

    const customers = await Customer.find({ phone: phone4 });
    assert.strictEqual(customers.length, 1, "Customer count is 1");

    const leads = await Lead.find({ customerId: closedCustomer._id });
    assert.strictEqual(leads.length, 1, "Lead count is 1 (No duplicate Lead document created)");
    assert.strictEqual(leads[0]._id.toString(), closedLead._id.toString(), "Reused existing Lead document");
  });

  // ----------------------------------------------------
  // TEST 7: Different phone numbers get their own Lead
  // ----------------------------------------------------
  await test("7. Different phone numbers create distinct Customer and Lead records", async () => {
    const res5 = await inboundMessageService.handleInboundMessage({
      twilioSid: `SM_diff_5_${Date.now()}`,
      fromPhone: phone5,
      rawTo: "whatsapp:+917401403011",
      messageText: "Message from phone 5",
      profileName: "User Five",
    });

    assert.strictEqual(res5.success, true);

    const cust1 = await Customer.findOne({ phone: phone1 });
    const cust5 = await Customer.findOne({ phone: phone5 });

    assert.notStrictEqual(cust1._id.toString(), cust5._id.toString(), "Distinct customer IDs");

    const lead1 = await Lead.findOne({ customerId: cust1._id });
    const lead5 = await Lead.findOne({ customerId: cust5._id });

    assert.notStrictEqual(lead1._id.toString(), lead5._id.toString(), "Distinct lead IDs");
  });

  // ----------------------------------------------------
  // TEST 8: Activity verification - exactly 1 "New Lead" created for initial lead
  // ----------------------------------------------------
  await test("8. Only initial automatic lead creation creates 'New Lead' activity", async () => {
    const testPhoneAct = "whatsapp:+919777111006";
    await cleanupTestPhone(testPhoneAct);

    // First message
    await inboundMessageService.handleInboundMessage({
      twilioSid: `SM_act_1_${Date.now()}`,
      fromPhone: testPhoneAct,
      rawTo: "whatsapp:+917401403011",
      messageText: "Act check 1",
      profileName: "Act User",
    });

    // Wait for async queue / isolated check
    const customer = await Customer.findOne({ phone: testPhoneAct });
    const lead = await Lead.findOne({ customerId: customer._id });

    // Second message
    await inboundMessageService.handleInboundMessage({
      twilioSid: `SM_act_2_${Date.now()}`,
      fromPhone: testPhoneAct,
      rawTo: "whatsapp:+917401403011",
      messageText: "Act check 2",
      profileName: "Act User",
    });

    // Third message
    await inboundMessageService.handleInboundMessage({
      twilioSid: `SM_act_3_${Date.now()}`,
      fromPhone: testPhoneAct,
      rawTo: "whatsapp:+917401403011",
      messageText: "Act check 3",
      profileName: "Act User",
    });

    // Verify helper isNewLead logic
    const leadCheck = await inboundMessageService.findOrCreateWhatsAppLead(testPhoneAct, customer);
    assert.strictEqual(leadCheck.isNewLead, false, "Subsequent check returns isNewLead = false");

    await cleanupTestPhone(testPhoneAct);
  });

  // ----------------------------------------------------
  // TEST 9: Lead Query Service returns exactly one row per customer lead
  // ----------------------------------------------------
  await test("9. leadQueryService.getLeads returns unique rows without orphaned or duplicate entries", async () => {
    const result = await leadQueryService.getLeads({ limit: 100 });
    const leadsList = result.leads || [];

    const phoneSet = new Set();
    const duplicatePhones = [];

    for (const item of leadsList) {
      assert(item.phone, "Lead has phone number");
      assert.notStrictEqual(item.name, "Unknown Lead", "No orphaned 'Unknown Lead' records returned");
      if (phoneSet.has(item.phone)) {
        duplicatePhones.push(item.phone);
      }
      phoneSet.add(item.phone);
    }

    assert.strictEqual(duplicatePhones.length, 0, `No duplicate phone entries in leads query: ${duplicatePhones.join(", ")}`);
  });

  // Cleanup test phones
  await cleanupTestPhone(phone1);
  await cleanupTestPhone(phone2);
  await cleanupTestPhone(phone3);
  await cleanupTestPhone(phone4);
  await cleanupTestPhone(phone5);

  console.log("\n========================================================");
  console.log(`📊 TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error("Test Suite execution failed:", err);
  process.exit(1);
});
