import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import User from "@/shared/models/User";
import { isAdminAuthorized, isSuperAdmin as checkSuperAdmin } from "@/shared/utils/auth";
import { 
  getPerformanceAnalytics, 
  getAssociateCustomers 
} from "@/features/admin/services/performanceAnalyticsService";

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
    const isSuperAdmin = checkSuperAdmin(session.user.role);
    const isAdmin = isAdminAuthorized(session.user.role, session.user.department);

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    // 3. Extract filters
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // Sub-endpoint: Lazy loaded associate customers timeline
    if (action === "associateCustomers") {
      const associateId = searchParams.get("associateId");
      if (!associateId) {
        return NextResponse.json({ success: false, error: "Associate ID required" }, { status: 400 });
      }
      const customers = await getAssociateCustomers(associateId);
      return NextResponse.json({
        success: true,
        customers
      });
    }

    const dateRange = searchParams.get("dateRange") || "thisMonth";
    const customStart = searchParams.get("startDate");
    const customEnd = searchParams.get("endDate");
    let branchFilter = searchParams.get("branchId") || "all";
    const departmentFilter = searchParams.get("department") || "all";
    const roleFilter = searchParams.get("role") || "all";
    const associateStatus = searchParams.get("associateStatus") || "all";
    const leadTypeFilter = searchParams.get("leadType") || "all";
    const associateFilter = searchParams.get("associateId") || "all";
    const leadStatus = searchParams.get("leadStatus") || "all";

    // 4. Force inject regular Admin's own branch reference (watertight RBAC)
    let adminBranch = null;
    if (!isSuperAdmin) {
      const adminUser = await User.findById(session.user.id).lean();
      adminBranch = adminUser ? adminUser.branch?.toString() : null;
      branchFilter = adminBranch || "none";
    }

    const analytics = await getPerformanceAnalytics({
      dateRange,
      customStart,
      customEnd,
      branchFilter,
      departmentFilter,
      roleFilter,
      associateStatus,
      leadTypeFilter,
      associateFilter,
      leadStatus,
      isSuperAdmin,
      adminBranch,
      sessionUserId: session.user.id
    });

    return NextResponse.json({
      success: true,
      ...analytics
    });
  } catch (error) {
    console.error("Performance Monitor API Error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
