import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import redis from "@/lib/redis";
import { processRosterMetrics } from "@/lib/rosterProcessor";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 🚀 FIX: Added 'superAdmin' condition here to fix the 403 Forbidden error
    const isAllowed =
      session.user.role === 'superAdmin' || 
      (session.user.role === "doctor" && session.user.department === "admin");

    if (!isAllowed) {
      return NextResponse.json(
        { error: "Forbidden: Doctor Admin access required." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month")) || new Date().getUTCMonth() + 1;
    const year = parseInt(searchParams.get("year")) || new Date().getUTCFullYear();

    const cacheKey = `roster:doctorAdmin:${month}:${year}`;
    if (redis && redis.status === "ready") {
      const cached = await redis.get(cacheKey);
      if (cached) return NextResponse.json(JSON.parse(cached));
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const users = await User.find({
      role: "doctor",
      department: { $regex: "^(telecalling|support)$", $options: "i" },
    }).lean();

    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        roster: [],
        analytics: { totalLeads: 0, totalPending: 0, totalFollowUp: 0, totalAchieved: 0, totalTarget: 0 },
      });
    }

    const { roster, companyAnalytics } = await processRosterMetrics(users, startDate, endDate);

    const response = { success: true, roster, analytics: companyAnalytics };

    if (redis && redis.status === "ready") {
      await redis.setex(cacheKey, 300, JSON.stringify(response));
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Doctor Admin Roster API Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}