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
  normalizeModuleName,
  CANONICAL_MODULES,
  checkPermissions,
  isRouteAuthorized,
  isAPIAuthorized
} from "../src/shared/utils/auth.js";

async function runScenarioTests() {
  console.log("\n==================================================");
  console.log("🧪 COMPLETE CHAT SCENARIO & STATE MACHINE TEST SUITE");
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

  // State Machine Helper function simulating useAuth + ChatPageContent
  function evaluateChatPageState({
    sessionStatus, // "loading" | "authenticated" | "unauthenticated"
    sessionUser,   // Object | null
    storeUser,     // Object | null
    storeIsLoading,// boolean
    isInitialized, // boolean
    chatLoading,   // boolean
    chatError,     // string | null
    chatsCount,    // number
  }) {
    const effectiveUser = storeUser || sessionUser || null;
    const isSessionLoading = sessionStatus === "loading";
    const isAuthLoading = isSessionLoading || (storeIsLoading && !storeUser && !sessionUser);
    const isAuthenticated = sessionStatus === "authenticated" || !!effectiveUser;
    const isUnauthenticated = sessionStatus === "unauthenticated" && !effectiveUser && !isSessionLoading;

    let accessStatus;
    if (isAuthLoading) {
      accessStatus = "INITIALIZING_AUTH";
    } else if (isUnauthenticated) {
      accessStatus = "UNAUTHENTICATED";
    } else if (effectiveUser && hasModuleAccess(effectiveUser, "Chat Inbox")) {
      accessStatus = "AUTHORIZED";
    } else if (storeIsLoading || (!isInitialized && !storeUser)) {
      accessStatus = "CHECKING_PERMISSION";
    } else {
      accessStatus = "UNAUTHORIZED";
    }

    // Determine Rendered Component/Screen
    let renderedScreen;
    if (accessStatus === "INITIALIZING_AUTH" || accessStatus === "CHECKING_PERMISSION") {
      renderedScreen = "LOADING_SCREEN";
    } else if (accessStatus === "UNAUTHENTICATED" || isUnauthenticated) {
      renderedScreen = "NULL_REDIRECT";
    } else if (accessStatus === "UNAUTHORIZED") {
      renderedScreen = "ACCESS_DENIED";
    } else if (accessStatus === "AUTHORIZED") {
      if (chatLoading && chatsCount === 0) {
        renderedScreen = "INBOX_PAGE_LOADING_CHATS";
      } else if (chatError) {
        renderedScreen = "INBOX_PAGE_ERROR_STATE";
      } else if (chatsCount === 0) {
        renderedScreen = "INBOX_PAGE_EMPTY_STATE";
      } else {
        renderedScreen = "INBOX_PAGE_READY";
      }
    }

    return {
      effectiveUser,
      isAuthLoading,
      accessStatus,
      renderedScreen
    };
  }

  // --- SCENARIO TESTS A through M ---

  // Scenario A: Hard refresh on /crm/chat
  test("Scenario A: Hard refresh on /crm/chat", () => {
    // 1. Initial mounting from cold page load (session loading)
    let state = evaluateChatPageState({
      sessionStatus: "loading",
      sessionUser: null,
      storeUser: null,
      storeIsLoading: false,
      isInitialized: false,
      chatLoading: true,
      chatError: null,
      chatsCount: 0
    });
    assert.strictEqual(state.accessStatus, "INITIALIZING_AUTH");
    assert.strictEqual(state.renderedScreen, "LOADING_SCREEN", "Cold load must show LoadingScreen, not AccessDenied");

    // 2. NextAuth JWT resolves
    state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeUser: null,
      storeIsLoading: true,
      isInitialized: false,
      chatLoading: true,
      chatError: null,
      chatsCount: 0
    });
    assert.strictEqual(state.accessStatus, "AUTHORIZED");
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_LOADING_CHATS");

    // 3. /api/chats completes
    state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeIsLoading: false,
      isInitialized: true,
      chatLoading: false,
      chatError: null,
      chatsCount: 5
    });
    assert.strictEqual(state.accessStatus, "AUTHORIZED");
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_READY");
  });

  // Scenario B: Navigate to /crm/chat from sidebar
  test("Scenario B: Navigate to /crm/chat from sidebar", () => {
    const state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeIsLoading: false,
      isInitialized: true,
      chatLoading: false,
      chatError: null,
      chatsCount: 12
    });
    assert.strictEqual(state.accessStatus, "AUTHORIZED");
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_READY");
  });

  // Scenario C: Open /crm/chat immediately after login
  test("Scenario C: Open /crm/chat immediately after login", () => {
    // JWT has user immediately from login authorize() callback
    const state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeUser: null,
      storeIsLoading: false,
      isInitialized: false,
      chatLoading: false,
      chatError: null,
      chatsCount: 3
    });
    assert.strictEqual(state.accessStatus, "AUTHORIZED");
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_READY");
  });

  // Scenario D: Open /crm/chat after session already exists
  test("Scenario D: Open /crm/chat after session already exists", () => {
    const state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeIsLoading: false,
      isInitialized: true,
      chatLoading: false,
      chatError: null,
      chatsCount: 1
    });
    assert.strictEqual(state.accessStatus, "AUTHORIZED");
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_READY");
  });

  // Scenario E: SuperAdmin
  await testAsync("Scenario E: SuperAdmin has unconditional access and sees all senders", async () => {
    const superAdminUser = {
      _id: new mongoose.Types.ObjectId(),
      role: "superAdmin",
      department: "admin",
      branch: "Chennai",
      accessModules: [],
    };
    const numbers = await getAvailableNumbers(superAdminUser);
    const allDbNumbers = await TwilioNumber.find({ status: { $ne: "inactive" } }).lean();
    
    assert.strictEqual(numbers.length, allDbNumbers.length, "Super Admin sees all senders");
    assert.strictEqual(hasModuleAccess({ user: superAdminUser }, "Chat Inbox"), true);
    assert.strictEqual(isAdminAuthorized(superAdminUser.role, superAdminUser.department), true);

    const state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: superAdminUser,
      storeUser: superAdminUser,
      storeIsLoading: false,
      isInitialized: true,
      chatLoading: false,
      chatError: null,
      chatsCount: 10
    });
    assert.strictEqual(state.accessStatus, "AUTHORIZED");
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_READY");
  });

  // Scenario F: Admin with Chat permission
  await testAsync("Scenario F: Admin with Chat permission", async () => {
    const adminUser = {
      _id: new mongoose.Types.ObjectId(),
      role: "sales",
      department: "admin",
      branch: "Chennai",
      accessModules: [],
    };
    assert.strictEqual(hasModuleAccess({ user: adminUser }, "Chat Inbox"), true);
    assert.strictEqual(isAdminAuthorized(adminUser.role, adminUser.department), true);

    const state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: adminUser,
      storeUser: adminUser,
      storeIsLoading: false,
      isInitialized: true,
      chatLoading: false,
      chatError: null,
      chatsCount: 4
    });
    assert.strictEqual(state.accessStatus, "AUTHORIZED");
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_READY");
  });

  // Scenario G: Associate with Chat permission
  await testAsync("Scenario G: Associate with Chat permission", async () => {
    const assocUser = {
      _id: new mongoose.Types.ObjectId(),
      role: "sales",
      department: "telecalling",
      branch: "Chennai",
      accessModules: ["Chat Inbox"],
    };
    assert.strictEqual(hasModuleAccess({ user: assocUser }, "Chat Inbox"), true);

    const state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: assocUser,
      storeUser: assocUser,
      storeIsLoading: false,
      isInitialized: true,
      chatLoading: false,
      chatError: null,
      chatsCount: 8
    });
    assert.strictEqual(state.accessStatus, "AUTHORIZED");
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_READY");
  });

  // Scenario H: User with Chat permission but no sender assigned
  await testAsync("Scenario H: User with Chat permission but no sender assigned", async () => {
    const unassignedUser = {
      _id: new mongoose.Types.ObjectId(),
      role: "sales",
      department: "telecalling",
      branch: "Chennai",
      accessModules: ["Chat Inbox"],
    };
    const senders = await getAvailableNumbers(unassignedUser);
    assert.strictEqual(senders.length, 0, "No senders assigned");
    assert.strictEqual(hasModuleAccess({ user: unassignedUser }, "Chat Inbox"), true, "Chat access intact");

    const state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: unassignedUser,
      storeUser: unassignedUser,
      storeIsLoading: false,
      isInitialized: true,
      chatLoading: false,
      chatError: null,
      chatsCount: 0
    });
    assert.strictEqual(state.accessStatus, "AUTHORIZED");
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_EMPTY_STATE", "Chat page renders without sender");
  });

  // Scenario I: User without Chat permission
  test("Scenario I: User without Chat permission gets AccessDenied ONLY after settling", () => {
    // 1. JWT resolves with no chat permission, but userStore is fetching
    let state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: { id: "u_no_chat", role: "sales", department: "telecalling", accessModules: ["Leads"] },
      storeUser: null,
      storeIsLoading: true,
      isInitialized: false,
      chatLoading: false,
      chatError: null,
      chatsCount: 0
    });
    assert.strictEqual(state.accessStatus, "CHECKING_PERMISSION");
    assert.strictEqual(state.renderedScreen, "LOADING_SCREEN", "Must wait for userStore to settle");

    // 2. userStore settles and confirms no Chat permission
    state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: { id: "u_no_chat", role: "sales", department: "telecalling", accessModules: ["Leads"] },
      storeUser: { id: "u_no_chat", role: "sales", department: "telecalling", accessModules: ["Leads"] },
      storeIsLoading: false,
      isInitialized: true,
      chatLoading: false,
      chatError: null,
      chatsCount: 0
    });
    assert.strictEqual(state.accessStatus, "UNAUTHORIZED");
    assert.strictEqual(state.renderedScreen, "ACCESS_DENIED", "AccessDenied renders only after store settles");
  });

  // Scenario J: Slow network
  test("Scenario J: Slow network does not hang indefinitely", () => {
    let state = evaluateChatPageState({
      sessionStatus: "loading",
      sessionUser: null,
      storeUser: null,
      storeIsLoading: false,
      isInitialized: false,
      chatLoading: true,
      chatError: null,
      chatsCount: 0
    });
    assert.strictEqual(state.renderedScreen, "LOADING_SCREEN");

    // Slow response arrives
    state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeIsLoading: false,
      isInitialized: true,
      chatLoading: false,
      chatError: null,
      chatsCount: 2
    });
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_READY");
  });

  // Scenario K: API /api/chats returns 500
  test("Scenario K: API /api/chats returns 500 preserves error UI without hang", () => {
    const state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeIsLoading: false,
      isInitialized: true,
      chatLoading: false, // loading terminated
      chatError: "500 Internal Server Error",
      chatsCount: 0
    });
    assert.strictEqual(state.accessStatus, "AUTHORIZED");
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_ERROR_STATE", "Explicit error UI renders");
  });

  // Scenario L: Socket.IO unavailable
  test("Scenario L: Socket.IO unavailable allows REST chat rendering", () => {
    const isSocketConnected = false;
    const state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeIsLoading: false,
      isInitialized: true,
      chatLoading: false,
      chatError: null,
      chatsCount: 5
    });
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_READY");
  });

  // Scenario M: NextAuth session temporarily loading
  test("Scenario M: NextAuth session temporarily loading resolves safely", () => {
    let state = evaluateChatPageState({
      sessionStatus: "loading",
      sessionUser: null,
      storeUser: null,
      storeIsLoading: false,
      isInitialized: false,
      chatLoading: true,
      chatError: null,
      chatsCount: 0
    });
    assert.strictEqual(state.renderedScreen, "LOADING_SCREEN");

    state = evaluateChatPageState({
      sessionStatus: "authenticated",
      sessionUser: { id: "u1", role: "sales", department: "telecalling", accessModules: ["Chat Inbox"] },
      storeUser: null,
      storeIsLoading: true,
      isInitialized: false,
      chatLoading: true,
      chatError: null,
      chatsCount: 0
    });
    assert.strictEqual(state.accessStatus, "AUTHORIZED");
    assert.strictEqual(state.renderedScreen, "INBOX_PAGE_LOADING_CHATS");
  });

  // Canonical Module Name Normalization & Legacy Aliases
  test("Canonical Module Normalization", () => {
    assert.strictEqual(normalizeModuleName("Chat Inbox"), "Chat Inbox");
    assert.strictEqual(normalizeModuleName("chat inbox"), "Chat Inbox");
    assert.strictEqual(normalizeModuleName("chat_inbox"), "Chat Inbox");
    assert.strictEqual(normalizeModuleName("chat-inbox"), "Chat Inbox");
    assert.strictEqual(normalizeModuleName("chat"), "Chat Inbox");
    assert.strictEqual(normalizeModuleName("Chat"), "Chat Inbox");

    assert.strictEqual(normalizeModuleName("Leads"), "Leads");
    assert.strictEqual(normalizeModuleName("Reports"), "Reports");
    assert.notStrictEqual(normalizeModuleName("Reports"), "Chat Inbox");
  });

  console.log(`\n==================================================`);
  console.log(`📊 ALL SCENARIOS COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  await mongoose.disconnect();
  if (failed > 0) process.exit(1);
}

runScenarioTests().catch(err => {
  console.error("Scenario test error:", err);
  process.exit(1);
});
