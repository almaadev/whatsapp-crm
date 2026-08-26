import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import Lead from "@/shared/models/Lead";
import Customer from "@/shared/models/Customer";
import Activity from "@/shared/models/Activity";
import { requireSession } from "@/shared/lib/session";
import mongoose from "mongoose";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";
import { sanitizeCustomerOrLeadData } from "@/shared/utils/privacy";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";
import { resolveLeadStatus } from "@/shared/utils/leadStatusResolver";
import { getActivityTitle, formatActorDisplayName } from "@/shared/utils/activityFormatter";
import { normalizePhone, getPhoneVariations } from "@/shared/utils/phoneUtils";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    await connectDB();

    const resolvedParams = await params;
    const rawPhone = decodeURIComponent(resolvedParams.phone || "");
    const cleanPhone = normalizePhone(rawPhone);
    const variations = getPhoneVariations(cleanPhone);
    const primaryPhone = cleanPhone;

    // Fetch customer record across all phone variations and populate address
    const customer = await Customer.findOne({ phone: { $in: variations } })
      .populate("currentAddressId")
      .populate({
        path: 'createdBy',
        select: 'name preferredName role department branch'
      })
      .lean();

    // Fetch all leads for this customer to retrieve historical activities
    const leads = customer ? await Lead.find({ customerId: customer._id }).sort({ createdAt: 1 }).lean() : [];
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
        creatorUser = await User.findById(customer.createdBy).select("name preferredName role department branch branchId").lean();
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
        name: creatorUser.name || creatorUser.preferredName || "Unknown",
        role: creatorUser.role || "associate",
        department: creatorUser.department || "sales",
        branchId: rawBranch || null,
        branchName: resolvedBranchName || "Unassigned Branch",
        userId: creatorUser._id ? creatorUser._id.toString() : ""
      };
    } else {
      creatorInfo = null;
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
        "NAME_UPDATED",
        "CITY_UPDATED",
        "SOURCE_UPDATED",
        "ENQUIRED_FOR_UPDATED",
        "LEAD_TYPE_UPDATED",
        "BRANCH_UPDATED",
        "OVERALL_REMARKS_UPDATED",
        "FOLLOWUP_REMARK_UPDATED",
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
          select: 'name preferredName role department branch'
        })
        .populate({
          path: 'metadata.targetUser',
          select: 'name preferredName role department branch'
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
        const isWebhookOrAuto = entry.source === "WEBHOOK" || entry.metadata?.source === "WEBHOOK" || entry.metadata?.isAutomatic === true || (!entry.actorId && (!entry.metadata?.performedByName || entry.metadata?.performedByName === "System Admin") && entry.eventType === "LEAD_CREATED");

        let performedByResolved = null;
        if (entry.actorId) {
          const branchVal = entry.actorId.branch?.toString() || "";
          const branchName = branchMap[branchVal] || entry.actorId.branch || "";
          performedByResolved = {
            name: entry.actorId.name || entry.actorId.preferredName || "Unknown",
            role: entry.actorId.role || "associate",
            department: entry.actorId.department || "",
            branchName: branchName
          };
        } else if (!isWebhookOrAuto) {
          performedByResolved = {
            name: entry.metadata?.performedByName || "System Admin",
            role: entry.metadata?.performedByRole || "superAdmin",
            department: entry.metadata?.performedByDept || "admin"
          };
        }

        let targetUserResolved = null;
        if (entry.metadata?.targetUser) {
          const branchVal = entry.metadata.targetUser.branch?.toString() || "";
          const branchName = branchMap[branchVal] || entry.metadata.targetUser.branch || "";
          targetUserResolved = {
            name: entry.metadata.targetUser.name || entry.metadata.targetUser.preferredName || "Unknown",
            role: entry.metadata.targetUser.role || "",
            department: entry.metadata.targetUser.department || "",
            branchName: branchName
          };
        }

        const performedAtVal = entry.createdAt;
        const performedByIdVal = entry.actorId?._id?.toString() || entry.actorId || null;
        const actionName = (isWebhookOrAuto && entry.eventType === "LEAD_CREATED")
          ? "New Lead"
          : (entry.metadata?.action || getActivityTitle(entry.eventType, performedByResolved, entry.metadata || {}));

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
          performedBy: performedByResolved,
          performedByName: performedByResolved?.name || null,
          performedByRole: performedByResolved?.role || null,
          performedByDept: performedByResolved?.department || null,
          performedByLabel: performedByResolved ? formatActorDisplayName(performedByResolved) : null,
          performedById: performedByIdVal,
          targetUser: targetUserResolved,
          metadata: {
            ...entry.metadata,
            action: actionName,
            performedByName: performedByResolved?.name || null,
            performedByRole: performedByResolved?.role || null,
            performedByDept: performedByResolved?.department || null
          },
          timestamp: performedAtVal,
          performedAt: performedAtVal,
          createdAt: entry.createdAt
        };
      });
    }

    const leadCustomerName = customer ? resolveCustomerDisplayName(customer) : (lead?.name || "New Customer");
    const leadCustomerCity = customer?.currentAddressId?.city || customer?.city || lead?.city || "";
    const leadCustomerAddress = customer?.currentAddressId?.address || customer?.address || lead?.address || "";
    const leadCustomerSource = customer?.source || lead?.source || "Manual Entry";
    const leadCustomerEnquiredFor = customer?.enquiredFor || lead?.enquiredFor || "";
    const leadStatusResolved = resolveLeadStatus(lead, latest);

    const formattedResponse = {
      _id: lead?._id?.toString(),
      customerId: customer?._id?.toString(),
      phone: primaryPhone,
      name: leadCustomerName,
      city: leadCustomerCity,
      address: leadCustomerAddress,
      source: leadCustomerSource,
      enquiredFor: leadCustomerEnquiredFor,
      status: leadStatusResolved,
      priority: lead?.priority || "Medium",
      remarks: lead?.remarks || "",
      saleAmount: lead?.saleAmount || "0",
      assignedTo: lead?.assignedTo || customer?.assignedTo || "Unassigned",
      branchId: lead?.branchId?.toString() || customer?.branchId?.toString() || null,
      branchName: branchMap[lead?.branchId?.toString() || customer?.branchId?.toString()] || "Unassigned Branch",
      isClosed: lead?.isClosed || false,
      followUpStartDate: lead?.followUpStartDate || null,
      creatorInfo,
      history: history,
      chatHistory: resolvedChatHistory,
      createdAt: lead?.createdAt ? new Date(lead.createdAt).toISOString() : null,
      updatedAt: lead?.updatedAt ? new Date(lead.updatedAt).toISOString() : null
    };

    const sanitizedResponse = sanitizeCustomerOrLeadData(formattedResponse, session.user);
    return NextResponse.json(sanitizedResponse, { status: 200 });

  } catch (error) {
    console.error("Fetch Lead Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}