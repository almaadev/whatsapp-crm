import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/shared/lib/auth";
import { associateSessionService } from "@/server/services/associateSessionService";
import { isAdminAuthorized, isSuperAdmin as checkSuperAdmin } from "@/shared/utils/auth";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized", message: "Session expired or invalid" }, { status: 401 });
    }

    const isSuper = checkSuperAdmin(session.user.role);
    const isAdmin = isAdminAuthorized(session.user.role, session.user.department);

    if (!isSuper && !isAdmin) {
      return NextResponse.json({
        success: false,
        error: "Forbidden",
        message: "Access Denied: Attendance summaries are restricted to Admins and SuperAdmins."
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get("dateRange") || "today";
    const customStart = searchParams.get("customStart");
    const customEnd = searchParams.get("customEnd");
    const associateId = searchParams.get("associateId") || "All";
    const branchId = searchParams.get("branchId") || "All";

    const filters = {
      dateRange,
      customStart,
      customEnd,
      associateId,
      branchId
    };

    const dailySummary = await associateSessionService.getAssociateDailySummary(filters, session);

    return NextResponse.json({
      success: true,
      summary: dailySummary
    });
  } catch (error) {
    console.error("[ADMIN ASSOCIATE LOGS SUMMARY API ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error", message: error.message || "Failed to process summary request" }, { status: 500 });
  }
}
