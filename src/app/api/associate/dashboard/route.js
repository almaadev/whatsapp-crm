import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Lead from "@/models/Lead";
import User from "@/models/User";
import Customer from "@/models/Customer";

export const dynamic = "force-dynamic";

export async function GET(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();

        // 1. Get Current User (Associate) Details
        const myEmail = session.user.email;
        const me = await User.findOne({ email: myEmail }).lean();
        
        const myId = me ? me._id.toString() : session.user.id;
        const myName = session.user.name;
        const accessModules = session.user.accessModules || [];
        const target = me && me.target ? parseInt(me.target) : 0;
        
        // 2. Parse Date Filters using Strict UTC Normalization
        const { searchParams } = new URL(req.url);
        const now = new Date();
        const monthParam = searchParams.get("month");
        const yearParam = searchParams.get("year");

        const targetMonth = monthParam ? parseInt(monthParam) : now.getUTCMonth() + 1; // 1-12
        const targetYear = yearParam ? parseInt(yearParam) : now.getUTCFullYear();

        // UTC Normalization ensures no timezone shifting drops leads on the 1st/31st of the month
        const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

        // 3. Permission Filter Setup
        const isSuperAdmin = session.user.role === 'superAdmin';
        const isAdminDepartment = session.user.department === 'admin';
        
        let allowedTypes = [];
        if (!isSuperAdmin && !isAdminDepartment) {
            allowedTypes.push("Direct Lead"); 
            if (accessModules.includes("Product Lead")) allowedTypes.push("Product Lead");
            if (accessModules.includes("MD Camp")) allowedTypes.push("MD Camp");
            if (accessModules.includes("Therapy")) allowedTypes.push("Therapy");
        }

        // ============================================================================
        // 4. MONGODB AGGREGATION PIPELINE ($unwind & $group logic)
        // ============================================================================
        
        const baseMatch = {
            $or: [
                { associateId: myId },
                { assignedTo: myName },
                { closedById: myId },
                { "handledByHistory.associateId": myId },
                { "leads.associateId": myId }
            ]
        };

        if (allowedTypes.length > 0) {
            baseMatch["leads.leadType"] = { $in: allowedTypes };
        }

        // TEMPORARY DEBUG LOGS
        const rawLeadsCount = await Lead.countDocuments(baseMatch);


        const pipeline = [
            { $match: baseMatch },
            
            // Extract analytical data before unwinding
            {
                $addFields: {
                    firstFollowUp: { $arrayElemAt: ["$leads", 0] },
                    latestFollowUp: { $arrayElemAt: ["$leads", -1] },
                    followUpCount: { $size: { $ifNull: ["$leads", []] } }
                }
            },
            
            // Unwind to inspect individual dates
            { 
                $unwind: { 
                    path: "$leads", 
                    preserveNullAndEmptyArrays: true 
                } 
            },
            
            // Match any document that had activity (created, followed-up, or closed) this month
            {
                $match: {
                    $or: [
                        { createdAt: { $gte: startDate, $lte: endDate } },
                        { "leads.date": { $gte: startDate, $lte: endDate } },
                        { "firstFollowUp.date": { $gte: startDate, $lte: endDate } },
                        { closedAt: { $gte: startDate, $lte: endDate } }
                    ]
                }
            },

            // Group back by phone to rebuild the lead
            {
                $group: {
                    _id: "$_id",
                    phone: { $first: "$phone" },
                    name: { $first: "$name" },
                    city: { $first: "$city" },
                    source: { $first: "$source" },
                    isClosed: { $first: "$isClosed" },
                    closedBy: { $first: "$closedBy" },
                    closedById: { $first: "$closedById" },
                    closedAt: { $first: "$closedAt" },
                    createdAt: { $first: "$createdAt" },
                    followUpCount: { $first: "$followUpCount" },
                    firstFollowUp: { $first: "$firstFollowUp" },
                    latestFollowUp: { $first: "$latestFollowUp" },
                    
                    // Push ONLY the follow-ups that occurred in the requested month
                    monthFollowUps: { 
                        $push: {
                            $cond: [
                                { $and: [
                                    { $gte: ["$leads.date", startDate] },
                                    { $lte: ["$leads.date", endDate] }
                                ]},
                                "$leads",
                                "$$REMOVE"
                            ]
                        } 
                    }
                }
            }
        ];

        const aggregatedLeads = await Lead.aggregate(pipeline);
        console.log("After Filter (Post-Aggregation):", aggregatedLeads.length);

        // ============================================================================
        // 5. METRIC CALCULATION & CUSTOMER MAPPING
        // ============================================================================
        
        let pendingCount = 0;
        let followUpCount = 0;
        let totalThisMonth = 0;
        let closedThisMonthCount = 0;

        const phoneList = aggregatedLeads.map(l => l.phone);
        const customers = await Customer.find({ phone: { $in: phoneList } }).select("phone name").lean();

        const formattedLeads = aggregatedLeads.map(lead => {
            const custData = customers.find(c => c.phone === lead.phone) || {};
            
            const finalName = custData.name && custData.name !== "Unknown" 
                ? custData.name 
                : (lead.name && lead.name !== "Unknown" ? lead.name : lead.phone.replace("whatsapp:", ""));

            // 1. This Month Leads → count leads where firstFollowUp.date is within selected month
            const firstDate = new Date(lead.firstFollowUp?.date || lead.createdAt);
            if (firstDate >= startDate && firstDate <= endDate) {
                totalThisMonth++;
            }

            // 2. Monthly Goal → count leads closed in that month AND closedBy = current user
            if (lead.isClosed && lead.closedById === myId && lead.closedAt) {
                const closedDate = new Date(lead.closedAt);
                if (closedDate >= startDate && closedDate <= endDate) {
                    closedThisMonthCount++;
                }
            }

            // 3. Pending Actions → latest follow-up belongs to logged-in user AND status = "Follow Up" AND date > 48 hours
            const latest = lead.latestFollowUp || {};
            if (latest.status === "Follow Up" && latest.associateId === myId) {
                const hoursDiff = (Date.now() - new Date(latest.date).getTime()) / (1000 * 60 * 60);
                if (hoursDiff > 48) {
                    pendingCount++; 
                }
            }

            // 4. Your Follow Ups → count unique leads where ANY follow-up in that month has associateId = current user
            const didUserFollowUpThisMonth = lead.monthFollowUps.some(fu => fu.associateId === myId);
            if (didUserFollowUpThisMonth) {
                followUpCount++;
            }

            let displayStatus = latest.status || "New";
            if (lead.isClosed) {
                displayStatus = lead.closedBy === myName ? "Closed" : `Closed by ${lead.closedBy}`;
            }

            let categoryParam = null;
            if (latest.leadType === "Product Lead") categoryParam = "product";
            else if (latest.leadType === "MD Camp") categoryParam = "mdcamp";
            else if (latest.leadType === "Therapy") categoryParam = "therapy";

            return {
                phone: lead.phone,
                name: finalName,
                status: displayStatus, // UI mapped display string
                isClosed: lead.isClosed || false,
                categoryParam,
                timeSort: new Date(latest.date || lead.createdAt).getTime(),
                
                // Explicit new schema payload for frontend
                firstFollowUp: lead.firstFollowUp || {},
                latestFollowUp: latest,
                
                firstFollowUpUser: lead.firstFollowUp?.associateName || "Unknown",
                currentHandler: latest.associateName || "Unassigned",
                closedBy: lead.closedBy || null,
                followUpCount: lead.followUpCount || 0,
            };
        });

        formattedLeads.sort((a, b) => b.timeSort - a.timeSort);

        return NextResponse.json({
            stats: {
                target,
                achieved: closedThisMonthCount, 
                pending: pendingCount,
                followUp: followUpCount,
                total: totalThisMonth
            },
            leads: formattedLeads
        });

    } catch (error) {
        console.error("Dashboard API Error:", error);
        return NextResponse.json({ error: "Server Error", details: error.message }, { status: 500 });
    }
}