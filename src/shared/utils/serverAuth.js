import mongoose from "mongoose";
import User from "@/shared/models/User";

/**
 * Centralized Branch Access Control Helper for Server-Side API Handlers & Services.
 * Enforces role-based customer visibility:
 * - Super Admin -> No filter ({})
 * - Admin & Associates -> Filtered by assigned branch(es) OR unassigned customers
 */
export async function getBranchFilterForUser(session) {
  if (!session?.user) {
    return { isSuperAdmin: false, userBranchIds: [], branchQuery: { _id: null } };
  }

  const role = session.user.role;
  const department = session.user.department;
  const isSuperAdmin = role === "superAdmin";

  if (isSuperAdmin) {
    return { isSuperAdmin: true, userBranchIds: [], branchQuery: {} };
  }

  let rawBranch = session.user.branch;

  // Fallback: If rawBranch is missing in session.user, fetch fresh from User document
  if (rawBranch === undefined || rawBranch === null) {
    if (session.user.id) {
      try {
        const userDoc = await User.findById(session.user.id).select("branch").lean();
        if (userDoc) rawBranch = userDoc.branch;
      } catch (e) {
        console.error("Error fetching user branch fallback:", e);
      }
    }
  }

  const branchIdStrs = new Set();
  const branchObjectIds = [];

  const addBranchId = (val) => {
    if (!val) return;
    let str = "";
    if (typeof val === "object") {
      str = (val._id || val.id || val.branchId || val).toString();
    } else {
      str = val.toString().trim();
    }
    if (str && mongoose.Types.ObjectId.isValid(str)) {
      branchIdStrs.add(str);
      branchObjectIds.push(new mongoose.Types.ObjectId(str));
    }
  };

  if (Array.isArray(rawBranch)) {
    rawBranch.forEach(addBranchId);
  } else if (rawBranch) {
    addBranchId(rawBranch);
  }

  const stringIdArray = Array.from(branchIdStrs);
  const objectIdArray = branchObjectIds;

  const branchQuery = {
    $or: [
      { branchId: { $in: objectIdArray } },
      { branchId: { $in: stringIdArray } },
      { branchId: null },
      { branchId: { $exists: false } },
    ],
  };

  console.log(`[getBranchFilterForUser] User: ${session.user.name || session.user.email}, Role: ${role}, Dept: ${department}, Branch IDs: ${stringIdArray.join(", ") || "None"}`);

  return {
    isSuperAdmin: false,
    userBranchIds: stringIdArray,
    branchQuery,
  };
}
