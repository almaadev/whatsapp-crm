import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/shared/lib/auth";
import { associateSessionService } from "@/server/services/associateSessionService";
import connectDB from "@/shared/lib/db/mongodb";
import User from "@/shared/models/User";

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let activeSession = await associateSessionService.getActiveSession(session.user.id);

    // If associate is authenticated but has no active session, create one
    if (!activeSession) {
      await connectDB();
      const userDoc = await User.findById(session.user.id).lean();
      if (userDoc) {
        activeSession = await associateSessionService.createLoginSession(userDoc);
      }
    }

    if (!activeSession) {
      return NextResponse.json({ success: false, session: null });
    }

    return NextResponse.json({
      success: true,
      session: {
        sessionId: activeSession._id,
        associateId: activeSession.associateId,
        branchId: activeSession.branchId,
        branchName: activeSession.branchName,
        loginAt: activeSession.loginAt,
        status: activeSession.status,
        lastHeartbeatAt: activeSession.lastHeartbeatAt,
        totalOnlineSeconds: activeSession.totalOnlineSeconds,
        totalOfflineSeconds: activeSession.totalOfflineSeconds,
        segments: activeSession.segments
      }
    });
  } catch (error) {
    console.error("[ASSOCIATE SESSION CURRENT ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
