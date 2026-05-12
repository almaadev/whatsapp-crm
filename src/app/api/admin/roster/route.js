import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Lead from "@/models/Lead";

export const dynamic = "force-dynamic";

<<<<<<< HEAD
export async function GET() {
=======
export async function GET(req) {
>>>>>>> c1be5bc (Initial commit from new system)
    try {
        await connectDB();
        
        const session = await getServerSession(authOptions);
<<<<<<< HEAD
        const isSuperAdmin = session?.user?.role === 'superAdmin';
        const currentUserEmail = session?.user?.email;

        const allUsers = await User.find({ role: { $ne: 'superAdmin' } }).lean();

=======
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const isSuperAdmin = session?.user?.role === 'superAdmin';
        const currentUserEmail = session?.user?.email;

        // --- 1. Parse Time Filters (Default to Current Month/Year) ---
        const { searchParams } = new URL(req.url);
        const now = new Date();
        const monthParam = searchParams.get("month");
        const yearParam = searchParams.get("year");

        const targetMonth = monthParam ? parseInt(monthParam) : now.getUTCMonth() + 1;
        const targetYear = yearParam ? parseInt(yearParam) : now.getUTCFullYear();

        const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

        // --- 2. Fetch Users ---
        const allUsers = await User.find({ role: { $ne: 'superAdmin' } }).lean();
>>>>>>> c1be5bc (Initial commit from new system)
        let filteredUsers = allUsers;
        if (!isSuperAdmin) {
            filteredUsers = allUsers.filter(u => 
                (u.isAdmin !== true && u.department !== 'admin') || u.email === currentUserEmail
            );
        }

<<<<<<< HEAD
        // ONE SINGLE FETCH NOW!
        const allLeads = await Lead.find({}).lean();
=======
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
>>>>>>> c1be5bc (Initial commit from new system)

        const roster = filteredUsers.map(user => {
            const userIdStr = user._id.toString();
            const userName = user.name;

<<<<<<< HEAD
            // Filter for current user
            const userLeads = allLeads.filter(l => l.associateId === userIdStr || l.assignedTo === userName || l.associate === userName);

=======
            let totalLeads = 0;
>>>>>>> c1be5bc (Initial commit from new system)
            let pendingCount = 0;
            let followUpCount = 0;
            let achievedCount = 0;

<<<<<<< HEAD
            const now = new Date();

            userLeads.forEach(lead => {
                if (lead.status === "Closed" || lead.isClosed) {
                    achievedCount++;
                } else if (lead.status === "Follow Up") {
                    const followUpDate = lead.followUpStart ? new Date(lead.followUpStart) : new Date(lead.createdAt);
                    const hoursDiff = (now - followUpDate) / (1000 * 60 * 60);
                    if (hoursDiff > 48) pendingCount++; else followUpCount++;
                } else if (lead.status === "New" || !lead.status) {
                    pendingCount++; 
=======
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
>>>>>>> c1be5bc (Initial commit from new system)
                }
            });

            const totalTarget = user.target || 0;
<<<<<<< HEAD
            const totalInteractions = pendingCount + followUpCount + achievedCount;
            const conversionRate = totalInteractions > 0 ? Math.round((achievedCount / totalInteractions) * 100) : 0;
=======
            companyAnalytics.totalTarget += totalTarget;
            
            const conversionRate = totalLeads > 0 ? Math.round((achievedCount / totalLeads) * 100) : 0;
>>>>>>> c1be5bc (Initial commit from new system)
            const progress = totalTarget > 0 ? Math.min(100, Math.round((achievedCount / totalTarget) * 100)) : 0;

            return {
                id: userIdStr, name: userName, role: user.role, branch: user.branch || "-", 
<<<<<<< HEAD
                target: totalTarget, pendingCount, followUpCount, achievedCount, conversionRate, progress
            };
        });

        roster.sort((a, b) => b.achievedCount - a.achievedCount);
        return NextResponse.json({ success: true, roster });
=======
                target: totalTarget, totalLeads, pendingCount, followUpCount, achievedCount, conversionRate, progress
            };
        });

        return NextResponse.json({ success: true, roster, analytics: companyAnalytics });
>>>>>>> c1be5bc (Initial commit from new system)
    } catch (error) {
        console.error("Roster API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to load roster" }, { status: 500 });
    }
}