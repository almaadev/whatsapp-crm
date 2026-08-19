import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/shared/lib/auth";
import { associateSessionService } from "@/server/services/associateSessionService";
import connectDB from "@/shared/lib/db/mongodb";
import AssociateSession from "@/shared/models/AssociateSession";
import User from "@/shared/models/User";
import { resolveAssociateLogScope } from "@/shared/utils/serverAuth";

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized", message: "Session expired or invalid" }, { status: 401 });
    }

    const { associateId } = await params;
    if (!associateId) {
      return NextResponse.json({ success: false, error: "Bad Request", message: "Associate ID required" }, { status: 400 });
    }

    await connectDB();
    await associateSessionService.reconcileStaleSessions();

    const scopeInfo = await resolveAssociateLogScope(session);

    // Rule: Associate can ONLY view self
    if (scopeInfo.scope === "self") {
      if (associateId.toString() !== scopeInfo.userId) {
        return NextResponse.json({
          success: false,
          error: "Forbidden",
          message: "Associates can only access their own session history"
        }, { status: 403 });
      }
    } else if (scopeInfo.scope === "branch") {
      // Rule: Admin monitoring view is for subordinate staff ONLY. Deny Admin's own ID on this monitoring route.
      if (associateId.toString() === scopeInfo.userId) {
        return NextResponse.json({
          success: false,
          error: "Forbidden",
          message: "Admin monitoring view is restricted to subordinate staff. View your own attendance via /crm/associate."
        }, { status: 403 });
      }

      const targetUser = await User.findById(associateId).select("branch role").lean();
      if (!targetUser) {
        return NextResponse.json({ success: false, error: "Not Found", message: "Associate user not found" }, { status: 404 });
      }

      if (targetUser.role === "superAdmin") {
        return NextResponse.json({
          success: false,
          error: "Forbidden",
          message: "Cannot access SuperAdmin session records"
        }, { status: 403 });
      }

      let targetBranchStr = "";
      if (typeof targetUser.branch === "object" && targetUser.branch) {
        targetBranchStr = (targetUser.branch._id || targetUser.branch.id || targetUser.branch).toString();
      } else if (targetUser.branch) {
        targetBranchStr = targetUser.branch.toString();
      }

      if (!targetBranchStr || !scopeInfo.userBranchIds.includes(targetBranchStr)) {
        return NextResponse.json({
          success: false,
          error: "Forbidden",
          message: "Requested associate is outside your branch access scope"
        }, { status: 403 });
      }
    }

    const query = { associateId };

    const sessionHistory = await AssociateSession.find(query)
      .populate("associateId", "name email branch role department preferredName")
      .populate("branchId", "name")
      .sort({ loginAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      history: sessionHistory
    });
  } catch (error) {
    console.error("[ADMIN ASSOCIATE LOG DETAILS API ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error", message: error.message || "Failed to fetch associate session details" }, { status: 500 });
  }
}
