import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import assert from "node:assert";
import mongoose from "mongoose";
import connectDB from "../src/shared/lib/db/mongodb.js";
import User from "../src/shared/models/User.js";
import TwilioNumber from "../src/shared/models/TwilioNumber.js";
import Customer from "../src/shared/models/Customer.js";
import Message from "../src/shared/models/Message.js";
import {
  hasModuleAccess,
  isAdminAuthorized,
  isRouteAuthorized,
  isAPIAuthorized,
  normalizeModuleName,
  CANONICAL_MODULES
} from "../src/shared/utils/auth.js";
import { getAvailableNumbers } from "../src/features/admin/services/twilioService.js";

async function runDetailedReproduction() {
  console.log("\n==================================================");
  console.log("🔍 DEEP LIFECYCLE REPRODUCTION & /api/chats AUDIT");
  console.log("==================================================\n");

  await connectDB();

  // 1. Check real DB users
  const superAdmin = await User.findOne({ role: "superAdmin" }).lean();
  const salesAdmin = await User.findOne({ role: "sales", department: "admin" }).lean();
  const associate = await User.findOne({ role: "sales", department: { $ne: "admin" } }).lean();

  console.log("👤 DB Users in System:");
  if (superAdmin) console.log(`   - SuperAdmin: ${superAdmin.name} (${superAdmin.email}) [role: ${superAdmin.role}]`);
  if (salesAdmin) console.log(`   - SalesAdmin: ${salesAdmin.name} (${salesAdmin.email}) [dept: ${salesAdmin.department}]`);
  if (associate) {
    console.log(`   - Associate:  ${associate.name} (${associate.email}) [dept: ${associate.department}]`);
    console.log(`     accessModules in DB:`, associate.accessModules);
  }

  // 2. Simulate /api/chats server-side evaluation for each role
  console.log("\n📡 SIMULATING /api/chats SERVER-SIDE AUTHORIZATION & RESPONSE:");
  
  const testUsers = [
    { label: "Super Admin", user: { id: superAdmin?._id.toString(), role: "superAdmin", department: "admin" } },
    { label: "Sales Admin", user: { id: salesAdmin?._id.toString(), role: "sales", department: "admin" } },
    { label: "Associate WITH Chat Inbox", user: { id: associate?._id.toString(), role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] } },
    { label: "Associate with Legacy 'chat'", user: { id: associate?._id.toString(), role: "sales", department: "telecalling", accessModules: ["chat"] } },
    { label: "Associate WITHOUT Chat Inbox", user: { id: "u_no_chat", role: "sales", department: "telecalling", accessModules: ["Leads", "Customers"] } },
  ];

  for (const t of testUsers) {
    const session = { user: t.user };
    const apiAllowed = isAPIAuthorized(session, "/api/chats");
    const routeAllowed = isRouteAuthorized(session, "/crm/chat");
    const moduleAllowed = hasModuleAccess(session, "Chat Inbox");
    console.log(`   [${t.label}] -> API Allowed: ${apiAllowed} | Route Allowed: ${routeAllowed} | Module Access: ${moduleAllowed}`);
  }

  // 3. Trace the exact Race Condition
  console.log("\n⚡ TRACING CLIENT-SIDE RACE CONDITION (CASE A vs CASE B):");
  console.log("----------------------------------------------------------------");
  console.log("CASE A (Premature AccessDenied):");
  console.log("  1. NextAuth JWT resolves with stale token missing 'Chat Inbox' (e.g. accessModules: [])");
  console.log("  2. userStore.user is null, userStore.isLoading is false (fetchCurrentUser hasn't started yet)");
  console.log("  3. useAuth computes effectiveUser = session.user, hasModuleAccess returns FALSE");
  console.log("  4. page.js renders <AccessDenied /> BEFORE fetchCurrentUser can load fresh DB user from /api/auth/me!");
  console.log("");
  console.log("CASE B (Infinite Loading Screen):");
  console.log("  1. NextAuth status is 'loading' OR isLoading in useAuth is true");
  console.log("  2. If page.js evaluates `if (status === 'loading' && !user && !session?.user) return <LoadingScreen />`");
  console.log("  3. If session resolution is delayed or deadlocked by hook dependencies, page stays on <LoadingScreen /> forever.");
  console.log("----------------------------------------------------------------\n");

  await mongoose.disconnect();
}

runDetailedReproduction().catch(err => {
  console.error("Reproduction failed:", err);
  process.exit(1);
});
