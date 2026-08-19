import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/shared/lib/auth";
import { notificationService } from "@/server/services/notificationService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
    }

    const unreadCount = await notificationService.getUnreadCount(session.user.id);

    return NextResponse.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error("[GET /api/notifications/unread-count ERROR]", error);
    return NextResponse.json({ success: false, error: "Failed to get unread count" }, { status: 500 });
  }
}
