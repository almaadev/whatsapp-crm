import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Lead from "@/shared/models/Lead";
import User from "@/shared/models/User";
import redis from "@/shared/lib/db/redis";
import { getUserNameById } from "@/shared/utils/userUtils";
import { sanitizeCustomerOrLeadData } from "@/shared/utils/privacy";

export const dynamic = "force-dynamic";

function normalisePhone(raw = "") {
  let p = raw.toString().trim();
  if (!p.startsWith("whatsapp:")) p = `whatsapp:${p}`;
  return p;
}

function rootLeadFields(body, resolvedName, resolvedCity, resolvedAddress, currentUser, associateId) {
  const isClosed = body.status === "Closed" || body.status === "Not Interested";
  
  const fields = {
    name: resolvedName,
    city: resolvedCity,
    address: resolvedAddress,
    source: body.source || "Whatsapp",
    assignedTo: currentUser,
    associateId,
    isClosed
  };

  if (isClosed) {
    fields.closedBy = currentUser;
    fields.closedById = associateId;
    fields.closedAt = new Date();
  } else {
    fields.closedBy = null;
    fields.closedById = null;
    fields.closedAt = null;
  }

  return fields;
}

const buildFollowUp = async (body, session) => {
    const associateId = body.associateId || session.user.id;
    const resolvedAssociateName = await getUserNameById(associateId, session.user.name);

    return {
        date: body.date ? new Date(body.date) : new Date(),
        leadType: body.leadType || "Direct Lead",
        status: body.status || "New",
        priority: body.priority || "Medium",
        source: body.source || "Manual Entry",
        enquiredFor: body.enquiredFor || "",
        overAllRemarks: body.overAllRemarks || "",
        saleAmount: body.saleAmount || 0,
        associateId: associateId,
        associateName: resolvedAssociateName, 
    };
};

function mergeFollowUp(existing, body) {
  if (body.enquiredFor !== undefined) existing.enquiredFor = body.enquiredFor;
  if (body.priority !== undefined) existing.priority = body.priority;
  if (body.status !== undefined) existing.status = body.status;
  if (body.overAllRemarks !== undefined) existing.overAllRemarks = body.overAllRemarks;
  if (body.day1Remarks !== undefined) existing.day1Remarks = body.day1Remarks;
  if (body.day2Remarks !== undefined) existing.day2Remarks = body.day2Remarks;
  if (body.day3Remarks !== undefined) existing.day3Remarks = body.day3Remarks;
  if (body.saleAmount !== undefined) existing.saleAmount = body.saleAmount;
  if (body.leadType !== undefined) existing.leadType = body.leadType;
  if (body.note !== undefined) existing.note = body.note;
  if (body.nextFollowUp !== undefined) existing.nextFollowUp = new Date(body.nextFollowUp);
}

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/leads
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const params = Object.fromEntries(new URL(req.url).searchParams);
    
    // Lazy load the service to prevent import cycles if any
    const { leadQueryService } = await import("@/features/leads/services/leadQueryService");
    const result = await leadQueryService.getLeads(params, session);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/leads]", error);
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/leads  
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Missing session" }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();
    
    
    const mobileRaw = body.phone || body.mobile;
    if (!mobileRaw) {
      return NextResponse.json({ error: "Validation Error: Mobile number is required" }, { status: 400 });
    }

    const validLeadTypes = ["Direct Lead", "MD Camp", "Product Lead", "Therapy"];
    if (body.leadType && !validLeadTypes.includes(body.leadType)) {
      return NextResponse.json({ 
        error: `Validation Error: Invalid leadType. Must be one of: ${validLeadTypes.join(", ")}` 
      }, { status: 400 });
    }

    const cleanPhone = normalisePhone(mobileRaw);
    const currentUser = session.user.id ? await getUserNameById(session.user.id, session.user.name) : "Unknown";
    const userDoc = await User.findOne({ name: currentUser }).lean();
    const associateId = userDoc ? userDoc._id.toString() : session.user.id;

    // 🛑 1. FETCH EXISTING LEAD FIRST TO APPLY "CLOSED" RULE
    const existingLead = await Lead.findOne({ phone: cleanPhone });
    let wasAlreadyClosed = false;

    if (existingLead && existingLead.leads?.length > 0) {
      const latestStatus = existingLead.leads[existingLead.leads.length - 1].status;
      if (latestStatus === "Closed") {
        wasAlreadyClosed = true;
        body.status = "Closed"; // Intercept: Force status to remain "Closed"
      }
    }

    // Fetch existing customer to resolve missing fields
    const existingCustomer = await Customer.findOne({ phone: cleanPhone }).lean();
    
    const resolvedName = (body.name?.trim())
      || (existingCustomer?.name && existingCustomer.name !== "Unknown" ? existingCustomer.name : "")
      || "Unknown";
    const resolvedCity = body.city?.trim() || existingCustomer?.city || "";
    const resolvedAddress = body.address?.trim() || existingCustomer?.address || "";
    const resolvedStatus = body.status || "New"; // Safely defaults back to Closed if intercepted
    const resolvedPriority = body.priority || "Medium";
    
    let resolvedBranchId = existingCustomer?.branchId || null;
    let resolvedBranchName = "Unassigned Branch";
    let resolvedBranchCode = "";

    if (body.branchId !== undefined) {
      if (body.branchId) {
        const Branch = (await import("@/shared/models/Branch")).default;
        const branchDoc = await Branch.findOne({ _id: body.branchId, status: "active" }).lean();
        if (!branchDoc) {
          return NextResponse.json({ error: "Invalid or inactive branch selected." }, { status: 400 });
        }
        resolvedBranchId = body.branchId;
        resolvedBranchName = branchDoc.name;
        resolvedBranchCode = branchDoc.code || "";
      } else {
        resolvedBranchId = null;
      }
    }

    const customerSetPayload = {
      name: resolvedName,
      city: resolvedCity,
      address: resolvedAddress,
      status: resolvedStatus,
      priority: resolvedPriority,
      assignedTo: currentUser,
    };
    if (body.branchId !== undefined) {
      customerSetPayload.branchId = resolvedBranchId;
    }
    
    const customerUpdate = {
      $set: customerSetPayload
    };

    if (existingCustomer) {
      const historyEntries = [];

      // 1. Status Changed
      if (existingCustomer.status !== resolvedStatus) {
        let leadEventType = "lead_new";
        if (resolvedStatus === "Follow Up") leadEventType = "lead_followup";
        else if (resolvedStatus === "Closed") leadEventType = "lead_closed";
        else if (resolvedStatus === "Not Interested") leadEventType = "lead_not_interested";

        historyEntries.push({
          action: resolvedStatus,
          eventType: leadEventType,
          performedBy: session.user.id,
          performedById: session.user.id,
          performedByName: session.user.name || "User",
          performedByRole: session.user.role || "associate",
          performedAt: new Date(),
          timestamp: new Date(),
          notes: body.overAllRemarks || `Status changed to ${resolvedStatus}`
        });
      }

      // 2. Priority Changed
      if (existingCustomer.priority !== resolvedPriority) {
        historyEntries.push({
          action: "Priority Changed",
          eventType: "lead_priority_changed",
          performedBy: session.user.id,
          performedById: session.user.id,
          performedByName: session.user.name || "User",
          performedByRole: session.user.role || "associate",
          performedAt: new Date(),
          timestamp: new Date(),
          notes: `${existingCustomer.priority || "Medium"} → ${resolvedPriority}`
        });
      }

      // 3. Branch Changed
      if (body.branchId !== undefined && existingCustomer.branchId?.toString() !== resolvedBranchId?.toString()) {
        historyEntries.push({
          action: "Assigned Branch Changed",
          eventType: "lead_branch_changed",
          performedBy: session.user.id,
          performedById: session.user.id,
          performedByName: session.user.name || "User",
          performedByRole: session.user.role || "associate",
          performedAt: new Date(),
          timestamp: new Date(),
          notes: resolvedBranchId ? `Branch updated to ${resolvedBranchName}` : "Branch unassigned"
        });
      }

      // 4. Assigned Associate Changed
      if (existingCustomer.assignedTo && existingCustomer.assignedTo !== currentUser) {
        historyEntries.push({
          action: "Assigned Associate Changed",
          eventType: "lead_assigned",
          performedBy: session.user.id,
          performedById: session.user.id,
          performedByName: session.user.name || "User",
          performedByRole: session.user.role || "associate",
          performedAt: new Date(),
          timestamp: new Date(),
          notes: `Reassigned to ${currentUser}`
        });
      }

      // 5. Lead Type Changed
      if (existingLead) {
        const oldLeadType = (existingLead.leads && existingLead.leads.length > 0)
          ? existingLead.leads[existingLead.leads.length - 1].leadType
          : "Direct Lead";
        const newLeadType = body.leadType || "Direct Lead";
        if (oldLeadType !== newLeadType) {
          historyEntries.push({
            action: "Lead Type Changed",
            eventType: "lead_type_changed",
            performedBy: session.user.id,
            performedById: session.user.id,
            performedByName: session.user.name || "User",
            performedByRole: session.user.role || "associate",
            performedAt: new Date(),
            timestamp: new Date(),
            notes: `${oldLeadType} → ${newLeadType}`
          });
        }
      }

      if (historyEntries.length > 0) {
        customerUpdate.$push = { chatHistory: { $each: historyEntries } };
      }
    }

    // 2. Get or Create the Customer
    let updatedCustomer;
    if (!existingCustomer) {
      updatedCustomer = await Customer.create({
        phone: cleanPhone,
        createdBy: session.user.id,
        chatHistory: [{
          action: "Started",
          performedBy: session.user.id,
          timestamp: new Date(),
          notes: "Lead record created"
        }],
        ...customerSetPayload
      });
    } else {
      updatedCustomer = await Customer.findOneAndUpdate(
        { phone: cleanPhone },
        customerUpdate,
        { returnDocument: "after" }
      );
    }

    if (global.io && body.branchId !== undefined) {
      const emitData = {
        phone: cleanPhone,
        branchId: resolvedBranchId ? resolvedBranchId.toString() : null,
        branchName: resolvedBranchName,
        branchCode: resolvedBranchCode,
        updatedBy: { id: session.user.id, name: session.user.name }
      };
      global.io.emit("customer_branch_updated", emitData);
      global.io.emit("customer_updated", emitData);
    }

    const rootFields = rootLeadFields(body, resolvedName, resolvedCity, resolvedAddress, currentUser, associateId);

    // 🛑 PREVENT OVERWRITING ORIGINAL CLOSURE DETAILS
    if (wasAlreadyClosed) {
      delete rootFields.closedBy;
      delete rootFields.closedById;
      delete rootFields.closedAt;
      rootFields.isClosed = true;
    }

    const currentHandoff = {
      associateId: associateId || "system",
      associateName: currentUser,
      assignedAt: new Date()
    };

    // IF LEAD DOES NOT EXIST - CREATE NEW
    if (!existingLead) {
      const newFollowUp = await buildFollowUp(body, session);

      const newLead = await Lead.create({
        phone: cleanPhone,
        customerProfile: updatedCustomer._id,
        ...rootFields,
        handledByHistory: [currentHandoff],
        leads: [newFollowUp],
      });

      updatedCustomer.leadProfile = newLead._id;
      await updatedCustomer.save();

      await invalidateCache();
      const sanitizedLead = sanitizeCustomerOrLeadData(newLead.toObject ? newLead.toObject() : newLead, session.user);
      return NextResponse.json({ success: true, lead: sanitizedLead, action: "created" });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UPDATE HANDOFF HISTORY IF HANDLER CHANGED
    // ─────────────────────────────────────────────────────────────────────────
    if (!existingLead.handledByHistory) existingLead.handledByHistory = [];
    const lastHandler = existingLead.handledByHistory.length > 0 
        ? existingLead.handledByHistory[existingLead.handledByHistory.length - 1] 
        : null;
    
    if (!lastHandler || lastHandler.associateName !== currentUser) {
      existingLead.handledByHistory.push(currentHandoff);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 🚀 NEW TIMELINE LOGIC: "Should we Push or Merge?"
    // ─────────────────────────────────────────────────────────────────────────
    const latestIdx = existingLead.leads.length - 1;
    const latestStatus = existingLead.leads[latestIdx]?.status ?? "New";
    const incomingStatus = body.status ?? latestStatus;

    let shouldCreateNewEntry = false;

    // Rule 1: If it's already Closed, strictly update fields but never create a new entry
    if (latestStatus === "Closed") {
        shouldCreateNewEntry = false;
    } 
    // Rule 2: If it's Not Interested, only create new if transitioning back to Follow Up.
    else if (latestStatus === "Not Interested") {
        if (incomingStatus === "Follow Up") {
            shouldCreateNewEntry = true;
        } else {
            shouldCreateNewEntry = false; // Just update note
        }
    } 
    // Rule 3: If it's in Follow Up, only create new if transitioning to Closed/Not Interested.
    else if (latestStatus === "Follow Up") {
        if (incomingStatus === "Closed" || incomingStatus === "Not Interested") {
            shouldCreateNewEntry = true;
        } else {
            shouldCreateNewEntry = false; // Just update priority or remarks
        }
    } 
    // Rule 4: For 'New', just update the initial entry as they start working on it.
    else {
        shouldCreateNewEntry = false;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // APPLY THE DECISION
    // ─────────────────────────────────────────────────────────────────────────
    if (!shouldCreateNewEntry) {
      // 👉 UPDATE EXISTING (MERGE)
      Object.assign(existingLead, rootFields);
      if (latestIdx >= 0) mergeFollowUp(existingLead.leads[latestIdx], body);

      await existingLead.save();
      await invalidateCache();
      const sanitizedLead = sanitizeCustomerOrLeadData(existingLead.toObject ? existingLead.toObject() : existingLead, session.user);
      return NextResponse.json({ success: true, lead: sanitizedLead, action: "updated_existing_entry" });
    } else {
      // 👉 CREATE NEW (PUSH)
      Object.assign(existingLead, rootFields);

      const newFollowUp = await buildFollowUp(body, session);
      existingLead.leads.push(newFollowUp);

      await existingLead.save();
      await invalidateCache();
      const sanitizedLead = sanitizeCustomerOrLeadData(existingLead.toObject ? existingLead.toObject() : existingLead, session.user);
      return NextResponse.json({ success: true, lead: sanitizedLead, action: "pushed_new_entry" });
    }

  } catch (error) {
    console.error("[POST /api/leads] Internal Error:", error);
    return NextResponse.json({ error: error.message || "Failed to save lead" }, { status: 500 });
  }
}

async function invalidateCache() {
  if (redis && redis.status === "ready") {
    try {
      await redis.del("chats:all_data");
    } catch (e) {
      console.error("[Redis invalidation error]", e);
    }
  }
}