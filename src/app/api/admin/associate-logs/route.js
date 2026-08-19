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
        message: "Access Denied: The Associate Logs monitoring page is restricted to Admins and SuperAdmins. Associates should view their own attendance via /crm/associate."
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get("dateRange") || "today";
    const customStart = searchParams.get("customStart");
    const customEnd = searchParams.get("customEnd");
    const associateId = searchParams.get("associateId") || "All";
    const branchId = searchParams.get("branchId") || "All";
    const status = searchParams.get("status") || "All";
    const logoutReason = searchParams.get("logoutReason") || "All";

    const filters = {
      dateRange,
      customStart,
      customEnd,
      associateId,
      branchId,
      status,
      logoutReason
    };

    const sessionLogs = await associateSessionService.getAssociateSessionLogs(filters, session);

    return NextResponse.json({
      success: true,
      logs: sessionLogs
    });
  } catch (error) {
    console.error("[ADMIN ASSOCIATE LOGS API ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error", message: error.message || "Failed to process request" }, { status: 500 });
  }
}
