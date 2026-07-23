import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import TwilioNumber from "@/shared/models/TwilioNumber";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";
import { formatPhoneNumber } from "@/features/admin/services/twilioService";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);

    const isSuperAdmin = session?.user?.role === "superAdmin";
    const isAdmin = session?.user?.department === "admin";

    if (!session || (!isSuperAdmin && !isAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const targetNumber = await TwilioNumber.findById(id);

    if (!targetNumber) {
      return NextResponse.json({ error: "Twilio Number not found." }, { status: 404 });
    }

    // Only Super Admin or Admin with branch permissions can modify
    if (!isSuperAdmin) {
      // Admins can assign available numbers to associates
      if (body.assignedAssociates) {
        targetNumber.assignedAssociates = body.assignedAssociates;
        targetNumber.updatedBy = session.user.id;
        await targetNumber.save();
        return NextResponse.json({ success: true, number: targetNumber });
      }
      return NextResponse.json({ error: "Super Admin clearance required to reassign branches." }, { status: 403 });
    }

    const oldBranchId = targetNumber.branchId?.toString();

    if (body.friendlyName !== undefined) targetNumber.friendlyName = body.friendlyName;
    if (body.phoneNumber !== undefined) targetNumber.phoneNumber = formatPhoneNumber(body.phoneNumber);
    if (body.status !== undefined) {
      targetNumber.status = body.status;
      targetNumber.isActive = body.status === "active";
    }
    if (body.branchId !== undefined) {
      targetNumber.branchId = body.branchId || null;
    }
    if (body.assignedAdmins !== undefined) {
      targetNumber.assignedAdmins = body.assignedAdmins;
    }
    if (body.assignedAssociates !== undefined) {
      targetNumber.assignedAssociates = body.assignedAssociates;
    }

    targetNumber.updatedBy = session.user.id;
    await targetNumber.save();

    // Update Branch references
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

    return NextResponse.json({ success: true, number: targetNumber });
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
