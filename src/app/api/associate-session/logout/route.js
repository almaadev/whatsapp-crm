import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/shared/lib/auth";
import { associateSessionService } from "@/server/services/associateSessionService";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = body.sessionId;

    const loggedOutSession = await associateSessionService.logoutSession(
      session.user.id,
      sessionId,
      "manual_logout"
    );

    return NextResponse.json({
      success: true,
      message: "Associate session logged out successfully",
      session: loggedOutSession
    });
  } catch (error) {
    console.error("[ASSOCIATE SESSION LOGOUT ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
