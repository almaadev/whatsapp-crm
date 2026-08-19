import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/shared/lib/auth";
import { notificationService } from "@/server/services/notificationService";

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized access" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ success: false, error: "Notification ID is required" }, { status: 400 });
    }

    const notification = await notificationService.dismissNotification(id, session.user.id);
    if (!notification) {
      return NextResponse.json({ success: false, error: "Notification not found or access denied" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Notification dismissed",
      notification
    });
  } catch (error) {
    console.error("[POST /api/notifications/[id]/dismiss ERROR]", error);
    return NextResponse.json({ success: false, error: "Failed to dismiss notification" }, { status: 500 });
  }
}
