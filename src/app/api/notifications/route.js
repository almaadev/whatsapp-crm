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

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "all";
    const page = searchParams.get("page") || 1;
    const limit = searchParams.get("limit") || 20;

    const result = await notificationService.getNotifications(session.user.id, {
      filter,
      page,
      limit
    });

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("[GET /api/notifications ERROR]", error);
    return NextResponse.json({ success: false, error: "Failed to fetch notifications" }, { status: 500 });
  }
}
