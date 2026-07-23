import connectDB from "@/shared/lib/db/mongodb";
import Branch from "@/shared/models/Branch";

/**
 * Standardizes customer branch resolution across all customer APIs.
 * Resolves branchId to { branchId, branchName, branchCode } using a single branch map query to prevent N+1 queries.
 */
export async function resolveCustomerBranches(customers, preloadedBranchMap = null) {
  if (!customers) return customers;
  const isArray = Array.isArray(customers);
  const list = isArray ? customers : [customers];

  let branchMap = preloadedBranchMap;
  if (!branchMap) {
    await connectDB();
    const branches = await Branch.find({}).select("name code status").lean();
    branchMap = {};
    branches.forEach((b) => {
      branchMap[b._id.toString()] = {
        name: b.name || "Unassigned Branch",
        code: b.code || "",
      };
    });
  }

  const result = list.map((c) => {
    let bId = null;
    let bName = "Unassigned Branch";
    let bCode = "";

    if (c.branchId) {
      if (typeof c.branchId === "object" && c.branchId._id) {
        bId = c.branchId._id.toString();
        bName = c.branchId.name || "Unassigned Branch";
        bCode = c.branchId.code || "";
      } else {
        bId = c.branchId.toString();
        const found = branchMap[bId];
        if (found) {
          bName = found.name;
          bCode = found.code;
        }
      }
    }

    return {
      ...c,
      branchId: bId,
      branchName: bName,
      branchCode: bCode,
    };
  });

  return isArray ? result : result[0];
}
