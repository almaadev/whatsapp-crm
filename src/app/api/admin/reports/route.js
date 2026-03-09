import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Lead from "@/models/Lead";
import Customer from "@/models/Customer";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await connectDB();
        
        const leads = await Lead.find({}).lean();
        const customers = await Customer.find({}).lean();

        const now = new Date();
        const currentMonth = now.getMonth(); 
        const currentYear = now.getFullYear();
        
        const lastMonthDate = new Date();
        lastMonthDate.setMonth(now.getMonth() - 1);
        const lastMonth = lastMonthDate.getMonth();
        const lastYear = lastMonthDate.getFullYear();

        const currentStats = { totalLeads: 0, pending: 0, followUps: 0, closed: 0, amount: 0 };
        const lastStats = { totalLeads: 0, pending: 0, followUps: 0, closed: 0, amount: 0 };

        // 1. Calculate Stats from Leads Database
        leads.forEach(lead => {
            const leadDate = lead.createdAt ? new Date(lead.createdAt) : new Date();
            const m = leadDate.getMonth();
            const y = leadDate.getFullYear();
            const amount = parseInt(lead.saleAmount || "0");
            const status = lead.status || "New";

            const updateStats = (statsObj) => {
                statsObj.totalLeads++;
                
                if (status === "Closed" || lead.isClosed) {
                    statsObj.closed++;
                    statsObj.amount += amount;
                } else if (status === "Follow Up") {
                    const followUpDate = lead.followUpStart ? new Date(lead.followUpStart) : leadDate;
                    const hoursDiff = (now - followUpDate) / (1000 * 60 * 60);
                    
                    if (hoursDiff > 48) {
                        statsObj.pending++;
                    } else {
                        statsObj.followUps++;
                    }
                } else {
                    statsObj.pending++; // New and Not Interested fall under pending/inactive
                }
            };

            if (m === currentMonth && y === currentYear) {
                updateStats(currentStats);
            } else if (m === lastMonth && y === lastYear) {
                updateStats(lastStats);
            }
        });

        // 2. Prepare Data for CSV Export (Unified list)
        const csvData = leads.map(lead => ({
            name: lead.name,
            phone: lead.phone || lead.customerPhone,
            date: lead.createdAt ? new Date(lead.createdAt).toISOString() : new Date().toISOString(),
            enquiredFor: lead.enquiredFor,
            status: lead.status,
            saleAmount: lead.saleAmount,
            city: lead.city,
            source: lead.source,
            handler: lead.assignedTo
        }));

        // Safety check: add customers without leads to CSV
        const leadPhones = new Set(csvData.map(d => d.phone));
        customers.forEach(c => {
            if (!leadPhones.has(c.phone)) {
                csvData.push({
                    name: c.name,
                    phone: c.phone,
                    date: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
                    enquiredFor: c.latestEnquiry || c.enquiredFor,
                    status: c.status,
                    saleAmount: "0",
                    city: c.city,
                    source: c.source,
                    handler: c.assignedTo
                });
            }
        });

        return NextResponse.json({ 
            success: true, 
            report: { current: currentStats, last: lastStats },
            csvData 
        });

    } catch (error) {
        console.error("Reports API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to load reports" }, { status: 500 });
    }
}