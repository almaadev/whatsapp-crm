import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import mongoose from "mongoose";
import TwilioNumber from "@/shared/models/TwilioNumber";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";
import { formatPhoneNumber } from "@/features/admin/services/twilioService";
import { isAdminAuthorized } from "@/shared/utils/auth";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);

    if (!session || !isAdminAuthorized(session?.user?.role, session?.user?.department)) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    const isSuperAdmin = session?.user?.role === "superAdmin";

    const { id } = await params;
    const body = await req.json();
    const targetNumber = await TwilioNumber.findById(id);

    if (!targetNumber) {
      return NextResponse.json({ error: "Twilio Number not found." }, { status: 404 });
    }

    const redisModule = await import("@/shared/lib/db/redis").catch(() => null);
    const redis = redisModule?.default;

    // Helper to synchronize User document from canonical TwilioNumber state
    const syncUserFields = async (userId) => {
      const uDoc = await User.findById(userId).lean();
      const isTargetAdmin = uDoc ? isAdminAuthorized(uDoc.role, uDoc.department) : false;
      const canonicalNumbers = await TwilioNumber.find(
        isTargetAdmin
          ? { assignedAdmins: userId, status: { $ne: "inactive" }, isActive: { $ne: false } }
          : { assignedAssociates: userId, status: { $ne: "inactive" }, isActive: { $ne: false } }
      ).select("_id").lean();
      const numIds = canonicalNumbers.map((n) => n._id);

      await User.findByIdAndUpdate(userId, {
        $set: {
          assignedSenderNumbers: numIds,
          assignedTwilioNumbers: numIds,
          assignedSenderNumber: numIds.length > 0 ? numIds[0] : null,
        },
      });
    };

    // ─── ACTION 1: ASSIGN NUMBER (Many-to-Many Additive) ───────────────────────
    if (body.action === "assign") {
      const associateId = body.associateId || (Array.isArray(body.assignedAssociates) ? body.assignedAssociates[0] : null);
      if (!associateId) {
        return NextResponse.json({ error: "Associate ID is required for assignment." }, { status: 400 });
      }

      // Load and validate associate from MongoDB
      const associate = await User.findById(associateId);
      if (!associate) {
        return NextResponse.json({ error: "Associate not found." }, { status: 404 });
      }
      if (associate.active === false) {
        return NextResponse.json({ error: "Cannot assign number to an inactive associate." }, { status: 400 });
      }

      // Resolve actual branch from associate
      let resolvedBranchId = null;
      if (associate.branch) {
        const branchStr = associate.branch.toString();
        if (mongoose.Types.ObjectId.isValid(branchStr)) {
          const bDoc = await Branch.findById(branchStr);
          if (bDoc) resolvedBranchId = bDoc._id;
        }
        if (!resolvedBranchId) {
          const bDocByName = await Branch.findOne({ name: associate.branch });
          if (bDocByName) resolvedBranchId = bDocByName._id;
        }
      }

      // Update TwilioNumber using $addToSet (Many-to-Many)
      await TwilioNumber.findByIdAndUpdate(targetNumber._id, {
        $addToSet: { assignedAssociates: associate._id },
        $pull: !isAdminAuthorized(associate.role, associate.department) ? { assignedAdmins: associate._id } : {},
        $set: {
          ...(resolvedBranchId ? { branchId: resolvedBranchId } : {}),
          assignedBy: session.user.id,
          updatedBy: session.user.id,
        },
      });

      // Synchronize User record from canonical
      await syncUserFields(associate._id);

      // Update Branch relation if resolved
      if (resolvedBranchId) {
        await Branch.findByIdAndUpdate(resolvedBranchId, {
          $addToSet: { assignedTwilioNumbers: targetNumber._id },
        });
      }

      if (redis && redis.status === "ready") await redis.del("users:all");

      const populated = await TwilioNumber.findById(targetNumber._id)
        .populate("assignedAssociates", "name preferredName email department branch")
        .populate("branchId", "name code address phone")
        .populate("assignedAdmins", "name email")
        .lean();

      return NextResponse.json({ success: true, number: populated });
    }

    // ─── ACTION 2: REASSIGN NUMBER ───────────────────────────────────────────
    if (body.action === "reassign") {
      const newAssociateId = body.associateId || body.newAssociateId;
      if (!newAssociateId) {
        return NextResponse.json({ error: "New Associate ID is required for reassignment." }, { status: 400 });
      }

      const newAssociate = await User.findById(newAssociateId);
      if (!newAssociate) {
        return NextResponse.json({ error: "New associate not found." }, { status: 404 });
      }
      if (newAssociate.active === false) {
        return NextResponse.json({ error: "Cannot reassign number to an inactive associate." }, { status: 400 });
      }

      // Resolve branch for new associate
      let resolvedBranchId = null;
      if (newAssociate.branch) {
        const branchStr = newAssociate.branch.toString();
        if (mongoose.Types.ObjectId.isValid(branchStr)) {
          const bDoc = await Branch.findById(branchStr);
          if (bDoc) resolvedBranchId = bDoc._id;
        }
        if (!resolvedBranchId) {
          const bDocByName = await Branch.findOne({ name: newAssociate.branch });
          if (bDocByName) resolvedBranchId = bDocByName._id;
        }
      }

      const oldBranchId = targetNumber.branchId?.toString();

      // Update TwilioNumber: add new associate
      await TwilioNumber.findByIdAndUpdate(targetNumber._id, {
        $addToSet: { assignedAssociates: newAssociate._id },
        $pull: !isAdminAuthorized(newAssociate.role, newAssociate.department) ? { assignedAdmins: newAssociate._id } : {},
        $set: {
          ...(resolvedBranchId ? { branchId: resolvedBranchId } : {}),
          assignedBy: session.user.id,
          updatedBy: session.user.id,
        },
      });

      // Synchronize new associate
      await syncUserFields(newAssociate._id);

      // Update branch references
      const newBranchIdStr = resolvedBranchId?.toString();
      if (oldBranchId && oldBranchId !== newBranchIdStr) {
        await Branch.findByIdAndUpdate(oldBranchId, {
          $pull: { assignedTwilioNumbers: targetNumber._id },
        });
      }
      if (newBranchIdStr) {
        await Branch.findByIdAndUpdate(newBranchIdStr, {
          $addToSet: { assignedTwilioNumbers: targetNumber._id },
        });
      }

      if (redis && redis.status === "ready") await redis.del("users:all");

      const populated = await TwilioNumber.findById(targetNumber._id)
        .populate("assignedAssociates", "name preferredName email department branch")
        .populate("branchId", "name code address phone")
        .populate("assignedAdmins", "name email")
        .lean();

      return NextResponse.json({ success: true, number: populated });
    }

    // ─── ACTION 3: UNASSIGN NUMBER (Selective Pull) ──────────────────────────
    if (body.action === "unassign" || body.unassign === true) {
      const specificAssociateId = body.associateId;

      if (specificAssociateId) {
        // Unassign ONLY this specific associate ($pull)
        await TwilioNumber.findByIdAndUpdate(targetNumber._id, {
          $pull: { assignedAssociates: specificAssociateId },
          $set: { updatedBy: session.user.id },
        });

        await syncUserFields(specificAssociateId);
      } else {
        // Unassign all associates from this number
        const oldAssociateIds = (targetNumber.assignedAssociates || []).map((id) => (id._id || id).toString());

        await TwilioNumber.findByIdAndUpdate(targetNumber._id, {
          $set: { assignedAssociates: [], updatedBy: session.user.id },
        });

        for (const oldId of oldAssociateIds) {
          await syncUserFields(oldId);
        }
      }

      if (redis && redis.status === "ready") await redis.del("users:all");

      const populated = await TwilioNumber.findById(targetNumber._id)
        .populate("assignedAssociates", "name preferredName email department branch")
        .populate("branchId", "name code address phone")
        .populate("assignedAdmins", "name email")
        .lean();

      return NextResponse.json({ success: true, number: populated });
    }

    // ─── GENERAL UPDATES (Status toggle, friendly name, etc.) ───────────────────
    const oldBranchId = targetNumber.branchId?.toString();

    if (body.status !== undefined) {
      targetNumber.status = body.status;
      targetNumber.isActive = body.status === "active";
    }

    if (isSuperAdmin) {
      if (body.friendlyName !== undefined) targetNumber.friendlyName = body.friendlyName;
      if (body.phoneNumber !== undefined) targetNumber.phoneNumber = formatPhoneNumber(body.phoneNumber);
      if (body.branchId !== undefined) targetNumber.branchId = body.branchId || null;
      if (body.assignedAdmins !== undefined) targetNumber.assignedAdmins = body.assignedAdmins;
    }

    targetNumber.updatedBy = session.user.id;
    await targetNumber.save();

    // Sync Branch references if branch changed
    const newBranchId = targetNumber.branchId?.toString();
    if (oldBranchId && oldBranchId !== newBranchId) {
      await Branch.findByIdAndUpdate(oldBranchId, {
        $pull: { assignedTwilioNumbers: targetNumber._id },
      });
    }
    if (newBranchId) {
      await Branch.findByIdAndUpdate(newBranchId, {
        $addToSet: { assignedTwilioNumbers: targetNumber._id },
      });
    }

    const populated = await TwilioNumber.findById(targetNumber._id)
      .populate("assignedAssociates", "name preferredName email department branch")
      .populate("branchId", "name code address phone")
      .populate("assignedAdmins", "name email")
      .lean();

    return NextResponse.json({ success: true, number: populated });
  } catch (error) {
    console.error("PUT /api/admin/twilio/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);

    if (!session || session?.user?.role !== "superAdmin") {
      return NextResponse.json({ error: "Forbidden: Super Admin access required." }, { status: 403 });
    }

    const { id } = await params;
    const targetNumber = await TwilioNumber.findById(id);

    if (!targetNumber) {
      return NextResponse.json({ error: "Twilio Number not found." }, { status: 404 });
    }

    if (targetNumber.branchId) {
      await Branch.findByIdAndUpdate(targetNumber.branchId, {
        $pull: { assignedTwilioNumbers: targetNumber._id },
      });
    }

    // Pull from all users' assigned sender number arrays
    await User.updateMany(
      {
        $or: [
          { assignedSenderNumbers: targetNumber._id },
          { assignedTwilioNumbers: targetNumber._id },
          { assignedSenderNumber: targetNumber._id },
        ],
      },
      {
        $pull: {
          assignedSenderNumbers: targetNumber._id,
          assignedTwilioNumbers: targetNumber._id,
        },
        $unset: { assignedSenderNumber: 1 },
      }
    );

    await TwilioNumber.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: "Twilio number deleted successfully." });
  } catch (error) {
    console.error("DELETE /api/admin/twilio/[id] error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
