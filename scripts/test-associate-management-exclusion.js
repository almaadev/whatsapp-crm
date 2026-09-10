import assert from "node:assert";

console.log("\n========================================================");
console.log("🛡️  ASSOCIATE MANAGEMENT ROLE-BASED SELF-EXCLUSION SUITE");
console.log("========================================================\n");

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

// ---------------------------------------------------------
// 1. BACKEND API QUERY LOGIC VERIFICATION
// ---------------------------------------------------------
function buildBackendUserQuery({ session, searchParams, loggedInUser }) {
  const branchParam = searchParams.get("branch");
  const contextParam = searchParams.get("context");
  const excludeSelfParam = searchParams.get("excludeSelf");
  const isAssociateManagement =
    contextParam === "associate-management" || excludeSelfParam === "true";

  const query = {};
  if (session.user.role !== 'superAdmin') {
    query.branch = loggedInUser.branch;
    // Super Admin is the only role allowed to see their own account inside Associate Management.
    // Every other logged-in user must be excluded from the Associate Management list using their authenticated session User ID.
    if (isAssociateManagement) {
      query._id = { $ne: session.user.id };
    }
  } else if (branchParam && branchParam !== "all") {
    query.branch = branchParam;
  }
  return query;
}

test("1. Backend API: Super Admin is NOT excluded in Associate Management context", () => {
  const session = { user: { id: "sa_123", role: "superAdmin", department: "admin" } };
  const loggedInUser = { _id: "sa_123", branch: "HQ" };
  const params = new URLSearchParams({ context: "associate-management" });

  const query = buildBackendUserQuery({ session, searchParams: params, loggedInUser });
  assert.strictEqual(query._id, undefined, "Super Admin should not have _id filter applied");
});

test("2. Backend API: Branch Admin (sales/admin) IS excluded in Associate Management context using session.user.id", () => {
  const session = { user: { id: "admin_456", role: "sales", department: "admin" } };
  const loggedInUser = { _id: "admin_456", branch: "Chennai" };
  const params = new URLSearchParams({ context: "associate-management" });

  const query = buildBackendUserQuery({ session, searchParams: params, loggedInUser });
  assert.deepStrictEqual(query._id, { $ne: "admin_456" }, "Branch Admin must be excluded via $ne session.user.id");
  assert.strictEqual(query.branch, "Chennai");
});

test("3. Backend API: Doctor Admin IS excluded when excludeSelf=true", () => {
  const session = { user: { id: "doc_789", role: "doctor", department: "admin" } };
  const loggedInUser = { _id: "doc_789", branch: "Madurai" };
  const params = new URLSearchParams({ excludeSelf: "true" });

  const query = buildBackendUserQuery({ session, searchParams: params, loggedInUser });
  assert.deepStrictEqual(query._id, { $ne: "doc_789" });
});

test("4. Backend API: Non-associate-management context does NOT exclude logged-in user", () => {
  const session = { user: { id: "admin_456", role: "sales", department: "admin" } };
  const loggedInUser = { _id: "admin_456", branch: "Chennai" };
  const params = new URLSearchParams({}); // e.g. leads or reports

  const query = buildBackendUserQuery({ session, searchParams: params, loggedInUser });
  assert.strictEqual(query._id, undefined, "Standard context should not exclude self");
});

// ---------------------------------------------------------
// 2. CLIENT-SIDE DEFENSE-IN-DEPTH FILTERING VERIFICATION
// ---------------------------------------------------------
function filterAssociatesClientSide({ associates, session, user, searchQuery = "" }) {
  let list = associates;

  const isSuperAdminRole =
    session?.user?.role === "superAdmin" || user?.role === "superAdmin";
  const authenticatedSessionUserId =
    session?.user?.id?.toString() ||
    user?.id?.toString() ||
    user?._id?.toString();

  // Client-side defense-in-depth:
  // Super Admin is the only role allowed to see their own account inside Associate Management.
  // Every other logged-in user must be excluded from the Associate Management list using the authenticated session User ID, not the user name.
  if (!isSuperAdminRole && authenticatedSessionUserId) {
    list = list.filter((a) => {
      const associateId = a.id?.toString() || a._id?.toString();
      return associateId !== authenticatedSessionUserId;
    });
  }

  if (!searchQuery) return list;
  const lower = searchQuery.toLowerCase();
  return list.filter(
    (a) =>
      a.name?.toLowerCase().includes(lower) ||
      a.email?.toLowerCase().includes(lower) ||
      a.branch?.toLowerCase().includes(lower) ||
      a.number?.includes(lower),
  );
}

const mockAssociates = [
  { id: "sa_1", name: "Super Admin User", email: "sa@example.com", role: "superAdmin", branch: "HQ" },
  { id: "ba_2", name: "Manoj Kumar", email: "manoj.admin@example.com", role: "sales", branch: "Chennai" },
  { id: "assoc_3", name: "Manoj Kumar", email: "manoj.sales@example.com", role: "sales", branch: "Chennai" }, // Same name, different ID!
  { id: "assoc_4", name: "Priya Sharma", email: "priya@example.com", role: "sales", branch: "Chennai" },
];

test("5. Client Filter: Super Admin sees their own account", () => {
  const session = { user: { id: "sa_1", role: "superAdmin" } };
  const user = { id: "sa_1", role: "superAdmin" };

  const result = filterAssociatesClientSide({ associates: mockAssociates, session, user });
  const hasSelf = result.some((a) => a.id === "sa_1");
  assert.strictEqual(hasSelf, true, "Super Admin should see own account");
  assert.strictEqual(result.length, 4);
});

test("6. Client Filter: Branch Admin excludes ONLY their own account using session User ID", () => {
  const session = { user: { id: "ba_2", name: "Manoj Kumar", role: "sales" } };
  const user = { id: "ba_2", name: "Manoj Kumar", role: "sales" };

  const result = filterAssociatesClientSide({ associates: mockAssociates, session, user });
  const hasSelf = result.some((a) => a.id === "ba_2");
  assert.strictEqual(hasSelf, false, "Branch Admin own account must be excluded");
});

test("7. Client Filter: Associate with the SAME NAME as logged-in user is NOT excluded (proves ID matching, not name)", () => {
  const session = { user: { id: "ba_2", name: "Manoj Kumar", role: "sales" } };
  const user = { id: "ba_2", name: "Manoj Kumar", role: "sales" };

  const result = filterAssociatesClientSide({ associates: mockAssociates, session, user });
  const otherManoj = result.find((a) => a.id === "assoc_3");
  assert.ok(otherManoj, "Associate with the same name ('Manoj Kumar') but different ID must NOT be excluded");
  assert.strictEqual(otherManoj.email, "manoj.sales@example.com");
  assert.strictEqual(result.length, 3);
});

test("8. Client Filter: Search query works seamlessly on top of self-excluded list", () => {
  const session = { user: { id: "ba_2", name: "Manoj Kumar", role: "sales" } };
  const user = { id: "ba_2", name: "Manoj Kumar", role: "sales" };

  const result = filterAssociatesClientSide({
    associates: mockAssociates,
    session,
    user,
    searchQuery: "manoj",
  });
  assert.strictEqual(result.length, 1, "Should find only the other Manoj");
  assert.strictEqual(result[0].id, "assoc_3");
});

console.log("\n========================================================");
console.log(`📊 SUITE RESULT: ${passed} PASSED, ${failed} FAILED`);
console.log("========================================================\n");

if (failed > 0) process.exit(1);
