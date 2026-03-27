import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Lead from "@/models/Lead";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await connectDB();
        
        const session = await getServerSession(authOptions);
        const isSuperAdmin = session?.user?.role === 'superAdmin';
        const currentUserEmail = session?.user?.email;

        const allUsers = await User.find({ role: { $ne: 'superAdmin' } }).lean();

        let filteredUsers = allUsers;
        if (!isSuperAdmin) {
            filteredUsers = allUsers.filter(u => 
                (u.isAdmin !== true && u.department !== 'admin') || u.email === currentUserEmail
            );
        }

        // ONE SINGLE FETCH NOW!
        const allLeads = await Lead.find({}).lean();

        const roster = filteredUsers.map(user => {
            const userIdStr = user._id.toString();
            const userName = user.name;

            // Filter for current user
            const userLeads = allLeads.filter(l => l.associateId === userIdStr || l.assignedTo === userName || l.associate === userName);

            let pendingCount = 0;
            let followUpCount = 0;
            let achievedCount = 0;

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
                }
            });

            const totalTarget = user.target || 0;
            const totalInteractions = pendingCount + followUpCount + achievedCount;
            const conversionRate = totalInteractions > 0 ? Math.round((achievedCount / totalInteractions) * 100) : 0;
            const progress = totalTarget > 0 ? Math.min(100, Math.round((achievedCount / totalTarget) * 100)) : 0;

            return {
                id: userIdStr, name: userName, role: user.role, branch: user.branch || "-", 
                target: totalTarget, pendingCount, followUpCount, achievedCount, conversionRate, progress
            };
        });

        roster.sort((a, b) => b.achievedCount - a.achievedCount);
        return NextResponse.json({ success: true, roster });
    } catch (error) {
        console.error("Roster API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to load roster" }, { status: 500 });
    }
}