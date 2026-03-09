import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Lead from "@/models/Lead";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await connectDB();
        const users = await User.find({ role: { $ne: 'admin' } }).lean();
        const leads = await Lead.find({}).lean();

        const roster = users.map(user => {
            const userIdStr = user._id.toString();
            // Safety check: Filter by associateId OR their name (for old data support)
            const userLeads = leads.filter(l => l.associateId === userIdStr || l.assignedTo === user.name);

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
                    
                    // Logic: > 48 Hrs Pending, Else current follow up
                    if (hoursDiff > 48) {
                        pendingCount++;
                    } else {
                        followUpCount++;
                    }
                } else if (lead.status === "New") {
                    pendingCount++; // New leads are strictly Pending
                }
            });

            const totalLeads = userLeads.length;
            const conversionRate = totalLeads > 0 ? Math.round((achievedCount / totalLeads) * 100) : 0;
            
            const totalTarget = user.target || 0;
            const progress = totalTarget > 0 ? Math.min(100, Math.round((achievedCount / totalTarget) * 100)) : 0;

            return {
                id: userIdStr,
                name: user.name,
                role: user.role,
                target: totalTarget,
                pendingCount,
                followUpCount,
                achievedCount,
                conversionRate,
                progress
            };
        });

        return NextResponse.json({ success: true, roster });
    } catch (error) {
        console.error("Roster API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to load roster" }, { status: 500 });
    }
}