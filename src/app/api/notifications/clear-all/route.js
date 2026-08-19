import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/shared/lib/auth";
import { notificationService } from "@/server/services/notificationService";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
    }

    const result = await notificationService.clearAllNotifications(session.user.id);

    return NextResponse.json({
      success: true,
      message: "All notifications cleared",
      modifiedCount: result?.modifiedCount || 0
    });
  } catch (error) {
    console.error("[POST /api/notifications/clear-all ERROR]", error);
    return NextResponse.json({ success: false, error: "Failed to clear notifications" }, { status: 500 });
  }
}
