import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import assert from "node:assert";
import {
  isAdminAuthorized,
  hasModuleAccess as hasModuleAccessUtil,
  checkPermissions,
  isRouteAuthorized,
  isAPIAuthorized,
} from "../src/shared/utils/auth.js";
import { NAVIGATION_CONFIG } from "../src/shared/config/navigation.js";

async function runAuthMatrixTest() {
  console.log("\n==================================================");
  console.log("🔐 AUTHORIZATION MATRIX & ROLE VERIFICATION SUITE");
  console.log("==================================================\n");

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

  // 1. SUPERADMIN
  const superAdminSession = {
    user: {
      id: "u_superadmin",
      name: "System Admin",
      role: "superAdmin",
      department: "admin",
      accessModules: [], // SuperAdmin typically has empty accessModules
    },
  };

  test("1. SUPERADMIN has unrestricted module access to 'Bulk Messages'", () => {
    assert.strictEqual(isAdminAuthorized(superAdminSession.user.role, superAdminSession.user.department), true);
    assert.strictEqual(hasModuleAccessUtil(superAdminSession, "Bulk Messages"), true);
    assert.strictEqual(isRouteAuthorized(superAdminSession, "/crm/bulk-message"), true);
    assert.strictEqual(isAPIAuthorized(superAdminSession, "/api/bulk-message"), true);
  });

  test("2. SUPERADMIN sees 'Bulk Messages' in Sidebar NAVIGATION_CONFIG", () => {
    const bulkNav = NAVIGATION_CONFIG.find((n) => n.href === "/crm/bulk-message");
    assert.ok(bulkNav, "Bulk Messages navigation item exists");
    assert.strictEqual(bulkNav.moduleName, "Bulk Messages");
    assert.strictEqual(checkPermissions(superAdminSession, bulkNav), true);
  });

  // 2. ADMIN (Sales Dept Admin)
  const salesAdminSession = {
    user: {
      id: "u_salesadmin",
      name: "Sales Admin",
      role: "sales",
      department: "admin",
      accessModules: [],
    },
  };

  test("3. SALES ADMIN has module access to 'Bulk Messages'", () => {
    assert.strictEqual(isAdminAuthorized(salesAdminSession.user.role, salesAdminSession.user.department), true);
    assert.strictEqual(hasModuleAccessUtil(salesAdminSession, "Bulk Messages"), true);
    assert.strictEqual(isRouteAuthorized(salesAdminSession, "/crm/bulk-message"), true);
    assert.strictEqual(isAPIAuthorized(salesAdminSession, "/api/bulk-message"), true);
    const bulkNav = NAVIGATION_CONFIG.find((n) => n.href === "/crm/bulk-message");
    assert.strictEqual(checkPermissions(salesAdminSession, bulkNav), true);
  });

  // 3. ADMIN (Doctor Dept Admin)
  const doctorAdminSession = {
    user: {
      id: "u_docadmin",
      name: "Doctor Admin",
      role: "doctor",
      department: "admin",
      accessModules: [],
    },
  };

  test("4. DOCTOR ADMIN has module access to 'Bulk Messages'", () => {
    assert.strictEqual(isAdminAuthorized(doctorAdminSession.user.role, doctorAdminSession.user.department), true);
    assert.strictEqual(hasModuleAccessUtil(doctorAdminSession, "Bulk Messages"), true);
    assert.strictEqual(isRouteAuthorized(doctorAdminSession, "/crm/bulk-message"), true);
    assert.strictEqual(isAPIAuthorized(doctorAdminSession, "/api/bulk-message"), true);
    const bulkNav = NAVIGATION_CONFIG.find((n) => n.href === "/crm/bulk-message");
    assert.strictEqual(checkPermissions(doctorAdminSession, bulkNav), true);
  });

  // 4. ASSOCIATE with Bulk Messages permission
  const authorizedAssociateSession = {
    user: {
      id: "u_assoc_auth",
      name: "Campaign Associate",
      role: "associate",
      department: "sales",
      accessModules: ["Bulk Messages", "Chat Inbox"],
    },
  };

  test("5. ASSOCIATE with 'Bulk Messages' in accessModules is ALLOWED", () => {
    assert.strictEqual(isAdminAuthorized(authorizedAssociateSession.user.role, authorizedAssociateSession.user.department), false);
    assert.strictEqual(hasModuleAccessUtil(authorizedAssociateSession, "Bulk Messages"), true);
    assert.strictEqual(isRouteAuthorized(authorizedAssociateSession, "/crm/bulk-message"), true);
    assert.strictEqual(isAPIAuthorized(authorizedAssociateSession, "/api/bulk-message"), true);
    const bulkNav = NAVIGATION_CONFIG.find((n) => n.href === "/crm/bulk-message");
    assert.strictEqual(checkPermissions(authorizedAssociateSession, bulkNav), true);
  });

  // 5. ASSOCIATE without Bulk Messages permission
  const unauthorizedAssociateSession = {
    user: {
      id: "u_assoc_unauth",
      name: "Regular Associate",
      role: "associate",
      department: "sales",
      accessModules: ["Chat Inbox", "Leads"],
    },
  };

  test("6. ASSOCIATE without 'Bulk Messages' is DENIED", () => {
    assert.strictEqual(isAdminAuthorized(unauthorizedAssociateSession.user.role, unauthorizedAssociateSession.user.department), false);
    assert.strictEqual(hasModuleAccessUtil(unauthorizedAssociateSession, "Bulk Messages"), false);
    assert.strictEqual(isRouteAuthorized(unauthorizedAssociateSession, "/crm/bulk-message"), false);
    assert.strictEqual(isAPIAuthorized(unauthorizedAssociateSession, "/api/bulk-message"), false);
    const bulkNav = NAVIGATION_CONFIG.find((n) => n.href === "/crm/bulk-message");
    assert.strictEqual(checkPermissions(unauthorizedAssociateSession, bulkNav), false);
  });

  // 6. Non-admin Sales User without Bulk Messages permission
  const unauthorizedSalesSession = {
    user: {
      id: "u_sales_unauth",
      name: "Junior Sales",
      role: "sales",
      department: "sales",
      accessModules: ["Leads"],
    },
  };

  test("7. Non-admin SALES user without 'Bulk Messages' is DENIED", () => {
    assert.strictEqual(isAdminAuthorized(unauthorizedSalesSession.user.role, unauthorizedSalesSession.user.department), false);
    assert.strictEqual(hasModuleAccessUtil(unauthorizedSalesSession, "Bulk Messages"), false);
    assert.strictEqual(isRouteAuthorized(unauthorizedSalesSession, "/crm/bulk-message"), false);
    assert.strictEqual(isAPIAuthorized(unauthorizedSalesSession, "/api/bulk-message"), false);
    const bulkNav = NAVIGATION_CONFIG.find((n) => n.href === "/crm/bulk-message");
    assert.strictEqual(checkPermissions(unauthorizedSalesSession, bulkNav), false);
  });

  console.log("\n==================================================");
  console.log(`📊 AUTH MATRIX SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================\n");

  if (failed > 0) process.exit(1);
}

runAuthMatrixTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL SUITE ERROR:", err);
    process.exit(1);
  });
