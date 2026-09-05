import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import mongoose from "mongoose";
import TwilioNumber from "@/shared/models/TwilioNumber";
import User from "@/shared/models/User";
import Branch from "@/shared/models/Branch";
import { isAdminAuthorized, isSuperAdmin as checkIsSuperAdmin } from "@/shared/utils/auth";

export const dynamic = "force-dynamic";

/**
 * Helper to safely check if two branch references (ObjectId or name) match.
 */
async function isBranchMatching(branchA, branchB) {
  if (!branchA || !branchB) return false;
  const strA = (branchA._id || branchA).toString().trim();
  const strB = (branchB._id || branchB).toString().trim();
  if (strA.toLowerCase() === strB.toLowerCase()) return true;

  try {
    const [docA, docB] = await Promise.all([
      mongoose.Types.ObjectId.isValid(strA)
        ? Branch.findById(strA).lean()
        : Branch.findOne({ name: strA }).lean(),
      mongoose.Types.ObjectId.isValid(strB)
        ? Branch.findById(strB).lean()
        : Branch.findOne({ name: strB }).lean(),
    ]);

    if (docA && docB && docA._id.toString() === docB._id.toString()) {
      return true;
    }
  } catch (err) {
    console.error("[isBranchMatching] Error resolving branches:", err.message);
  }

  return false;
}

/**
 * Centralized authorization & assignable numbers scope calculation.
 * 
 * Rules:
 * 1. SuperAdmin has NO WhatsApp number restriction:
 *    - Authorized scope = ALL active TwilioNumber records (status !== "inactive", isActive !== false).
 *    - Can assign ANY active WhatsApp number to any admin or associate.
 * 
 * 2. Admin:
 *    - Authorized scope = TwilioNumber records where assignedAdmins contains the logged-in Admin's ID.
 *    - Can assign ONLY numbers within their own authorized pool.
 */
async function getAuthorizedNumbersForSession(sessionUser) {
  if (!sessionUser) {
    return { isAuthorized: false, isSuperAdmin: false, authorizedNumbers: [] };
  }

  const role = sessionUser.role;
  const department = sessionUser.department || "";
  const isSuper = role === "superAdmin" || checkIsSuperAdmin(role);
  const isAdmin = isAdminAuthorized(role, department);

  if (!isAdmin) {
    return { isAuthorized: false, isSuperAdmin: false, authorizedNumbers: [] };
  }

  // 1. SUPER ADMIN: Full global access to all active WhatsApp numbers in the database
  if (isSuper) {
    const allActiveNumbers = await TwilioNumber.find({
      status: { $ne: "inactive" },
      isActive: { $ne: false },
    })
      .populate("assignedAssociates", "name preferredName email")
      .populate("assignedAdmins", "name preferredName email")
      .lean();

    return {
      isAuthorized: true,
      isSuperAdmin: true,
      managingAdmin: {
        id: sessionUser.id,
        _id: sessionUser.id,
        name: sessionUser.name || "Super Admin",
        email: sessionUser.email || "",
      },
      authorizedNumbers: allActiveNumbers,
    };
  }

  // 2. BRANCH ADMIN: Strictly numbers where assignedAdmins contains the logged-in Admin ID
  const adminObjId = mongoose.Types.ObjectId.isValid(sessionUser.id)
    ? new mongoose.Types.ObjectId(sessionUser.id)
    : sessionUser.id;

  const adminNumbers = await TwilioNumber.find({
    assignedAdmins: adminObjId,
    status: { $ne: "inactive" },
    isActive: { $ne: false },
  })
    .populate("assignedAssociates", "name preferredName email")
    .populate("assignedAdmins", "name preferredName email")
    .lean();

  return {
    isAuthorized: true,
    isSuperAdmin: false,
    managingAdmin: {
      id: sessionUser.id,
      _id: sessionUser.id,
      name: sessionUser.name || "Branch Admin",
      email: sessionUser.email || "",
    },
    authorizedNumbers: adminNumbers,
  };
}

/**
 * GET /api/admin/whatsapp-assignment?associateId=<id>
 * Returns assignable WhatsApp numbers strictly scoped to the session user's role:
 * - SuperAdmin: ALL active WhatsApp numbers.
 * - Admin: ONLY numbers assigned to that Admin (assignedAdmins).
 */
export async function GET(req) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);

    const { isAuthorized, isSuperAdmin, managingAdmin, authorizedNumbers } =
      await getAuthorizedNumbersForSession(session?.user);

    if (!session || !isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Admin clearance required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const associateId = searchParams.get("associateId");

    if (!associateId || !mongoose.Types.ObjectId.isValid(associateId)) {
      return NextResponse.json(
        { success: false, error: "Valid User ID is required." },
        { status: 400 }
      );
    }

    const targetUser = await User.findById(associateId).lean();
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    const targetIsAdmin = isAdminAuthorized(targetUser.role, targetUser.department);

    // Branch Admin boundary check (SuperAdmin has no branch or role boundary restriction)
    if (!isSuperAdmin) {
      // 1. Branch Admin CANNOT manage another Admin or Super Admin
      if (targetIsAdmin) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Admins cannot manage assignments for other Admins." },
          { status: 403 }
        );
      }

      // 2. Branch Admin CANNOT manage an associate outside their branch
      const loggedInAdmin = await User.findById(session.user.id).lean();
      const isSameBranch = await isBranchMatching(loggedInAdmin?.branch, targetUser.branch);

      if (!isSameBranch) {
        return NextResponse.json(
          { success: false, error: "Forbidden: You may only view associates in your assigned branch." },
          { status: 403 }
        );
      }
    }

    // Assignable numbers for this modal session
    const assignableNumbers = authorizedNumbers;

    // Query canonical current assignments:
    // - For Admin target: TwilioNumber.assignedAdmins
    // - For Associate target: TwilioNumber.assignedAssociates
    const targetObjId = mongoose.Types.ObjectId.isValid(targetUser._id)
      ? new mongoose.Types.ObjectId(targetUser._id)
      : targetUser._id;

    const currentAssignedDocs = await TwilioNumber.find({
      ...(targetIsAdmin ? { assignedAdmins: targetObjId } : { assignedAssociates: targetObjId }),
      status: { $ne: "inactive" },
      isActive: { $ne: false },
    })
      .populate("assignedAssociates", "name preferredName email")
      .populate("assignedAdmins", "name preferredName email")
      .lean();

    const assignableIdsSet = new Set(assignableNumbers.map((n) => n._id.toString()));

    // Flag stale assignments:
    // - For Admin: currently assigned to target, but not in that Admin's authorized pool.
    // - For SuperAdmin: all active numbers are valid.
    const currentAssignedNumbers = currentAssignedDocs.map((doc) => {
      const isStale = !assignableIdsSet.has(doc._id.toString());
      return {
        _id: doc._id.toString(),
        id: doc._id.toString(),
        friendlyName: doc.friendlyName,
        phoneNumber: doc.phoneNumber,
        status: doc.status || (doc.isActive !== false ? "active" : "inactive"),
        isActive: doc.isActive !== false,
        assignedAssociates: doc.assignedAssociates || [],
        assignedAdmins: doc.assignedAdmins || [],
        isStale,
      };
    });

    const currentAssignedNumberIds = currentAssignedNumbers.map((n) => n._id.toString());

    // Backend Debug Logging (Development only)
    if (process.env.NODE_ENV !== "production") {
      console.log("\n[WHATSAPP ASSIGNMENT GET]");
      console.log("Caller:", session.user?.name, `(Role: ${session.user?.role})`);
      console.log("Target User:", targetUser._id.toString(), `(${targetUser.name}, Admin: ${targetIsAdmin})`);
      console.log("Managing Admin:", managingAdmin?.id, `(${managingAdmin?.name})`);
      console.log("Authorized Numbers Count:", assignableNumbers.length);
      console.log("Current Numbers:", currentAssignedNumberIds);
    }

    return NextResponse.json({
      success: true,
      isSuperAdmin,
      isTargetAdmin: targetIsAdmin,
      associate: {
        id: targetUser._id.toString(),
        _id: targetUser._id.toString(),
        name: targetUser.name,
        email: targetUser.email,
        number: targetUser.number,
        branch: targetUser.branch,
        department: targetUser.department,
        role: targetUser.role,
        isAdmin: targetIsAdmin,
      },
      assignableNumbers: assignableNumbers.map((n) => ({
        _id: n._id.toString(),
        id: n._id.toString(),
        friendlyName: n.friendlyName,
        displayName: n.friendlyName || n.phoneNumber,
        phoneNumber: n.phoneNumber,
        status: n.status || (n.isActive !== false ? "active" : "inactive"),
        isActive: n.isActive !== false,
        assignedAssociates: n.assignedAssociates || [],
        assignedAdmins: n.assignedAdmins || [],
      })),
      currentAssignedNumbers,
      currentAssignedNumberIds,
      managingAdmin,
      adminScope: managingAdmin,
    });
  } catch (error) {
    console.error("GET /api/admin/whatsapp-assignment error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load assignment data" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/whatsapp-assignment
 * Updates WhatsApp number assignments with strict Admin scope authorization validation.
 * 
 * Rules:
 * 1. SuperAdmin -> Admin: $addToSet / $pull on TwilioNumber.assignedAdmins
 * 2. Admin/SuperAdmin -> Associate: $addToSet / $pull on TwilioNumber.assignedAssociates
 * 3. Admin can ONLY assign numbers from own assignedAdmins pool to associates in own branch.
 * 4. User document compatibility fields are synced after canonical mutation.
 */
export async function POST(req) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);

    const { isAuthorized, isSuperAdmin, managingAdmin, authorizedNumbers } =
      await getAuthorizedNumbersForSession(session?.user);

    if (!session || !isAuthorized) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Admin clearance required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { associateId, numberIds } = body;

    if (!associateId || !mongoose.Types.ObjectId.isValid(associateId)) {
      return NextResponse.json(
        { success: false, error: "Valid User ID is required." },
        { status: 400 }
      );
    }

    const targetUser = await User.findById(associateId);
    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    const targetIsAdmin = isAdminAuthorized(targetUser.role, targetUser.department);

    // Branch Admin access control (SuperAdmin has no branch or role restriction)
    if (!isSuperAdmin) {
      // 1. Branch Admin CANNOT manage another Admin or Super Admin
      if (targetIsAdmin) {
        return NextResponse.json(
          {
            success: false,
            message: "Forbidden: Only Super Admin can manage WhatsApp numbers for Admins.",
            error: "Forbidden: Only Super Admin can manage WhatsApp numbers for Admins.",
          },
          { status: 403 }
        );
      }

      // 2. Branch Admin CANNOT assign numbers to associates outside their branch
      const loggedInAdmin = await User.findById(session.user.id).lean();
      const isSameBranch = await isBranchMatching(loggedInAdmin?.branch, targetUser.branch);

      if (!isSameBranch) {
        return NextResponse.json(
          {
            success: false,
            message: "Forbidden: You may only assign numbers to associates in your assigned branch.",
            error: "Forbidden: You may only assign numbers to associates in your assigned branch.",
          },
          { status: 403 }
        );
      }
    }

    // Authorized number IDs pool for this session user
    const authorizedNumberIds = new Set(authorizedNumbers.map((d) => d._id.toString()));

    // Sanitize incoming number IDs array (unique valid string IDs)
    const rawNumberIds = Array.isArray(numberIds) ? numberIds : [];
    const sanitizedNumberIds = Array.from(
      new Set(rawNumberIds.map((id) => (id?._id || id).toString()).filter(Boolean))
    );

    // Selected ObjectIds
    const selectedObjIds = sanitizedNumberIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    // Verify all requested numbers exist in DB
    if (sanitizedNumberIds.length > 0) {
      const existingNumbersCount = await TwilioNumber.countDocuments({
        _id: { $in: selectedObjIds },
      });
      if (existingNumbersCount !== sanitizedNumberIds.length) {
        return NextResponse.json(
          { success: false, error: "One or more provided WhatsApp number IDs are invalid." },
          { status: 400 }
        );
      }
    }

    // Compute existing canonical assignments for this target user
    const currentDocAssignments = await TwilioNumber.find({
      ...(targetIsAdmin ? { assignedAdmins: targetUser._id } : { assignedAssociates: targetUser._id }),
    })
      .select("_id")
      .lean();

    const currentAssignedNumberIds = currentDocAssignments.map((doc) => doc._id.toString());

    // Numbers newly added to this user
    const addedNumberIds = sanitizedNumberIds.filter(
      (id) => !currentAssignedNumberIds.includes(id)
    );

    // Numbers removed from this user
    const removedNumberIds = currentAssignedNumberIds.filter(
      (id) => !sanitizedNumberIds.includes(id)
    );

    // ─── STRICT API VALIDATION: Reject entire operation if any newly added number is unauthorized ───
    if (!isSuperAdmin) {
      const unauthorizedIds = addedNumberIds.filter((id) => !authorizedNumberIds.has(id));
      if (unauthorizedIds.length > 0) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("\n[WHATSAPP ASSIGNMENT REJECTED]", {
            targetUser: targetUser._id.toString(),
            callerRole: session.user?.role,
            unauthorizedIds,
            authorizedPool: Array.from(authorizedNumberIds),
          });
        }

        return NextResponse.json(
          {
            success: false,
            message: "This WhatsApp number is not assigned to this Admin.",
            error: "This WhatsApp number is not assigned to this Admin.",
          },
          { status: 403 }
        );
      }
    }

    // Resolve target's branch ID
    let resolvedBranchId = null;
    if (targetUser.branch) {
      const branchStr = targetUser.branch.toString();
      if (mongoose.Types.ObjectId.isValid(branchStr)) {
        const bDoc = await Branch.findById(branchStr).lean();
        if (bDoc) resolvedBranchId = bDoc._id;
      }
      if (!resolvedBranchId) {
        const bDocByName = await Branch.findOne({ name: targetUser.branch }).lean();
        if (bDocByName) resolvedBranchId = bDocByName._id;
      }
    }

    const addedObjIds = addedNumberIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const removedObjIds = removedNumberIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (targetIsAdmin) {
      // ═════════════════════════════════════════════════════════════════════════
      // TARGET IS ADMIN: Update TwilioNumber.assignedAdmins
      // ═════════════════════════════════════════════════════════════════════════
      // 1. Additive updates: Add admin to TwilioNumbers using $addToSet (Preserves all other admins)
      if (addedObjIds.length > 0) {
        await TwilioNumber.updateMany(
          { _id: { $in: addedObjIds } },
          {
            $addToSet: { assignedAdmins: targetUser._id },
            $set: {
              ...(resolvedBranchId ? { branchId: resolvedBranchId } : {}),
              assignedBy: session.user.id,
              updatedBy: session.user.id,
            },
          }
        );
      }

      // 2. Selective removal: Pull ONLY this admin using $pull (Preserves other admins)
      if (removedObjIds.length > 0) {
        await TwilioNumber.updateMany(
          { _id: { $in: removedObjIds } },
          {
            $pull: { assignedAdmins: targetUser._id },
            $set: { updatedBy: session.user.id },
          }
        );
      }

      // 3. Safety Enforcement: Pull admin from any unselected numbers
      await TwilioNumber.updateMany(
        { _id: { $nin: selectedObjIds }, assignedAdmins: targetUser._id },
        {
          $pull: { assignedAdmins: targetUser._id },
          $set: { updatedBy: session.user.id },
        }
      );

      // 4. Ensure admin is never in assignedAssociates
      await TwilioNumber.updateMany(
        { assignedAssociates: targetUser._id },
        { $pull: { assignedAssociates: targetUser._id } }
      );
    } else {
      // ═════════════════════════════════════════════════════════════════════════
      // TARGET IS ASSOCIATE: Update TwilioNumber.assignedAssociates
      // ═════════════════════════════════════════════════════════════════════════
      // 1. Additive updates: Add associate using $addToSet (Preserves all other associates)
      if (addedObjIds.length > 0) {
        await TwilioNumber.updateMany(
          { _id: { $in: addedObjIds } },
          {
            $addToSet: { assignedAssociates: targetUser._id },
            $set: {
              ...(resolvedBranchId ? { branchId: resolvedBranchId } : {}),
              assignedBy: session.user.id,
              updatedBy: session.user.id,
            },
          }
        );

        if (resolvedBranchId) {
          await Branch.findByIdAndUpdate(resolvedBranchId, {
            $addToSet: { assignedTwilioNumbers: { $each: addedObjIds } },
          });
        }
      }

      // 2. Selective removal: Pull ONLY this associate using $pull (Preserves other associates)
      if (removedObjIds.length > 0) {
        await TwilioNumber.updateMany(
          { _id: { $in: removedObjIds } },
          {
            $pull: { assignedAssociates: targetUser._id },
            $set: { updatedBy: session.user.id },
          }
        );
      }

      // 3. Safety Enforcement: Pull associate from any unselected numbers
      await TwilioNumber.updateMany(
        { _id: { $nin: selectedObjIds }, assignedAssociates: targetUser._id },
        {
          $pull: { assignedAssociates: targetUser._id },
          $set: { updatedBy: session.user.id },
        }
      );

      // 4. Ensure associate is never in assignedAdmins
      await TwilioNumber.updateMany(
        { assignedAdmins: targetUser._id },
        { $pull: { assignedAdmins: targetUser._id } }
      );
    }

    // 5. Synchronize User Document from Canonical DB State
    const canonicalAssignedDocs = await TwilioNumber.find({
      ...(targetIsAdmin ? { assignedAdmins: targetUser._id } : { assignedAssociates: targetUser._id }),
      status: { $ne: "inactive" },
      isActive: { $ne: false },
    })
      .select("_id")
      .lean();

    const finalNumberIds = canonicalAssignedDocs.map((doc) => doc._id);
    const finalNumberIdStrings = finalNumberIds.map((id) => id.toString());

    targetUser.assignedSenderNumbers = finalNumberIds;
    targetUser.assignedTwilioNumbers = finalNumberIds;
    targetUser.assignedSenderNumber = finalNumberIds.length > 0 ? finalNumberIds[0] : null;
    targetUser.assignedBy = session.user.id;
    targetUser.assignedAt = new Date();
    await targetUser.save();

    // Invalidate Redis User Cache
    const redisModule = await import("@/shared/lib/db/redis").catch(() => null);
    const redis = redisModule?.default;
    if (redis && redis.status === "ready") {
      await redis.del("users:all");
      await redis.del(`user:${targetUser._id.toString()}`);
    }

    // Backend Debug Logging (Development only)
    if (process.env.NODE_ENV !== "production") {
      console.log("\n[WHATSAPP ASSIGNMENT POST]");
      console.log("targetId=", targetUser._id.toString(), `(Admin: ${targetIsAdmin})`);
      console.log("selectedIds=", sanitizedNumberIds);
      console.log("currentIds=", currentAssignedNumberIds);
      console.log("addedIds=", addedNumberIds);
      console.log("removedIds=", removedNumberIds);
      console.log("canonicalAssignedIds=", finalNumberIdStrings);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated WhatsApp numbers for ${targetUser.name}.`,
      assignedSenderNumbers: finalNumberIdStrings,
      assignedTwilioNumbers: finalNumberIdStrings,
      assignedSenderNumber: finalNumberIdStrings.length > 0 ? finalNumberIdStrings[0] : null,
      currentAssignedNumbers: canonicalAssignedDocs.map((d) => ({
        _id: d._id.toString(),
        id: d._id.toString(),
      })),
    });
  } catch (error) {
    console.error("POST /api/admin/whatsapp-assignment error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update assignments" },
      { status: 500 }
    );
  }
}
