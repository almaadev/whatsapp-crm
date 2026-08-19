import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/shared/lib/auth";
import { associateSessionService } from "@/server/services/associateSessionService";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized", message: "Session expired or invalid" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const dateRange = searchParams.get("dateRange") || "30days";
    const customStart = searchParams.get("customStart");
    const customEnd = searchParams.get("customEnd");
    const status = searchParams.get("status") || "All";
    const logoutReason = searchParams.get("logoutReason") || "All";

    // Strictly force associateId = current logged in user ID
    const filters = {
      dateRange,
      customStart,
      customEnd,
      status,
      logoutReason,
      associateId: session.user.id
    };

    const sessionHistory = await associateSessionService.getAssociateSessionLogs(filters, session);

    return NextResponse.json({
      success: true,
      sessions: sessionHistory
    });
  } catch (error) {
    console.error("[SELF ASSOCIATE SESSION HISTORY API ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal Server Error", message: error.message || "Failed to fetch session history" }, { status: 500 });
  }
}
