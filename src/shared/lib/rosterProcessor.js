import Lead from "@/shared/models/Lead";

export async function processRosterMetrics(users, startDate, endDate) {
    // Fetch all active leads for the given timeframe (using indexes for speed)
    const activeLeads = await Lead.find({
        $or: [
            { createdAt: { $gte: startDate, $lte: endDate } },
            { "leads.date": { $gte: startDate, $lte: endDate } },
            { closedAt: { $gte: startDate, $lte: endDate } }
        ]
    }).lean();

    let companyAnalytics = { totalLeads: 0, totalPending: 0, totalFollowUp: 0, totalAchieved: 0, totalTarget: 0 };

    const roster = users.map(user => {
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

            // B. Achieved (Closed this month) - NEW LOGIC 🚀
            // Iterate through every single follow-up to catch multiple closures for the same lead
            history.forEach(followUp => {
                if (followUp.status === "Closed") {
                    const closedDate = new Date(followUp.date);
                    
                    // Check if this specific closure happened within the selected month & year
                    if (closedDate >= startDate && closedDate <= endDate) {
                        const handler = followUp.associateId || followUp.associateName;
                        
                        // Check if the current associate is the one who closed this specific follow-up
                        if (handler === userIdStr || handler === userName) {
                            achievedCount++;
                            companyAnalytics.totalAchieved++;
                        }
                    }
                }
            });

            // C. Active Pipeline (Pending vs Follow Up)
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

        return {
            id: userIdStr, name: userName, role: user.role, branch: user.branch || "-", department: user.department || "-",
            target: totalTarget, totalLeads, pendingCount, followUpCount, achievedCount, conversionRate, progress
        };
    });

    return { roster, companyAnalytics };
}