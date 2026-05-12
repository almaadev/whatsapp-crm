<<<<<<< HEAD
// src/app/api/leads/[phone]/route.js
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Lead from "@/models/Lead";
=======
import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Lead from "@/models/Lead";
import Customer from "@/models/Customer";
>>>>>>> c1be5bc (Initial commit from new system)

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    await connectDB();
<<<<<<< HEAD
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
=======

    const resolvedParams = await params;
    
    // Normalise the phone param – the UI strips "whatsapp:" before encoding
    const rawPhone = decodeURIComponent(resolvedParams.phone || "");
    const cleanPhone = rawPhone.startsWith("whatsapp:")
      ? rawPhone
      : `whatsapp:${rawPhone}`;

    // Fetch documents strictly using .lean() for performance.
    // Removed .sort() as it has no effect on findOne().
    const lead = await Lead.findOne({
      $or: [{ phone: cleanPhone }, { customerPhone: cleanPhone }],
    }).lean();

    const customer = await Customer.findOne({ phone: cleanPhone }).lean();

    // If neither exists, return an empty object so the frontend doesn't crash
    if (!lead && !customer) {
      return NextResponse.json({}, { status: 200 }); 
    }
    
    // Extract the follow-up history and determine the latest entry
    const history = lead?.leads || [];
    const latest = history.length > 0 ? history[history.length - 1] : null;

    // Construct the schema-aligned response
    const data = {
      // --- Static Root Metadata ---
      name: lead?.name || customer?.name || "",
      city: lead?.city || customer?.city || "",
      phone: lead?.phone || cleanPhone,
      address: lead?.address || customer?.address || "",
      source: lead?.source || customer?.source || "Whatsapp",
      assignedTo: lead?.assignedTo || customer?.assignedTo || "Unassigned",

      // --- Dynamic Follow-up Data (Derived purely from latest entry) ---
      enquiredFor: latest?.enquiredFor || customer?.enquiredFor || "",
      status: latest?.status || "",
      priority: latest?.priority || "Medium",
      remarks: latest?.overAllRemarks || "",
      day1Remarks: latest?.day1Remarks || "",
      day2Remarks: latest?.day2Remarks || "",
      day3Remarks: latest?.day3Remarks || "",
      saleAmount: latest?.saleAmount || "0",
      leadType: latest?.leadType || "Direct Lead",

      // --- Arrays & Objects ---
      history: history,
      latestFollowUp: latest || {}
    };

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Fetch Lead Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead" },
      { status: 500 }
    );
>>>>>>> c1be5bc (Initial commit from new system)
  }
}