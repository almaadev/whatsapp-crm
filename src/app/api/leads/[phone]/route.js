import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import Lead from "@/shared/models/Lead";
import Customer from "@/shared/models/Customer";
import { requireSession } from "@/shared/lib/session";
import mongoose from "mongoose";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    const { error } = await requireSession();
    if (error) return error;

    await connectDB();

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

    const customer = await Customer.findOne({ phone: cleanPhone })
      .populate({
        path: 'createdBy',
        select: 'name role department branch'
      })
      .lean();

    // If neither exists, return an empty object so the frontend doesn't crash
    if (!lead && !customer) {
      return NextResponse.json({}, { status: 200 }); 
    }
    
    // Extract the follow-up history and determine the latest entry
    const history = lead?.leads || [];
    const latest = history.length > 0 ? history[history.length - 1] : null;

    let creatorInfo = null;
    if (customer?.createdBy) {
      const branchVal = customer.createdBy.branch?.toString() || "";
      let branchName = customer.createdBy.branch || "";
      if (mongoose.Types.ObjectId.isValid(branchVal)) {
        const branchObj = await Branch.findById(branchVal).lean();
        if (branchObj) {
          branchName = branchObj.name;
        }
      }
      creatorInfo = {
        name: customer.createdBy.name || "Unknown",
        role: customer.createdBy.role || "",
        department: customer.createdBy.department || "",
        branchName: branchName || ""
      };
    }

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
      history: history,
      latestFollowUp: latest || {},
      creatorInfo
    };

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("Fetch Lead Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead" },
      { status: 500 }
    );
  }
}