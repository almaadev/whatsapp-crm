import mongoose from "mongoose";
import User from "@/shared/models/User";
import { isSuperAdmin as checkSuperAdmin, isAdminAuthorized } from "@/shared/utils/auth";

/**
 * Centralized Branch Access Control Helper for Server-Side API Handlers & Services.
 * Enforces role-based visibility:
 * - Super Admin -> No filter ({})
 * - Admin & Associates -> Filtered by assigned branch(es)
 */
export async function getBranchFilterForUser(session) {
  if (!session?.user) {
    return { isSuperAdmin: false, userBranchIds: [], userBranchObjectIds: [], branchQuery: { _id: null } };
  }

  const role = session.user.role;
  const department = session.user.department;
  const isSuper = checkSuperAdmin(role);

  if (isSuper) {
    return { isSuperAdmin: true, userBranchIds: [], userBranchObjectIds: [], branchQuery: {} };
  }

  let rawBranch = session.user.branch;

  // Always fetch fresh branch from User document for non-superAdmin to ensure accuracy
  if (session.user.id) {
    try {
      const userDoc = await User.findById(session.user.id).select("branch").lean();
      if (userDoc && userDoc.branch !== undefined && userDoc.branch !== null) {
        rawBranch = userDoc.branch;
      }
    } catch (e) {
      console.error("[getBranchFilterForUser] Error fetching user branch fallback:", e);
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

  return {
    isSuperAdmin: false,
    userBranchIds: stringIdArray,
    userBranchObjectIds: objectIdArray,
    branchQuery,
  };
}

/**
 * Authoritative Hierarchical Scope Resolver for Session & Attendance Logs.
 * Role Hierarchy:
 * 1. SuperAdmin -> scope: "global" (All branches, all users, self)
 * 2. Admin -> scope: "branch" (Own branch associates ONLY. Excludes current Admin user from staff monitoring view)
 * 3. Associate -> scope: "self" (Self data only via self endpoints)
 */
export async function resolveAssociateLogScope(session) {
  if (!session?.user?.id) {
    return {
      scope: "none",
      isSuperAdmin: false,
      isAdmin: false,
      userId: null,
      excludeUserId: null,
      userBranchIds: [],
      userBranchObjectIds: [],
      query: { _id: null }
    };
  }

  const userId = session.user.id.toString();
  const role = session.user.role;
  const department = session.user.department;

  const isSuper = checkSuperAdmin(role);
  const isAdmin = isAdminAuthorized(role, department);

  if (isSuper) {
    return {
      scope: "global",
      isSuperAdmin: true,
      isAdmin: true,
      userId,
      excludeUserId: null,
      userBranchIds: [],
      userBranchObjectIds: [],
      query: {}
    };
  }

  if (isAdmin) {
    const branchFilter = await getBranchFilterForUser(session);
    const { userBranchIds, userBranchObjectIds } = branchFilter;
    const userObjId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;

    const query = {
      associateId: { $ne: userObjId },
      $or: [
        { branchId: { $in: [...userBranchObjectIds, ...userBranchIds] } },
        { branchId: null },
        { branchId: { $exists: false } }
      ]
    };

    return {
      scope: "branch",
      isSuperAdmin: false,
      isAdmin: true,
      userId,
      excludeUserId: userId,
      userBranchIds,
      userBranchObjectIds,
      query
    };
  }

  // Normal Associate -> self scope ONLY
  const userObjId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null;
  return {
    scope: "self",
    isSuperAdmin: false,
    isAdmin: false,
    userId,
    excludeUserId: null,
    userBranchIds: [],
    userBranchObjectIds: [],
    query: {
      associateId: { $in: [userObjId, userId].filter(Boolean) }
    }
  };
}
