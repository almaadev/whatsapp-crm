import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import mongoose from "mongoose";
import connectDB from "../src/shared/lib/db/mongodb.js";
import User from "../src/shared/models/User.js";
import Customer from "../src/shared/models/Customer.js";
import Lead from "../src/shared/models/Lead.js";
import Activity from "../src/shared/models/Activity.js";
import { ActivityEvents } from "../src/shared/constants/activityConstants.js";
import Notification from "../src/shared/models/Notification.js";
import { serverChatService } from "../src/server/services/serverChatService.js";
import { activityService } from "../src/server/services/activityService.js";
import { notificationService } from "../src/server/services/notificationService.js";
import { getActivityTitle, formatActorDisplayName } from "../src/shared/utils/activityFormatter.js";
import { getSystemEventDetails } from "../src/shared/utils/chatUtils.js";

async function runUserRenameSyncTests() {
  console.log("==================================================");
  console.log("🧪 EXECUTING USER RENAME & IDENTITY RESOLUTION TEST SUITE");
  console.log("==================================================\n");

  await connectDB();

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = "") {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${testName} ${details ? `-> ${details}` : ""}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  const testSuffix = Date.now();
  const testPhone = `whatsapp:+9199999${String(testSuffix).slice(-5)}`;
  const adminEmail = `admin_${testSuffix}@example.com`;
  const agentEmail = `agent_${testSuffix}@example.com`;

  let systemAdminUser, agentUser, testCustomer, testLead;

  try {
    // ----------------------------------------------------
    // SETUP: Clean up any old test data & create test users
    // ----------------------------------------------------
    console.log("--- Setup: Creating Test Entities ---");

    systemAdminUser = await User.create({
      name: "System Admin",
      email: adminEmail,
      password: "Password123!",
      role: "sales",
      department: "admin",
      isAdmin: true,
      branch: "all",
      active: true
    });

    agentUser = await User.create({
      name: "Agent Sarah",
      email: agentEmail,
      password: "Password123!",
      role: "sales",
      department: "telecalling",
      isAdmin: false,
      branch: "Main Branch",
      active: true
    });

    testCustomer = await Customer.create({
      phone: testPhone,
      name: "Test Client",
      status: "New",
      assignedUserId: agentUser._id,
      assignedTo: agentUser.name,
      createdBy: systemAdminUser._id
    });

    testLead = await Lead.create({
      customerId: testCustomer._id,
      associateId: agentUser._id.toString(),
      assignedTo: agentUser.name,
      leads: [{
        date: new Date(),
        associateId: agentUser._id.toString(),
        associateName: agentUser.name,
        status: "New"
      }]
    });

    testCustomer.activeLeadId = testLead._id;
    await testCustomer.save();

    console.log(`Created System Admin (${systemAdminUser._id}), Agent (${agentUser._id}), Customer (${testCustomer._id}), Lead (${testLead._id})\n`);

    // ----------------------------------------------------
    // TEST 1: Activity Creation with "System Admin"
    // ----------------------------------------------------
    console.log("--- Test 1: Chat Closed Action by 'System Admin' ---");

    // Close chat using serverChatService
    await serverChatService.updateChatControlStatus(testPhone, true, "direct", {
      user: { id: systemAdminUser._id.toString(), name: systemAdminUser.name, role: "sales" }
    });

    // Verify Customer record updated in DB
    const updatedCustomer = await Customer.findOne({ phone: testPhone });
    assert(updatedCustomer.isClosed === true, "Customer isClosed set to true");
    assert(
      String(updatedCustomer.closedById) === String(systemAdminUser._id),
      "Customer closedById reference correctly stored"
    );

    // Find the created activity document
    const closeActivity = await Activity.findOne({
      customerId: testCustomer._id,
      eventType: ActivityEvents.CHAT_CLOSED
    }).lean();

    assert(Boolean(closeActivity), "Activity document created for CHAT_CLOSED");
    assert(String(closeActivity.actorId) === String(systemAdminUser._id), "Activity actorId points to System Admin user ID");
    assert(closeActivity.metadata?.action === "Chat Closed by System Admin", "Historical Activity contains static snapshot metadata");

    // ----------------------------------------------------
    // TEST 2: Initial Resolution with User = "System Admin"
    // ----------------------------------------------------
    console.log("\n--- Test 2: Initial Activity Resolution Before Rename ---");

    const enrichedBefore = await activityService.enrichActivity(closeActivity);
    assert(
      enrichedBefore.metadata.action === "Chat Closed by System Admin",
      "Dynamic activity title resolves to 'Chat Closed by System Admin'",
      `Got: ${enrichedBefore.metadata.action}`
    );

    // ----------------------------------------------------
    // TEST 3: RENAME USER System Admin -> John
    // (WITHOUT modifying Activity document!)
    // ----------------------------------------------------
    console.log("\n--- Test 3: Renaming System Admin -> John in MongoDB ---");

    await User.findByIdAndUpdate(systemAdminUser._id, { name: "John" });
    const refreshedUser = await User.findById(systemAdminUser._id);
    assert(refreshedUser.name === "John", "User name successfully changed in MongoDB to 'John'");

    // Verify the Activity document itself is completely UNCHANGED
    const rawActivityUnchanged = await Activity.findById(closeActivity._id).lean();
    assert(
      rawActivityUnchanged.metadata?.action === "Chat Closed by System Admin",
      "Activity in DB still contains original snapshot (untouched for audit integrity)"
    );

    // ----------------------------------------------------
    // TEST 4: Dynamic Activity Title Resolution After Rename
    // ----------------------------------------------------
    console.log("\n--- Test 4: Dynamic Resolution After Rename ---");

    const enrichedAfter = await activityService.enrichActivity(rawActivityUnchanged);
    assert(
      enrichedAfter.metadata.action === "Chat Closed by John",
      "Dynamic activity title resolves to 'Chat Closed by John' without modifying Activity doc",
      `Got: ${enrichedAfter.metadata.action}`
    );
    assert(
      enrichedAfter.performedByName === "John",
      "Enriched performedByName reflects current user name 'John'",
      `Got: ${enrichedAfter.performedByName}`
    );

    // ----------------------------------------------------
    // TEST 5: chatUtils.getSystemEventDetails Resolution
    // ----------------------------------------------------
    console.log("\n--- Test 5: chatUtils getSystemEventDetails Dynamic Resolution ---");

    // Populated event item (as would be returned by API or socket)
    const populatedEvent = {
      ...rawActivityUnchanged,
      actorId: { _id: systemAdminUser._id, name: "John", role: "sales" }
    };
    const eventDetails = getSystemEventDetails(populatedEvent);
    assert(
      eventDetails.title === "Chat Closed",
      "getSystemEventDetails returns clean standardized title 'Chat Closed'",
      `Got: ${eventDetails.title}`
    );
    assert(
      eventDetails.performedBy === "John",
      "getSystemEventDetails resolves current performedBy to 'John'",
      `Got: ${eventDetails.performedBy}`
    );

    // ----------------------------------------------------
    // TEST 6: activityFormatter Resolution Across All Event Types
    // ----------------------------------------------------
    console.log("\n--- Test 6: getActivityTitle Across Event Types ---");

    const actorJohn = { name: "John" };
    assert(
      getActivityTitle(ActivityEvents.CHAT_CLOSED, actorJohn) === "Chat Closed by John",
      "CHAT_CLOSED: 'Chat Closed by John'"
    );
    assert(
      getActivityTitle(ActivityEvents.CHAT_REOPENED, actorJohn) === "Chat Reopened by John",
      "CHAT_REOPENED: 'Chat Reopened by John'"
    );
    assert(
      getActivityTitle("NOTE_ADDED", actorJohn) === "Note Added by John",
      "NOTE_ADDED: 'Note Added by John'"
    );
    assert(
      getActivityTitle("TAG_ADDED", actorJohn, { tag: "VIP" }) === "Tag Added by John",
      "TAG_ADDED: 'Tag Added by John'"
    );
    assert(
      getActivityTitle(ActivityEvents.LEAD_ASSIGNED, actorJohn, { targetUser: { name: "Sarah" } }) === "Lead Assigned to Sarah by John",
      "LEAD_ASSIGNED with targetUser: 'Lead Assigned to Sarah by John'"
    );
    assert(
      getActivityTitle(ActivityEvents.FOLLOWUP_CREATED, actorJohn) === "Follow Up Created by John",
      "FOLLOWUP_CREATED: 'Follow Up Created by John'"
    );
    assert(
      getActivityTitle(ActivityEvents.LEAD_STATUS_CHANGED, actorJohn, { newStatus: "WON" }) === "Lead Status Changed to WON by John",
      "LEAD_STATUS_CHANGED: 'Lead Status Changed to WON by John'"
    );

    // ----------------------------------------------------
    // TEST 7: Fallback to Historical Snapshot Name if User Deleted
    // ----------------------------------------------------
    console.log("\n--- Test 7: Historical Snapshot Fallback for Deleted Users ---");

    const deletedUserActivity = {
      eventType: ActivityEvents.CHAT_CLOSED,
      actorId: new mongoose.Types.ObjectId(), // Non-existent user
      metadata: {
        performedByName: "Old Historical Admin",
        action: "Chat Closed by Old Historical Admin"
      }
    };

    const enrichedDeletedUser = await activityService.enrichActivity(deletedUserActivity);
    assert(
      enrichedDeletedUser.performedByName === "Old Historical Admin",
      "Deleted user falls back to historical snapshot name 'Old Historical Admin'",
      `Got: ${enrichedDeletedUser.performedByName}`
    );
    assert(
      enrichedDeletedUser.metadata.action === "Chat Closed by Old Historical Admin",
      "Formatted title for deleted user uses snapshot name",
      `Got: ${enrichedDeletedUser.metadata.action}`
    );

    // ----------------------------------------------------
    // TEST 8: Notifications Dynamic Actor Name Resolution
    // ----------------------------------------------------
    console.log("\n--- Test 8: Notification Dynamic Actor Resolution ---");

    const notif = await Notification.create({
      recipientUserId: agentUser._id,
      title: "Lead Assigned by System Admin",
      message: "System Admin assigned you a new lead.",
      type: "lead_assigned",
      isDismissed: false,
      metadata: {
        actorUserId: systemAdminUser._id.toString(),
        actorName: "System Admin"
      }
    });

    const res = await notificationService.getNotifications(agentUser._id);
    const targetNotif = res.notifications.find(n => String(n._id) === String(notif._id));
    assert(Boolean(targetNotif), "Retrieved notification");
    assert(
      targetNotif.title.includes("John"),
      "Notification title dynamically updated to current actor name 'John'",
      `Got: ${targetNotif.title}`
    );
    assert(
      targetNotif.message.includes("John"),
      "Notification message dynamically updated to current actor name 'John'",
      `Got: ${targetNotif.message}`
    );

    // ----------------------------------------------------
    // TEST 9: Chat Reopen by Renamed User
    // ----------------------------------------------------
    console.log("\n--- Test 9: Chat Reopen & Customer Resolution ---");

    await serverChatService.updateChatControlStatus(
      testPhone,
      false,
      "direct",
      { user: { id: systemAdminUser._id.toString(), name: "John", role: "sales" } }
    );

    const reopenedCust = await Customer.findOne({ phone: testPhone })
      .populate("closedById", "name email")
      .populate("reopenedById", "name email")
      .populate("assignedUserId", "name email");

    assert(reopenedCust.isClosed === false, "Customer status reopened to active (isClosed = false)");
    assert(reopenedCust.reopenedById?.name === "John", "Customer.reopenedById populated resolves to 'John'");

    // Rename John -> "John Doe"
    await User.findByIdAndUpdate(systemAdminUser._id, { name: "John Doe" });

    // Refetch Customer with population
    const refetchedCust = await Customer.findOne({ phone: testPhone })
      .populate("closedById", "name email")
      .populate("reopenedById", "name email")
      .populate("assignedUserId", "name email");

    assert(
      refetchedCust.closedById?.name === "John Doe",
      "Customer closedById dynamically reflects secondary rename to 'John Doe'"
    );
    assert(
      refetchedCust.reopenedById?.name === "John Doe",
      "Customer reopenedById dynamically reflects secondary rename to 'John Doe'"
    );

    // ----------------------------------------------------
    // TEST 10: Lead Query Service Identity Resolution
    // ----------------------------------------------------
    console.log("\n--- Test 10: leadQueryService Dynamic Resolution ---");

    const { leadQueryService } = await import("../src/features/leads/services/leadQueryService.js");

    // Agent Sarah -> rename to "Sarah Connor"
    await User.findByIdAndUpdate(agentUser._id, { name: "Sarah Connor" });

    const leadData = await leadQueryService.getLeadByPhone(testPhone);
    assert(
      leadData.assignedTo === "Sarah Connor",
      "leadQueryService.getLeadByPhone dynamically resolves assignedTo to 'Sarah Connor'",
      `Got: ${leadData.assignedTo}`
    );
    assert(
      leadData.creatorInfo?.name === "John Doe",
      "leadQueryService.getLeadByPhone dynamically resolves creatorInfo.name to 'John Doe'",
      `Got: ${leadData.creatorInfo?.name}`
    );

    console.log("\n==================================================");
    console.log(`🎉 ALL ${passedTests}/${totalTests} USER RENAME SYNC TESTS PASSED!`);
    console.log("==================================================");

  } finally {
    // Cleanup
    console.log("\n--- Cleaning up test records ---");
    await User.deleteMany({ email: { $in: [adminEmail, agentEmail] } });
    await Customer.deleteMany({ phone: testPhone });
    await Lead.deleteMany({ phone: testPhone });
    await Activity.deleteMany({ phone: testPhone });
    await Notification.deleteMany({ "metadata.actorUserId": { $in: [systemAdminUser?._id, agentUser?._id] } });
    await mongoose.disconnect();
  }
}

runUserRenameSyncTests().catch((err) => {
  console.error("❌ Test Suite Encountered Error:", err);
  process.exit(1);
});
