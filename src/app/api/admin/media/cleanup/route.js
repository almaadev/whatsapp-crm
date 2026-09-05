import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import mediaCleanupService from "@/server/services/mediaCleanupService";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const result = await mediaCleanupService.runCleanup();

    return NextResponse.json({
      success: true,
      message: `Cleanup completed. Checked ${result.checkedCount} records, deleted ${result.deletedCount} expired assets.`,
      data: result,
    });
  } catch (error) {
    console.error("[POST /api/admin/media/cleanup] Error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
