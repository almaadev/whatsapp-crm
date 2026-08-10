import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import Lead from "@/shared/models/Lead";
import Customer from "@/shared/models/Customer";
import CustomerAddress from "@/shared/models/CustomerAddress";
import Activity from "@/shared/models/Activity";
import { requireSession } from "@/shared/lib/session";
import mongoose from "mongoose";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";
import { sanitizeCustomerOrLeadData } from "@/shared/utils/privacy";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";

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

    // Fetch customer record across all phone variations and populate address
    const customer = await Customer.findOne({ phone: { $in: variations } })
      .populate("currentAddressId")
      .populate({
        path: 'createdBy',
        select: 'name role department branch'
      })
      .lean();

    // Fetch all leads for this customer to retrieve historical activities
    const leads = customer ? await Lead.find({ customerId: customer._id }).lean() : [];
    const leadIds = leads.map(l => l._id);
    const lead = leads.find(l => !l.isClosed) || leads[leads.length - 1] || null;

    if (!lead && !customer) {
      return NextResponse.json({}, { status: 200 }); 
    }
    
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

      creatorInfo = {
        name: creatorUser.name || "Unknown",
        role: creatorUser.role || "associate",
        department: creatorUser.department || "sales",
        branchId: rawBranch || null,
        branchName: resolvedBranchName || "Unassigned Branch",
        userId: creatorUser._id ? creatorUser._id.toString() : ""
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
    // Load timeline activities dynamically from Activity collection
    let resolvedChatHistory = [];
    if (customer) {
      const TIMELINE_EVENTS = [
        "CUSTOMER_CREATED",
        "LEAD_CREATED",
        "CHAT_STARTED",
        "CHAT_CLOSED",
        "CHAT_REOPENED",
        "LEAD_ASSIGNED",
        "CUSTOMER_ASSIGNED",
        "FOLLOWUP_CREATED",
        "FOLLOWUP_COMPLETED",
        "LEAD_STATUS_CHANGED",
        "CUSTOMER_UPDATED",
        "PROFILE_UPDATED",
        "ADDRESS_UPDATED",
        "ADDRESS_CHANGED",
        "TEMPLATE_SENT"
      ];

      const query = {
        $or: [
          { customerId: customer._id },
          { leadId: { $in: leadIds } }
        ],
        eventType: { $in: TIMELINE_EVENTS }
      };

      const rawActivities = await Activity.find(query)
        .populate({
          path: 'actorId',
          select: 'name role department branch'
        })
        .populate({
          path: 'metadata.targetUser',
          select: 'name role department branch'
        })
        .sort({ createdAt: 1 })
        .lean();

      // Deduplicate activities by _id
      const uniqueActivities = Array.from(
        new Map(
          rawActivities.map(activity => [activity._id.toString(), activity])
        ).values()
      );

      resolvedChatHistory = uniqueActivities.map(entry => {
        let performedByResolved = null;
        if (entry.actorId) {
          const branchVal = entry.actorId.branch?.toString() || "";
          const branchName = branchMap[branchVal] || entry.actorId.branch || "";
          performedByResolved = {
            name: entry.actorId.name || "Unknown",
            role: entry.actorId.role || "",
            department: entry.actorId.department || "",
            branchName: branchName
          };
        }
        let targetUserResolved = null;
        if (entry.metadata?.targetUser) {
          const branchVal = entry.metadata.targetUser.branch?.toString() || "";
          const branchName = branchMap[branchVal] || entry.metadata.targetUser.branch || "";
          targetUserResolved = {
            name: entry.metadata.targetUser.name || "Unknown",
            role: entry.metadata.targetUser.role || "",
            department: entry.metadata.targetUser.department || "",
            branchName: branchName
          };
        }
        const performedAtVal = entry.createdAt;
        const performedByIdVal = entry.actorId?._id?.toString() || entry.actorId || null;
        const performedByRoleVal = entry.metadata?.performedByRole || performedByResolved?.role || "";
        const actionName = entry.metadata?.action || (entry.eventType === "ADDRESS_CHANGED" ? "Address Changed" : entry.eventType === "ASSIGNED" ? "Assigned" : "System Action");

        return {
          ...entry,
          _id: entry._id?.toString(),
          action: actionName,
          eventType: entry.eventType,
          entityType: entry.entityType || "General",
          entityId: entry.entityId?.toString() || null,
          customerId: entry.customerId?.toString() || null,
          leadId: entry.leadId?.toString() || null,
          conversationId: entry.conversationId || entry.leadId?.toString() || null,
          actorId: performedByIdVal,
          performedBy: performedByResolved || entry.metadata?.performedByName || "System Admin",
          performedByRole: performedByRoleVal,
          performedById: performedByIdVal,
          targetUser: targetUserResolved,
          metadata: entry.metadata || {},
          timestamp: performedAtVal,
          performedAt: performedAtVal,
          createdAt: entry.createdAt
        };
      });
    }

    const userRole = session?.user?.role || "associate";
    const filteredChatHistory = resolvedChatHistory.filter(entry => {
      if (entry.isInternal) {
        return userRole === "superAdmin";
      }
      return true;
    });

    const data = {
      name: resolveCustomerDisplayName({ lead, customer, phone: primaryPhone }),
      city: customer?.currentAddressId?.city || customer?.city || "",
      phone: customer?.phone || primaryPhone,
      address: customer?.currentAddressId?.address || customer?.address || "",
      source: customer?.source || "Whatsapp",
      assignedTo: customer?.assignedTo || "Unassigned",
      branchId: customer?.branchId?._id?.toString() || customer?.branchId?.toString() || null,
      enquiredFor: latest?.enquiredFor || customer?.enquiredFor || "",
      status: latest?.status || customer?.status || "New",
      priority: latest?.priority || customer?.priority || "Medium",
      remarks: latest?.overAllRemarks || customer?.remarks || "",
      day1Remarks: latest?.day1Remarks || "",
      day2Remarks: latest?.day2Remarks || "",
      day3Remarks: latest?.day3Remarks || "",
      saleAmount: latest?.saleAmount || customer?.saleAmount || "0",
      leadType: latest?.leadType || customer?.activeRouteCategory || "Direct Lead",
      history: history,
      latestFollowUp: latest || {},
      creatorInfo,
      chatHistory: filteredChatHistory
    };

    const sanitizedData = sanitizeCustomerOrLeadData(data, session.user);
    return NextResponse.json(sanitizedData, { status: 200 });
  } catch (error) {
    console.error("Fetch Lead Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead" },
      { status: 500 }
    );
  }
}