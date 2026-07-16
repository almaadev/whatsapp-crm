import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import User from "@/shared/models/User";
import Lead from "@/shared/models/Lead";
import Branch from "@/shared/models/Branch";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        await connectDB();
        
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const isSuperAdmin = session?.user?.role === 'superAdmin';
        const currentUserEmail = session?.user?.email;

        // --- 1. Parse Filters (Default to Current Month/Year) ---
        const { searchParams } = new URL(req.url);
        const now = new Date();
        const monthParam = searchParams.get("month");
        const yearParam = searchParams.get("year");
        const branchId = searchParams.get("branchId");

        const targetMonth = monthParam ? parseInt(monthParam) : now.getUTCMonth() + 1;
        const targetYear = yearParam ? parseInt(yearParam) : now.getUTCFullYear();

        const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

        // --- 2. Fetch Users ---
        const userQuery = { role: { $ne: 'superAdmin' } };
        if (branchId && branchId !== "all") {
            userQuery.branch = branchId;
        }
        const allUsers = await User.find(userQuery).lean();

        const branches = await Branch.find().lean();
        const branchMap = {};
        branches.forEach(b => {
            branchMap[b._id.toString()] = b.name;
        });
        let filteredUsers = allUsers;
        if (!isSuperAdmin) {
            filteredUsers = allUsers.filter(u => 
                (u.isAdmin !== true && u.department !== 'admin') || u.email === currentUserEmail
            );
        }

        // --- 3. Fetch Leads Active in Selected Month ---
        const activeLeads = await Lead.find({
            $or: [
                { createdAt: { $gte: startDate, $lte: endDate } },
                { "leads.date": { $gte: startDate, $lte: endDate } },
                { closedAt: { $gte: startDate, $lte: endDate } }
            ]
        }).lean();

        // --- 4. Process Roster Metrics ---
        let companyAnalytics = { totalLeads: 0, totalPending: 0, totalFollowUp: 0, totalAchieved: 0, totalTarget: 0 };

        const roster = filteredUsers.map(user => {
            const userIdStr = user._id.toString();
            const userName = user.name;

            let totalLeads = 0;
            let pendingCount = 0;
            let followUpCount = 0;
            let achievedCount = 0;

            activeLeads.forEach(lead => {
                const history = lead.leads || [];
                const firstFollowUp = history.length > 0 ? history[0] : null;
                const latestFollowUp = history.length > 0 ? history[history.length - 1] : null;

                const originHandler = firstFollowUp?.associateId || lead.associateId;
                const currentHandler = latestFollowUp?.associateId || lead.assignedTo;
                
                const isOrigin = originHandler === userIdStr || originHandler === userName;
                const isCurrent = currentHandler === userIdStr || currentHandler === userName;

                // A. Total Leads Acquired/Handled this month
                const firstDate = new Date(firstFollowUp?.date || lead.createdAt);
                if (firstDate >= startDate && firstDate <= endDate && isOrigin) {
                    totalLeads++;
                    companyAnalytics.totalLeads++;
                }

                // B. Achieved (Closed this month)
                if (lead.isClosed && lead.closedById === userIdStr && lead.closedAt) {
                    const closedDate = new Date(lead.closedAt);
                    if (closedDate >= startDate && closedDate <= endDate) {
                        achievedCount++;
                        companyAnalytics.totalAchieved++;
                    }
                }

                // C. Active Pipeline (Pending vs Follow Up) - Only count if user is current handler
                if (!lead.isClosed && isCurrent) {
                    const status = latestFollowUp?.status || lead.status || "New";
                    
                    if (status === "Follow Up") {
                        const followUpDate = new Date(latestFollowUp?.date || lead.createdAt);
                        const hoursDiff = (Date.now() - followUpDate.getTime()) / (1000 * 60 * 60);
                        if (hoursDiff > 48) {
                            pendingCount++;
                            companyAnalytics.totalPending++;
                        } else {
                            followUpCount++;
                            companyAnalytics.totalFollowUp++;
                        }
                    } else if (status === "New" || status === "Not Interested") {
                        pendingCount++;
                        companyAnalytics.totalPending++;
                    }
                }
            });

            const totalTarget = user.target || 0;
            companyAnalytics.totalTarget += totalTarget;
            
            const conversionRate = totalLeads > 0 ? Math.round((achievedCount / totalLeads) * 100) : 0;
            const progress = totalTarget > 0 ? Math.min(100, Math.round((achievedCount / totalTarget) * 100)) : 0;

            const branchVal = user.branch?.toString() || "";
            const branchName = branchMap[branchVal] || user.branch || "-";

            return {
                id: userIdStr, name: userName, role: user.role, branch: branchName, 
                target: totalTarget, totalLeads, pendingCount, followUpCount, achievedCount, conversionRate, progress
            };
        });

        return NextResponse.json({ success: true, roster, analytics: companyAnalytics });
    } catch (error) {
        console.error("Roster API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to load roster" }, { status: 500 });
    }
}