import { NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import Lead from "@/models/Lead";
import Customer from "@/models/Customer";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { error } = await requireAdmin();
        if (error) return error;

        await connectDB();
        
        // Single unified fetch
        const [allLeads, customers] = await Promise.all([
            Lead.find({}).lean(),
            Customer.find({}).lean()
        ]);

        const now = new Date();
        const currentMonth = now.getMonth(); 
        const currentYear = now.getFullYear();
        
        const lastMonthDate = new Date();
        lastMonthDate.setMonth(now.getMonth() - 1);
        const lastMonth = lastMonthDate.getMonth();
        const lastYear = lastMonthDate.getFullYear();

        const currentStats = { totalLeads: 0, pending: 0, followUps: 0, closed: 0, amount: 0 };
        const lastStats = { totalLeads: 0, pending: 0, followUps: 0, closed: 0, amount: 0 };

        allLeads.forEach(lead => {
            const leadDate = lead.createdAt ? new Date(lead.createdAt) : (lead.date ? new Date(lead.date) : new Date());
            const m = leadDate.getMonth();
            const y = leadDate.getFullYear();
            const parsedAmount = parseInt(lead.saleAmount || "0");
            const amount = isNaN(parsedAmount) ? 0 : parsedAmount;
            const status = lead.status || "New";

            const updateStats = (statsObj) => {
                statsObj.totalLeads++;
                
                if (status === "Closed" || lead.isClosed) {
                    statsObj.closed++;
                    statsObj.amount += amount;
                } else if (status === "Follow Up") {
                    const followUpDate = lead.followUpStart ? new Date(lead.followUpStart) : leadDate;
                    const hoursDiff = (now - followUpDate) / (1000 * 60 * 60);
                    if (hoursDiff > 48) statsObj.pending++; else statsObj.followUps++;
                } else {
                    statsObj.pending++; 
                }
            };

            if (m === currentMonth && y === currentYear) updateStats(currentStats);
            else if (m === lastMonth && y === lastYear) updateStats(lastStats);
        });

        const csvData = allLeads.map(lead => ({
            name: lead.name || "Unknown",
            phone: lead.phone || lead.customerPhone || "",
            date: lead.createdAt ? new Date(lead.createdAt).toISOString() : new Date().toISOString(),
            enquiredFor: lead.enquiredFor || lead.lastKeyword || "-",
            status: lead.status || "New",
            saleAmount: lead.saleAmount || "0",
            city: lead.city || "-",
            source: lead.source || "Whatsapp",
            associate: lead.assignedTo || lead.associate || "unassigned",
            leadType: lead.leadType || "Direct Lead" // Native field from schema
        }));

        const leadPhones = new Set(csvData.map(d => d.phone));
        customers.forEach(c => {
            if (!leadPhones.has(c.phone)) {
                csvData.push({
                    name: c.name || "Unknown", phone: c.phone || "",
                    date: c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString(),
                    enquiredFor: c.latestEnquiry || c.enquiredFor || "-",
                    status: c.status || "New", saleAmount: "0", city: c.city || "-",
                    source: c.source || "Whatsapp", associate: c.assignedTo || "unassigned",
                    leadType: "Customer Only"
                });
            }
        });

        csvData.sort((a, b) => new Date(b.date) - new Date(a.date));

        return NextResponse.json({ success: true, report: { current: currentStats, last: lastStats }, csvData });

    } catch (error) {
        console.error("Reports API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to load reports" }, { status: 500 });
    }
}