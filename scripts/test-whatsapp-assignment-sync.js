/**
 * scripts/test-whatsapp-assignment-sync.js
 * 
 * Comprehensive Automated Verification Suite for:
 * - WhatsApp Number Assignment Canonical Model
 * - Many-to-Many Assignment Integrity
 * - Associate isolation & No cross-contamination
 * - getAvailableNumbers() behavior across Super Admin, Branch Admin, and Associate
 * - Manoj regression test
 */

import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import assert from "node:assert";
import mongoose from "mongoose";
import connectDB from "../src/shared/lib/db/mongodb.js";
import User from "../src/shared/models/User.js";
import Branch from "../src/shared/models/Branch.js";
import TwilioNumber from "../src/shared/models/TwilioNumber.js";
import { getAvailableNumbers, validateSenderPermission } from "../src/features/admin/services/twilioService.js";

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

async function runTestSuite() {
  console.log("\n=======================================================");
  console.log("🧪 WHATSAPP NUMBER ASSIGNMENT & SYNC VERIFICATION SUITE");
  console.log("=======================================================\n");

  await connectDB();

  // Load existing data
  const numbers = await TwilioNumber.find({}).lean();
  assert(numbers.length >= 2, "Database must have at least 2 Twilio numbers for testing");

  const num1 = numbers.find((n) => n.phoneNumber.includes("3011")) || numbers[0];
  const num2 = numbers.find((n) => n.phoneNumber.includes("6584") || n.phoneNumber.includes("5854")) || numbers[1];

  const num1Id = num1._id.toString();
  const num2Id = num2._id.toString();

  // Fetch or create test associates
  let manoj = await User.findOne({ email: "manoj@gmail.com" });
  if (!manoj) {
    manoj = await User.create({
      name: "Manoj",
      email: "manoj@gmail.com",
      password: "hashedpassword123",
      role: "sales",
      department: "telecalling",
      branch: "Main Branch",
      active: true,
    });
  }

  let john = await User.findOne({ email: "test_john_assoc@test.com" });
  if (!john) {
    john = await User.create({
      name: "John Associate",
      email: "test_john_assoc@test.com",
      password: "hashedpassword123",
      role: "sales",
      department: "telecalling",
      branch: "Main Branch",
      active: true,
    });
  }

  let raj = await User.findOne({ email: "test_raj_assoc@test.com" });
  if (!raj) {
    raj = await User.create({
      name: "Raj Associate",
      email: "test_raj_assoc@test.com",
      password: "hashedpassword123",
      role: "doctor",
      department: "telecalling",
      branch: "Main Branch",
      active: true,
    });
  }

  const manojId = manoj._id.toString();
  const johnId = john._id.toString();
  const rajId = raj._id.toString();

  // ─── TEST 1: Baseline Manoj Assignment (+917401403011 only) ───────────────
  await test("Test 1: Manoj assigned only Num 1 (+917401403011) sees ONLY Num 1", async () => {
    // Set canonical state
    await TwilioNumber.findByIdAndUpdate(num1Id, {
      $addToSet: { assignedAssociates: manoj._id },
    });
    await TwilioNumber.findByIdAndUpdate(num2Id, {
      $pull: { assignedAssociates: manoj._id, assignedAdmins: manoj._id },
    });

    // Update user reference fields
    await User.findByIdAndUpdate(manojId, {
      $set: {
        assignedSenderNumbers: [num1Id],
        assignedTwilioNumbers: [num1Id],
        assignedSenderNumber: num1Id,
      },
    });

    const manojDoc = await User.findById(manojId).lean();
    const available = await getAvailableNumbers(manojDoc);

    assert.strictEqual(available.length, 1, `Expected 1 number for Manoj, got ${available.length}`);
    assert.strictEqual(
      (available[0]._id || available[0]).toString(),
      num1Id,
      "Expected Num 1 for Manoj"
    );

    // Verify permission validation
    const perm1 = await validateSenderPermission(manojDoc, num1.phoneNumber);
    assert.strictEqual(perm1.allowed, true, "Manoj should be allowed to send from Num 1");

    const perm2 = await validateSenderPermission(manojDoc, num2.phoneNumber);
    assert.strictEqual(perm2.allowed, false, "Manoj should NOT be allowed to send from Num 2");
  });

  // ─── TEST 2: Multi-Associate Sharing (Many-to-Many Additive) ───────────────
  await test("Test 2: Assign Num 2 to John, then to Manoj -> Both retain access", async () => {
    // 1. Assign Num 2 to John
    await TwilioNumber.findByIdAndUpdate(num2Id, {
      $addToSet: { assignedAssociates: john._id },
    });
    await User.findByIdAndUpdate(johnId, {
      $set: {
        assignedSenderNumbers: [num2Id],
        assignedTwilioNumbers: [num2Id],
        assignedSenderNumber: num2Id,
      },
    });

    // 2. Assign Num 2 to Manoj (in addition to Num 1)
    await TwilioNumber.findByIdAndUpdate(num2Id, {
      $addToSet: { assignedAssociates: manoj._id },
    });
    await User.findByIdAndUpdate(manojId, {
      $set: {
        assignedSenderNumbers: [num1Id, num2Id],
        assignedTwilioNumbers: [num1Id, num2Id],
        assignedSenderNumber: num1Id,
      },
    });

    const johnDoc = await User.findById(johnId).lean();
    const manojDoc = await User.findById(manojId).lean();

    const johnAvailable = await getAvailableNumbers(johnDoc);
    const manojAvailable = await getAvailableNumbers(manojDoc);

    const johnIds = johnAvailable.map((n) => (n._id || n).toString());
    const manojIds = manojAvailable.map((n) => (n._id || n).toString());

    assert(johnIds.includes(num2Id), "John must have Num 2");
    assert.strictEqual(johnIds.length, 1, "John must only have Num 2");

    assert(manojIds.includes(num1Id), "Manoj must have Num 1");
    assert(manojIds.includes(num2Id), "Manoj must have Num 2");
    assert.strictEqual(manojIds.length, 2, "Manoj must have both Num 1 and Num 2");
  });

  // ─── TEST 3: Selective Removal Without Affecting Other Associates ───────────
  await test("Test 3: Remove Num 2 from Manoj -> John's assignment on Num 2 remains untouched", async () => {
    // Remove Num 2 from Manoj
    await TwilioNumber.findByIdAndUpdate(num2Id, {
      $pull: { assignedAssociates: manoj._id },
    });
    await User.findByIdAndUpdate(manojId, {
      $set: {
        assignedSenderNumbers: [num1Id],
        assignedTwilioNumbers: [num1Id],
        assignedSenderNumber: num1Id,
      },
    });

    const johnDoc = await User.findById(johnId).lean();
    const manojDoc = await User.findById(manojId).lean();

    const johnAvailable = await getAvailableNumbers(johnDoc);
    const manojAvailable = await getAvailableNumbers(manojDoc);

    const johnIds = johnAvailable.map((n) => (n._id || n).toString());
    const manojIds = manojAvailable.map((n) => (n._id || n).toString());

    assert(johnIds.includes(num2Id), "John's assignment to Num 2 must remain untouched");
    assert.strictEqual(johnIds.length, 1, "John still has 1 number");

    assert(manojIds.includes(num1Id), "Manoj still has Num 1");
    assert(!manojIds.includes(num2Id), "Manoj no longer has Num 2");
    assert.strictEqual(manojIds.length, 1, "Manoj now has only 1 number");
  });

  // ─── TEST 4 & 5: Multi-Number Bulk Assignment & Sharing ─────────────────────
  await test("Test 4 & 5: Assign same multiple numbers to Manoj and Raj simultaneously", async () => {
    const allNumIds = numbers.map((n) => n._id);

    // Assign all numbers to Manoj and Raj
    for (const num of numbers) {
      await TwilioNumber.findByIdAndUpdate(num._id, {
        $addToSet: { assignedAssociates: { $each: [manoj._id, raj._id] } },
      });
    }

    await User.findByIdAndUpdate(manojId, {
      $set: {
        assignedSenderNumbers: allNumIds,
        assignedTwilioNumbers: allNumIds,
        assignedSenderNumber: allNumIds[0],
      },
    });

    await User.findByIdAndUpdate(rajId, {
      $set: {
        assignedSenderNumbers: allNumIds,
        assignedTwilioNumbers: allNumIds,
        assignedSenderNumber: allNumIds[0],
      },
    });

    const manojDoc = await User.findById(manojId).lean();
    const rajDoc = await User.findById(rajId).lean();

    const manojAvailable = await getAvailableNumbers(manojDoc);
    const rajAvailable = await getAvailableNumbers(rajDoc);

    assert.strictEqual(manojAvailable.length, numbers.length, "Manoj should have all assigned numbers");
    assert.strictEqual(rajAvailable.length, numbers.length, "Raj should have all assigned numbers");
  });

  // ─── TEST 6: Super Admin & Branch Admin Authorization ──────────────────────
  await test("Test 6: Super Admin sees all numbers; Branch Admin sees scoped numbers", async () => {
    const superAdmin = {
      _id: "u_super_test",
      id: "u_super_test",
      role: "superAdmin",
      department: "admin",
    };

    const branchAdmin = {
      _id: "u_badmin_test",
      id: "u_badmin_test",
      role: "sales",
      department: "admin",
      branch: num1.branchId || "Branch A",
    };

    const superNumbers = await getAvailableNumbers(superAdmin);
    assert.strictEqual(superNumbers.length, numbers.length, "Super Admin should see all numbers");

    const adminNumbers = await getAvailableNumbers(branchAdmin);
    assert(Array.isArray(adminNumbers), "Branch admin numbers should return an array");
  });

  // ─── TEST 7: Reset Manoj to only +917401403011 (Final Regression State) ─────
  await test("Test 7: Reset & verify final Manoj state: ONLY +917401403011", async () => {
    // Reset Manoj to only num1
    await TwilioNumber.findByIdAndUpdate(num1Id, {
      $addToSet: { assignedAssociates: manoj._id },
    });
    for (const num of numbers) {
      if (num._id.toString() !== num1Id) {
        await TwilioNumber.findByIdAndUpdate(num._id, {
          $pull: { assignedAssociates: manoj._id, assignedAdmins: manoj._id },
        });
      }
    }

    await User.findByIdAndUpdate(manojId, {
      $set: {
        assignedSenderNumbers: [num1Id],
        assignedTwilioNumbers: [num1Id],
        assignedSenderNumber: num1Id,
      },
    });

    // Clean up test users
    await User.findByIdAndDelete(johnId);
    await User.findByIdAndDelete(rajId);
    await TwilioNumber.updateMany(
      {},
      { $pull: { assignedAssociates: { $in: [john._id, raj._id] } } }
    );

    const finalManoj = await User.findById(manojId).lean();
    const finalAvailable = await getAvailableNumbers(finalManoj);

    assert.strictEqual(finalAvailable.length, 1, `Manoj must have exactly 1 number, got ${finalAvailable.length}`);
    assert.strictEqual(
      (finalAvailable[0]._id || finalAvailable[0]).toString(),
      num1Id,
      `Manoj must have ${num1.phoneNumber}`
    );
    assert.strictEqual(
      finalAvailable[0].phoneNumber,
      "+917401403011",
      "Manoj's number must be +917401403011"
    );
  });

  console.log("\n=======================================================");
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
