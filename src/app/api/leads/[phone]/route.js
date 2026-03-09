import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Lead from "@/models/Lead";

export async function GET(req, { params }) {
  try {
    await connectDB();
    
    const resolvedParams = await params;
    let phone = decodeURIComponent(resolvedParams.phone);
    
    if (!phone.startsWith("whatsapp:")) {
        phone = `whatsapp:${phone}`;
    }

    // Fetch leads checking BOTH the old and new variable names
    const leads = await Lead.find({ 
        $or: [ { phone: phone }, { customerPhone: phone } ] 
    }).sort({ createdAt: -1 });
    
    return NextResponse.json({ success: true, leads });
  } catch (error) {
    console.error("Fetch Leads API Error:", error);
    return NextResponse.json({ error: "Failed to fetch leads history", details: error.message }, { status: 500 });
  }
}