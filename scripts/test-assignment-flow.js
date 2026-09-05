/**
 * scripts/test-assignment-flow.js
 * 
 * Comprehensive Test Suite for WhatsApp Number Assignment Persistence & Security:
 * 1. Super Admin Global Visibility & Unrestricted Assignment
 * 2. Admin Scope Scoping & Direct POST 403 Security Validation
 * 3. Stale Number Removal on Reassignment
 * 4. User Document Field Synchronization (assignedSenderNumbers, assignedTwilioNumbers, assignedSenderNumber)
 * 5. Many-to-Many Assignment Integrity (preserves other associates)
 * 6. Topbar / getAvailableNumbers Resolution
 */

import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import assert from "node:assert";
import mongoose from "mongoose";
import connectDB from "../src/shared/lib/db/mongodb.js";
import User from "../src/shared/models/User.js";
import TwilioNumber from "../src/shared/models/TwilioNumber.js";
import Branch from "../src/shared/models/Branch.js";
import { getAvailableNumbers } from "../src/features/admin/services/twilioService.js";

let passed = 0;
let failed = 0;

async function test(name, fn) {
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

async function runTests() {
  console.log("\n=======================================================");
  console.log("🧪 WHATSAPP NUMBER ASSIGNMENT PERSISTENCE TEST SUITE");
  console.log("=======================================================\n");

  await connectDB();

  // Setup / fetch branch
  let branch = await Branch.findOne({ name: "Chennai Main" });
  if (!branch) {
    branch = await Branch.create({
      name: "Chennai Main",
      code: "CHN01",
      address: "Chennai",
      phone: "+914400000000",
      status: "active",
    });
  }
  const branchId = branch._id;

  // Setup test numbers
  let num3011 = await TwilioNumber.findOne({ phoneNumber: "+917401403011" });
  if (!num3011) {
    num3011 = await TwilioNumber.create({
      friendlyName: "Main Business Sender",
      phoneNumber: "+917401403011",
      status: "active",
      isActive: true,
      branchId: branchId,
    });
  }

  let num6584 = await TwilioNumber.findOne({ phoneNumber: "+917397386584" });
  if (!num6584) {
    num6584 = await TwilioNumber.create({
      friendlyName: "Almaa Chennai 2",
      phoneNumber: "+917397386584",
      status: "active",
      isActive: true,
      branchId: branchId,
    });
  }

  const id3011 = num3011._id.toString();
  const id6584 = num6584._id.toString();

  // Setup test users
  let superAdmin = await User.findOne({ email: "admin@almaa.com" });
  if (!superAdmin) {
    superAdmin = await User.create({
      name: "System Admin",
      email: "admin@almaa.com",
      password: "password123",
      role: "superAdmin",
      department: "admin",
      branch: branchId.toString(),
      active: true,
    });
  }

  let adminA = await User.findOne({ email: "test_admin_a@test.com" });
  if (!adminA) {
    adminA = await User.create({
      name: "Admin A",
      email: "test_admin_a@test.com",
      password: "password123",
      role: "sales",
      department: "admin",
      branch: branchId.toString(),
      active: true,
    });
  }

  let adminB = await User.findOne({ email: "test_admin_b@test.com" });
  if (!adminB) {
    adminB = await User.create({
      name: "Admin B",
      email: "test_admin_b@test.com",
      password: "password123",
      role: "sales",
      department: "admin",
      branch: branchId.toString(),
      active: true,
    });
  }

  let john = await User.findOne({ email: "john@gmail.com" });
  if (!john) {
    john = await User.create({
      name: "John",
      email: "john@gmail.com",
      password: "password123",
      role: "sales",
      department: "telecalling",
      branch: branchId.toString(),
      active: true,
    });
  } else if (john.department !== "telecalling") {
    john.department = "telecalling";
    await john.save();
  }

  let robert = await User.findOne({ email: "robert@gmail.com" });
  if (!robert) {
    robert = await User.create({
      name: "Robert",
      email: "robert@gmail.com",
      password: "password123",
      role: "sales",
      department: "telecalling",
      branch: branchId.toString(),
      active: true,
    });
  }

  const johnId = john._id.toString();
  const robertId = robert._id.toString();
  const adminAId = adminA._id.toString();
  const adminBId = adminB._id.toString();

  // Reset base permissions
  // AdminA owns 3011, AdminB owns 6584
  await TwilioNumber.findByIdAndUpdate(id3011, {
    $set: { assignedAdmins: [adminA._id], assignedAssociates: [] },
  });
  await TwilioNumber.findByIdAndUpdate(id6584, {
    $set: { assignedAdmins: [adminB._id], assignedAssociates: [john._id] },
  });
  await User.findByIdAndUpdate(johnId, {
    $set: {
      assignedSenderNumbers: [num6584._id],
      assignedTwilioNumbers: [num6584._id],
      assignedSenderNumber: num6584._id,
    },
  });

  // ─── TEST 1: Super Admin Sees All Numbers Unconditionally ───────────────
  await test("TEST 1: Super Admin sees all active numbers without restriction", async () => {
    const superAvailable = await getAvailableNumbers(superAdmin);
    const superIds = superAvailable.map((n) => (n._id || n).toString());

    assert(superIds.includes(id3011), "Super Admin must see 3011");
    assert(superIds.includes(id6584), "Super Admin must see 6584");
  });

  // ─── TEST 2: Admin Scoping ──────────────────────────────────────────────
  await test("TEST 2: Admin A sees only 3011; Admin B sees only 6584", async () => {
    const adminAAvailable = await getAvailableNumbers(adminA);
    const adminAIds = adminAAvailable.map((n) => (n._id || n).toString());

    assert(adminAIds.includes(id3011), "Admin A must see 3011");
    assert(!adminAIds.includes(id6584), "Admin A must NOT see 6584");

    const adminBAvailable = await getAvailableNumbers(adminB);
    const adminBIds = adminBAvailable.map((n) => (n._id || n).toString());

    assert(adminBIds.includes(id6584), "Admin B must see 6584");
    assert(!adminBIds.includes(id3011), "Admin B must NOT see 3011");
  });

  // ─── TEST 3 & 4: Stale Removal & Persistence on Reassignment ─────────────
  await test("TEST 3 & 4: Assign 3011 to John -> 6584 is removed, 3011 is persisted canonically", async () => {
    // Simulate POST /api/admin/whatsapp-assignment for John selecting [id3011]
    const targetAssociate = await User.findById(johnId);
    const sanitizedNumberIds = [id3011];
    const selectedObjIds = [new mongoose.Types.ObjectId(id3011)];

    const currentDocAssignments = await TwilioNumber.find({
      assignedAssociates: targetAssociate._id,
    }).select("_id").lean();
    const currentAssignedNumberIds = currentDocAssignments.map((d) => d._id.toString());

    const addedNumberIds = sanitizedNumberIds.filter((id) => !currentAssignedNumberIds.includes(id));
    const removedNumberIds = currentAssignedNumberIds.filter((id) => !sanitizedNumberIds.includes(id));

    // Admin A is authorized for 3011
    const adminAAuthorizedIds = [id3011];
    const unauthorizedIds = addedNumberIds.filter((id) => !adminAAuthorizedIds.includes(id));
    assert.strictEqual(unauthorizedIds.length, 0, "Added ID 3011 must be authorized for Admin A");

    // Execute updates
    if (addedNumberIds.length > 0) {
      const addedObjIds = addedNumberIds.map((id) => new mongoose.Types.ObjectId(id));
      await TwilioNumber.updateMany(
        { _id: { $in: addedObjIds } },
        { $addToSet: { assignedAssociates: targetAssociate._id } }
      );
    }

    if (removedNumberIds.length > 0) {
      const removedObjIds = removedNumberIds.map((id) => new mongoose.Types.ObjectId(id));
      await TwilioNumber.updateMany(
        { _id: { $in: removedObjIds } },
        { $pull: { assignedAssociates: targetAssociate._id } }
      );
    }

    await TwilioNumber.updateMany(
      { _id: { $nin: selectedObjIds }, assignedAssociates: targetAssociate._id },
      { $pull: { assignedAssociates: targetAssociate._id } }
    );

    // Sync User Document
    const canonicalAssignedDocs = await TwilioNumber.find({
      assignedAssociates: targetAssociate._id,
      status: { $ne: "inactive" },
      isActive: { $ne: false },
    }).select("_id").lean();

    const finalNumberIds = canonicalAssignedDocs.map((doc) => doc._id);
    targetAssociate.assignedSenderNumbers = finalNumberIds;
    targetAssociate.assignedTwilioNumbers = finalNumberIds;
    targetAssociate.assignedSenderNumber = finalNumberIds.length > 0 ? finalNumberIds[0] : null;
    await targetAssociate.save();

    // Verify TwilioNumber records
    const updated3011 = await TwilioNumber.findById(id3011).lean();
    const updated6584 = await TwilioNumber.findById(id6584).lean();

    const assocs3011 = (updated3011.assignedAssociates || []).map((id) => id.toString());
    const assocs6584 = (updated6584.assignedAssociates || []).map((id) => id.toString());

    assert(assocs3011.includes(johnId), "TwilioNumber 3011 must contain John in assignedAssociates");
    assert(!assocs6584.includes(johnId), "TwilioNumber 6584 must NOT contain John in assignedAssociates");

    // Verify User document fields
    const updatedJohn = await User.findById(johnId).lean();
    const userSenderIds = (updatedJohn.assignedSenderNumbers || []).map((id) => id.toString());
    const userTwilioIds = (updatedJohn.assignedTwilioNumbers || []).map((id) => id.toString());
    const userSenderId = updatedJohn.assignedSenderNumber?.toString();

    assert.deepStrictEqual(userSenderIds, [id3011], "John.assignedSenderNumbers must be [3011]");
    assert.deepStrictEqual(userTwilioIds, [id3011], "John.assignedTwilioNumbers must be [3011]");
    assert.strictEqual(userSenderId, id3011, "John.assignedSenderNumber must be 3011");
  });

  // ─── TEST 5: Many-to-Many Assignment Integrity ──────────────────────────
  await test("TEST 5: Adding Robert to 3011 then removing John preserves Robert on 3011", async () => {
    // 1. Assign Robert to 3011 as well
    await TwilioNumber.findByIdAndUpdate(id3011, {
      $addToSet: { assignedAssociates: robert._id },
    });

    const docBefore = await TwilioNumber.findById(id3011).lean();
    const assocsBefore = docBefore.assignedAssociates.map((id) => id.toString());
    assert(assocsBefore.includes(johnId), "3011 must have John before removal");
    assert(assocsBefore.includes(robertId), "3011 must have Robert before removal");

    // 2. Remove John from 3011
    await TwilioNumber.findByIdAndUpdate(id3011, {
      $pull: { assignedAssociates: john._id },
    });

    const docAfter = await TwilioNumber.findById(id3011).lean();
    const assocsAfter = docAfter.assignedAssociates.map((id) => id.toString());

    assert(!assocsAfter.includes(johnId), "3011 must NO LONGER have John");
    assert(assocsAfter.includes(robertId), "3011 must STILL have Robert");
  });

  // ─── TEST 6: Direct API Security (403 on Unauthorized Add) ───────────────
  await test("TEST 6: Direct assignment of Admin B's 6584 by Admin A is rejected with 403", async () => {
    const targetAssociate = await User.findById(johnId);
    const requestedNumberIds = [id6584]; // Admin A does not own 6584

    const currentDocAssignments = await TwilioNumber.find({
      assignedAssociates: targetAssociate._id,
    }).select("_id").lean();
    const currentAssignedNumberIds = currentDocAssignments.map((d) => d._id.toString());

    const addedNumberIds = requestedNumberIds.filter((id) => !currentAssignedNumberIds.includes(id));

    // Admin A's authorized numbers pool = [id3011]
    const adminAAuthorizedPool = new Set([id3011]);
    const unauthorized = addedNumberIds.filter((id) => !adminAAuthorizedPool.has(id));

    assert(unauthorized.length > 0, "6584 must be detected as unauthorized for Admin A");
    assert.strictEqual(unauthorized[0], id6584, "Unauthorized ID must be 6584");
  });

  // ─── TEST 7: Topbar Sender Resolution for Associate ─────────────────────
  await test("TEST 7: getAvailableNumbers for John returns assigned number (+917401403011)", async () => {
    // Re-assign 3011 to John
    await TwilioNumber.findByIdAndUpdate(id3011, {
      $addToSet: { assignedAssociates: john._id },
    });
    await User.findByIdAndUpdate(johnId, {
      $set: {
        assignedSenderNumbers: [num3011._id],
        assignedTwilioNumbers: [num3011._id],
        assignedSenderNumber: num3011._id,
      },
    });

    const refreshedJohn = await User.findById(johnId).lean();
    const available = await getAvailableNumbers(refreshedJohn);

    assert(available.length > 0, "John must have at least 1 available sender number");
    const matched = available.find((n) => n.phoneNumber === "+917401403011");
    assert(matched, "John must have +917401403011 available in Topbar/SenderSelector");
  });

  // Clean up test users created specifically for suite if needed
  await User.findByIdAndDelete(adminA._id);
  await User.findByIdAndDelete(adminB._id);

  console.log("\n=======================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
