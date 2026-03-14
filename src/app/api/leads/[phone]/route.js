// src/app/api/leads/[phone]/route.js
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Lead from "@/models/Lead";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    await connectDB();
    const resolvedParams = await params;
    const phoneDigits = resolvedParams.phone.replace(/\D/g, "");

    // Find all leads with this phone number and sort by newest first
    const leads = await Lead.find({ phone: { $regex: phoneDigits } })
      .sort({ createdAt: -1 })
      .lean();

    if (!leads || leads.length === 0) {
      return NextResponse.json({ success: false, error: "No leads found" }, { status: 404 });
    }

    // Format data so HistoryCard receives day1, day2, day3 remarks
    const formattedLeads = leads.map(lead => ({
      _id: lead._id,
      phone: lead.phone,
      name: lead.name || "Unknown",
      city: lead.city || "",
      address: lead.address || "",
      source: lead.source || "N/A",
      enquiredFor: lead.enquiredFor || "",
      priority: lead.priority || "Medium",
      status: lead.status || "New",
      remarks: lead.remarks || "",
      // MUKKIYAMANA UPDATE: Day remarks-ai fetch pandrom! 👇
      day1Remarks: lead.day1Remarks || "",
      day2Remarks: lead.day2Remarks || "",
      day3Remarks: lead.day3Remarks || "",
      saleAmount: lead.saleAmount || "0",
      assignedTo: lead.assignedTo || "Unassigned",
      isClosed: lead.isClosed || false,
      date: lead.createdAt || new Date() // HistoryCard use pandra date
    }));

    return NextResponse.json({ success: true, leads: formattedLeads });
  } catch (error) {
    console.error("Failed to fetch lead history:", error);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}