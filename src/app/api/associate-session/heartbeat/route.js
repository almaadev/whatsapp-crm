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

    const activeSession = await associateSessionService.heartbeatSession(session.user.id, sessionId);

    if (!activeSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 440 });
    }

    return NextResponse.json({
      success: true,
      session: {
        sessionId: activeSession._id,
        associateId: activeSession.associateId,
        loginAt: activeSession.loginAt,
        status: activeSession.status,
        lastHeartbeatAt: activeSession.lastHeartbeatAt,
        totalOnlineSeconds: activeSession.totalOnlineSeconds,
        totalOfflineSeconds: activeSession.totalOfflineSeconds,
        segments: activeSession.segments
      }
    });
  } catch (error) {
    console.error("[ASSOCIATE SESSION HEARTBEAT ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
