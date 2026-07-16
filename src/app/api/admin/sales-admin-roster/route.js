import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import User from "@/shared/models/User";
import redis from "@/shared/lib/db/redis";
import { processRosterMetrics } from "@/shared/lib/rosterProcessor";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);

    // 1. Strict Authentication Check
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Strict Authorization Check
    const isAllowed =
      session.user.role === "superAdmin" ||
      (session.user.role === "sales" && session.user.department === "admin");

    if (!isAllowed) {
      return NextResponse.json(
        { error: "Forbidden: Sales Admin access required." },
        { status: 403 },
      );
    }

    // 3. Time & Branch Intelligence
    const { searchParams } = new URL(req.url);
    const month =
      parseInt(searchParams.get("month")) || new Date().getUTCMonth() + 1;
    const year =
      parseInt(searchParams.get("year")) || new Date().getUTCFullYear();
    const branchId = searchParams.get("branchId") || "all";
    const adminBranch = await (async () => {
      const user = await User.findById(session.user.id).lean();
      return user ? user.branch : null;
    })();

    // 4. Redis Cache Check
    const cacheKey = `roster:salesAdmin:${month}:${year}:${branchId}`;
    if (redis && redis.status === "ready") {
      const cached = await redis.get(cacheKey);
      if (cached) return NextResponse.json(JSON.parse(cached));
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // 5. 🚀 FIX: Correct Role and Department fetching based on your exact User Schema
    const query = {
      role: "sales",
      department: { $regex: "^(telecalling|support)$", $options: "i" },
    };

    if (session.user.role === "superAdmin") {
      if (branchId && branchId !== "all") {
        query.branch = branchId;
      }
    } else {
      query.branch = adminBranch;
    }

    const users = await User.find(query).lean();

    // 6. Fallback Safety for Empty Datasets
    if (!users || users.length === 0) {
      return NextResponse.json({
        success: true,
        roster: [],
        analytics: {
          totalLeads: 0,
          totalPending: 0,
          totalFollowUp: 0,
          totalAchieved: 0,
          totalTarget: 0,
        },
      });
    }

    // 7. Process Metrics
    const { roster, companyAnalytics } = await processRosterMetrics(
      users,
      startDate,
      endDate,
    );

    const response = { success: true, roster, analytics: companyAnalytics };

    // 8. Cache & Return
    if (redis && redis.status === "ready") {
      await redis.setex(cacheKey, 300, JSON.stringify(response));
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Sales Admin Roster API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
