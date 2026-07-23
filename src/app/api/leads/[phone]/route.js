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
    const { session, error } = await requireSession();
    if (error) return error;

    await connectDB();

    const resolvedParams = await params;
    
    const rawPhone = decodeURIComponent(resolvedParams.phone || "");
    const cleanDigits = rawPhone.replace(/\D/g, "");

    const variations = [
      rawPhone,
      `whatsapp:${rawPhone}`,
      cleanDigits,
      `whatsapp:${cleanDigits}`,
      `whatsapp:+${cleanDigits}`,
      `+${cleanDigits}`,
    ];

    if (cleanDigits.startsWith("91") && cleanDigits.length === 12) {
      const tenDigit = cleanDigits.substring(2);
      variations.push(tenDigit);
      variations.push(`whatsapp:${tenDigit}`);
      variations.push(`whatsapp:+91${tenDigit}`);
      variations.push(`+91${tenDigit}`);
    } else if (cleanDigits.length === 10) {
      variations.push(`91${cleanDigits}`);
      variations.push(`whatsapp:91${cleanDigits}`);
      variations.push(`whatsapp:+91${cleanDigits}`);
      variations.push(`+91${cleanDigits}`);
    }

    const primaryPhone = variations[0]?.startsWith("whatsapp:") ? variations[0] : `whatsapp:${cleanDigits || rawPhone}`;

    // Fetch customer record across all phone variations
    const customer = await Customer.findOne({ phone: { $in: variations } })
      .populate({
        path: 'createdBy',
        select: 'name role department branch'
      })
      .populate({
        path: 'chatHistory.performedBy',
        select: 'name role department branch'
      })
      .populate({
        path: 'chatHistory.targetUser',
        select: 'name role department branch'
      })
      .lean();

    const lead = await Lead.findOne({
      $or: [
        { phone: { $in: variations } },
        { customerPhone: { $in: variations } }
      ],
    }).lean();

    // If neither exists, return an empty object so the frontend doesn't crash
    if (!lead && !customer) {
      return NextResponse.json({}, { status: 200 }); 
    }
    
    // Extract the follow-up history and determine the latest entry
    const history = lead?.leads || [];
    const latest = history.length > 0 ? history[history.length - 1] : null;

    const branches = await Branch.find().lean();
    const branchMap = {};
    branches.forEach(b => {
      branchMap[b._id.toString()] = b.name;
    });

    let creatorUser = null;
    if (customer?.createdBy) {
      if (typeof customer.createdBy === "object" && customer.createdBy.name) {
        creatorUser = customer.createdBy;
      } else {
        creatorUser = await User.findById(customer.createdBy).select("name role department branch branchId").lean();
      }
    }

    if (!creatorUser && lead?.createdBy) {
      if (typeof lead.createdBy === "object" && lead.createdBy.name) {
        creatorUser = lead.createdBy;
      } else {
        creatorUser = await User.findById(lead.createdBy).select("name role department branch branchId").lean();
      }
    }

    let creatorInfo = null;
    if (creatorUser) {
      const rawBranch = creatorUser.branch?._id?.toString()
        || creatorUser.branch?.toString()
        || creatorUser.branchId?.toString()
        || (typeof creatorUser.branch === "string" ? creatorUser.branch : "");

      let resolvedBranchName = branchMap[rawBranch] || (creatorUser.branch?.name ? creatorUser.branch.name : "");

      if (!resolvedBranchName && rawBranch && mongoose.Types.ObjectId.isValid(rawBranch)) {
        const bDoc = await Branch.findById(rawBranch).lean();
        if (bDoc) resolvedBranchName = bDoc.name;
      }

      if (!resolvedBranchName && rawBranch && !mongoose.Types.ObjectId.isValid(rawBranch)) {
        resolvedBranchName = rawBranch;
      }

      creatorInfo = {
        name: creatorUser.name || "Unknown",
        role: creatorUser.role || "associate",
        department: creatorUser.department || "sales",
        branchId: rawBranch || null,
        branchName: resolvedBranchName || "Unassigned Branch"
      };
    } else {
      creatorInfo = {
        name: "System Admin",
        role: "superAdmin",
        department: "admin",
        branchId: null,
        branchName: "Unassigned Branch"
      };
    }

    const resolvedChatHistory = (customer?.chatHistory || []).map(entry => {
      let performedByResolved = null;
      if (entry.performedBy) {
        const branchVal = entry.performedBy.branch?.toString() || "";
        const branchName = branchMap[branchVal] || entry.performedBy.branch || "";
        performedByResolved = {
          name: entry.performedBy.name || "Unknown",
          role: entry.performedBy.role || "",
          department: entry.performedBy.department || "",
          branchName: branchName
        };
      }
      let targetUserResolved = null;
      if (entry.targetUser) {
        const branchVal = entry.targetUser.branch?.toString() || "";
        const branchName = branchMap[branchVal] || entry.targetUser.branch || "";
        targetUserResolved = {
          name: entry.targetUser.name || "Unknown",
          role: entry.targetUser.role || "",
          department: entry.targetUser.department || "",
          branchName: branchName
        };
      }
      const performedAtVal = entry.performedAt || entry.timestamp || new Date();
      const performedByIdVal = entry.performedById || (entry.performedBy?._id ? entry.performedBy._id.toString() : (typeof entry.performedBy === "string" ? entry.performedBy : null));
      const performedByRoleVal = entry.performedByRole || performedByResolved?.role || "";

      return {
        _id: entry._id?.toString(),
        action: entry.action || "System Action",
        eventType: entry.eventType || (entry.action === "Branch Reassigned" ? "Chat Branch Reassigned" : entry.action) || "System Action",
        timestamp: performedAtVal,
        performedAt: performedAtVal,
        notes: entry.notes || "",
        isInternal: entry.isInternal || false,
        performedBy: performedByResolved || entry.performedByName || (typeof entry.performedBy === "string" ? entry.performedBy : "System Admin"),
        performedByRole: performedByRoleVal,
        performedById: performedByIdVal,
        targetUser: targetUserResolved
      };
    });

    const userRole = session?.user?.role || "associate";
    const filteredChatHistory = resolvedChatHistory.filter(entry => {
      if (entry.isInternal) {
        return userRole === "superAdmin";
      }
      return true;
    });

    // Construct the schema-aligned response
    const data = {
      // --- Static Root Metadata ---
      name: lead?.name || customer?.name || "",
      city: lead?.city || customer?.city || "",
      phone: lead?.phone || customer?.phone || primaryPhone,
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
      creatorInfo,
      chatHistory: filteredChatHistory
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