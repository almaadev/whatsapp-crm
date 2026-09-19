import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import assert from "node:assert";
import mongoose from "mongoose";
import connectDB from "../src/shared/lib/db/mongodb.js";
import User from "../src/shared/models/User.js";
import TwilioNumber from "../src/shared/models/TwilioNumber.js";
import { getAvailableNumbers } from "../src/features/admin/services/twilioService.js";
import {
  hasModuleAccess,
  isAdminAuthorized,
  isRouteAuthorized,
  isAPIAuthorized,
  normalizeModuleName
} from "../src/shared/utils/auth.js";

async function runNavigationTests() {
  console.log("\n==================================================");
  console.log("🌐 /crm/chat ROUTE & INITIALIZATION VERIFICATION");
  console.log("==================================================\n");

  await connectDB();

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      process.stdout.write(`⏳ Checking: ${name}... `);
      fn();
      console.log("✅ PASSED");
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      console.error(err);
      failed++;
    }
  }

  async function testAsync(name, fn) {
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

  // 1. Super Admin Navigation & Permissions
  const superAdminSession = {
    user: {
      id: "u_super",
      name: "Super Admin",
      role: "superAdmin",
      department: "admin",
      branch: "Chennai",
      accessModules: [],
    }
  };

  test("1. SuperAdmin: Route /crm/chat is authorized", () => {
    assert.strictEqual(isRouteAuthorized(superAdminSession, "/crm/chat"), true);
    assert.strictEqual(isAPIAuthorized(superAdminSession, "/api/chats"), true);
    assert.strictEqual(hasModuleAccess(superAdminSession, "Chat Inbox"), true);
  });

  // 2. Associate with Chat Inbox access
  const authorizedAssociateSession = {
    user: {
      id: "u_assoc_1",
      name: "Associate 1",
      role: "sales",
      department: "telecalling",
      branch: "Chennai",
      accessModules: ["Chat Inbox", "Leads"],
    }
  };

  test("2. Authorized Associate: Route /crm/chat is authorized", () => {
    assert.strictEqual(isRouteAuthorized(authorizedAssociateSession, "/crm/chat"), true);
    assert.strictEqual(isAPIAuthorized(authorizedAssociateSession, "/api/chats"), true);
    assert.strictEqual(hasModuleAccess(authorizedAssociateSession, "Chat Inbox"), true);
  });

  // 3. Associate with legacy 'chat' permission key
  const legacyAssociateSession = {
    user: {
      id: "u_assoc_2",
      name: "Associate Legacy",
      role: "sales",
      department: "telecalling",
      branch: "Chennai",
      accessModules: ["chat"],
    }
  };

  test("3. Associate with legacy 'chat' key is recognized for Chat Inbox", () => {
    assert.strictEqual(isRouteAuthorized(legacyAssociateSession, "/crm/chat"), true);
    assert.strictEqual(isAPIAuthorized(legacyAssociateSession, "/api/chats"), true);
    assert.strictEqual(hasModuleAccess(legacyAssociateSession, "Chat Inbox"), true);
  });

  // 4. Unauthorized Associate without chat access
  const unauthorizedAssociateSession = {
    user: {
      id: "u_assoc_3",
      name: "Associate No Chat",
      role: "sales",
      department: "telecalling",
      branch: "Chennai",
      accessModules: ["Leads", "Customers"],
    }
  };

  test("4. Unauthorized Associate: Route /crm/chat is rejected", () => {
    assert.strictEqual(isRouteAuthorized(unauthorizedAssociateSession, "/crm/chat"), false);
    assert.strictEqual(isAPIAuthorized(unauthorizedAssociateSession, "/api/chats"), false);
    assert.strictEqual(hasModuleAccess(unauthorizedAssociateSession, "Chat Inbox"), false);
  });

  // 5. Decoupled Sender Assignment: Associate with 0 senders has valid chat permission
  await testAsync("5. Decoupled Sender Assignment: 0 senders does not revoke chat access", async () => {
    const unassignedAssoc = {
      _id: new mongoose.Types.ObjectId(),
      id: new mongoose.Types.ObjectId().toString(),
      role: "sales",
      department: "telecalling",
      branch: "Chennai",
      accessModules: ["Chat Inbox"],
    };

    const senders = await getAvailableNumbers(unassignedAssoc);
    assert.strictEqual(senders.length, 0, "No senders assigned");
    assert.strictEqual(hasModuleAccess({ user: unassignedAssoc }, "Chat Inbox"), true, "Chat access is intact");
  });

  console.log(`\n==================================================`);
  console.log(`📊 NAVIGATION VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  await mongoose.disconnect();
  if (failed > 0) process.exit(1);
}

runNavigationTests().catch(err => {
  console.error("Navigation test error:", err);
  process.exit(1);
});
