import Customer from "@/shared/models/Customer";
import Lead from "@/shared/models/Lead";
import User from "@/shared/models/User";
import Branch from "@/shared/models/Branch";
import { getUserNameById } from "@/shared/utils/userUtils";
import { 
  publishPerformanceEvent,
  emitCustomerUpdated,
  emitCustomerBranchUpdated
} from "@/shared/utils/socketPublisher";

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

export const serverLeadService = {
  async createOrUpdateLead(body, session) {
    const mobileRaw = body.phone || body.mobile;
    if (!mobileRaw) {
      throw new Error("Validation Error: Mobile number is required");
    }

    const cleanPhone = normalisePhone(mobileRaw);
    const currentUser = session.user.id ? await getUserNameById(session.user.id, session.user.name) : "Unknown";
    const userDoc = await User.findOne({ name: currentUser }).lean();
    const associateId = userDoc ? userDoc._id.toString() : session.user.id;

    // 1. Fetch existing lead to check closure rule
    const existingLead = await Lead.findOne({ phone: cleanPhone });
    let wasAlreadyClosed = false;

    if (existingLead && existingLead.leads?.length > 0) {
      const latestStatus = existingLead.leads[existingLead.leads.length - 1].status;
      if (latestStatus === "Closed") {
        wasAlreadyClosed = true;
        body.status = "Closed"; // Intercept: Force status to remain "Closed"
      }
    }

    // Fetch existing customer
    const existingCustomer = await Customer.findOne({ phone: cleanPhone }).lean();
    
    const resolvedName = (body.name?.trim())
      || (existingCustomer?.name && existingCustomer.name !== "Unknown" ? existingCustomer.name : "")
      || "Unknown";
    const resolvedCity = body.city?.trim() || existingCustomer?.city || "";
    const resolvedAddress = body.address?.trim() || existingCustomer?.address || "";
    const resolvedStatus = body.status || "New";
    const resolvedPriority = body.priority || "Medium";
    
    let resolvedBranchId = existingCustomer?.branchId || null;
    let resolvedBranchName = "Unassigned Branch";
    let resolvedBranchCode = "";

    if (body.branchId !== undefined) {
      if (body.branchId) {
        const branchDoc = await Branch.findOne({ _id: body.branchId, status: "active" }).lean();
        if (!branchDoc) {
          throw new Error("Invalid or inactive branch selected.");
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
    if (body.leadType) {
      customerSetPayload.activeRouteCategory = body.leadType;
    }
    if (body.branchId !== undefined) {
      customerSetPayload.branchId = resolvedBranchId;
    }
    
    const customerUpdate = {
      $set: customerSetPayload
    };

    const historyEntries = [];
    const previousStatus = existingCustomer?.status || "New";

    if (existingCustomer) {
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

    // Emit customer branch update legacy event if branch changed
    if (body.branchId !== undefined) {
      emitCustomerBranchUpdated({
        phone: cleanPhone,
        branchId: resolvedBranchId ? resolvedBranchId.toString() : null,
        branchName: resolvedBranchName,
        branchCode: resolvedBranchCode,
        updatedBy: { id: session.user.id, name: session.user.name }
      }, resolvedBranchId);
    }

    const rootFields = rootLeadFields(body, resolvedName, resolvedCity, resolvedAddress, currentUser, associateId);

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

    let updatedLead;
    let action = "created";
    let newLeadEntry = null;

    if (!existingLead) {
      newLeadEntry = await buildFollowUp(body, session);
      updatedLead = await Lead.create({
        phone: cleanPhone,
        customerProfile: updatedCustomer._id,
        handledByHistory: [currentHandoff],
        leads: [newLeadEntry],
        ...rootFields
      });

      updatedCustomer.leadProfile = updatedLead._id;
      await updatedCustomer.save();
      action = "created";
    } else {
      if (!existingLead.handledByHistory) existingLead.handledByHistory = [];
      const lastHandler = existingLead.handledByHistory.length > 0 
          ? existingLead.handledByHistory[existingLead.handledByHistory.length - 1] 
          : null;
      
      if (!lastHandler || lastHandler.associateName !== currentUser) {
        existingLead.handledByHistory.push(currentHandoff);
      }

      const latestIdx = existingLead.leads.length - 1;
      const latestStatus = existingLead.leads[latestIdx]?.status ?? "New";
      const incomingStatus = body.status ?? latestStatus;

      let shouldCreateNewEntry = false;

      if (latestStatus === "Closed") {
        shouldCreateNewEntry = false;
      } else if (latestStatus === "Not Interested") {
        if (incomingStatus === "Follow Up") {
          shouldCreateNewEntry = true;
        } else {
          shouldCreateNewEntry = false;
        }
      } else if (latestStatus === "Follow Up") {
        if (incomingStatus === "Closed" || incomingStatus === "Not Interested") {
          shouldCreateNewEntry = true;
        } else {
          shouldCreateNewEntry = false;
        }
      } else {
        shouldCreateNewEntry = false;
      }

      Object.assign(existingLead, rootFields);

      if (!shouldCreateNewEntry) {
        if (latestIdx >= 0) mergeFollowUp(existingLead.leads[latestIdx], body);
        newLeadEntry = existingLead.leads[latestIdx];
        action = "updated_existing_entry";
      } else {
        newLeadEntry = await buildFollowUp(body, session);
        existingLead.leads.push(newLeadEntry);
        action = "pushed_new_entry";
      }

      await existingLead.save();
      updatedLead = existingLead;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  TELEMETRY EVENTS (Real-Time performance updates)
    // ─────────────────────────────────────────────────────────────────────────
    
    // Check if new customer created
    if (!existingCustomer) {
      publishPerformanceEvent("customer_created", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        status: resolvedStatus,
        priority: resolvedPriority,
        assignedTo: currentUser
      }, resolvedBranchId);
    }

    // Customer assignment
    if (!existingCustomer || existingCustomer.assignedTo !== currentUser) {
      const isReassignment = existingCustomer && existingCustomer.assignedTo && existingCustomer.assignedTo !== "Unassigned";
      publishPerformanceEvent(isReassignment ? "customer_reassigned" : "customer_assigned", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        assignedTo: currentUser,
        previousAssignedTo: existingCustomer?.assignedTo
      }, resolvedBranchId);
    }

    // Lead created or updated
    const isNewLead = !existingLead;
    publishPerformanceEvent(isNewLead ? "lead_new" : "lead_existing", {
      phone: cleanPhone,
      name: resolvedName,
      branchId: resolvedBranchId,
      status: resolvedStatus,
      priority: resolvedPriority,
      leadType: body.leadType || "Direct Lead"
    }, resolvedBranchId);

    // Follow up tracking
    if (resolvedStatus === "Follow Up") {
      publishPerformanceEvent("followup_added", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        followUp: newLeadEntry,
        performedBy: session.user.name
      }, resolvedBranchId);
    }

    // Check if status transitioned out of Follow Up (follow-up completed)
    if (previousStatus === "Follow Up" && resolvedStatus !== "Follow Up") {
      publishPerformanceEvent("followup_completed", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        followUp: newLeadEntry,
        status: resolvedStatus,
        performedBy: session.user.name
      }, resolvedBranchId);
    }

    // Lead lifecycle status mapping
    if (resolvedStatus === "Closed") {
      publishPerformanceEvent("lead_closed", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        closedBy: currentUser,
        closedAt: new Date(),
        performedBy: session.user.name
      }, resolvedBranchId);

      // Check if conversion (Closed with sale amount)
      if (body.saleAmount && Number(body.saleAmount) > 0) {
        publishPerformanceEvent("lead_converted", {
          phone: cleanPhone,
          name: resolvedName,
          branchId: resolvedBranchId,
          saleAmount: Number(body.saleAmount),
          performedBy: session.user.name
        }, resolvedBranchId);
      }
    } else if (resolvedStatus === "Not Interested") {
      publishPerformanceEvent("lead_not_interested", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        performedBy: session.user.name
      }, resolvedBranchId);
    } else if (resolvedStatus === "Lost") {
      publishPerformanceEvent("lead_lost", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        performedBy: session.user.name
      }, resolvedBranchId);
    }

    if (previousStatus !== resolvedStatus) {
      publishPerformanceEvent("lead_status_changed", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        status: resolvedStatus,
        previousStatus,
        performedBy: session.user.name
      }, resolvedBranchId);
    }

    emitCustomerUpdated({
      phone: cleanPhone,
      assignedTo: currentUser,
      status: resolvedStatus,
      name: resolvedName,
      activeRouteCategory: body.leadType || (existingCustomer?.activeRouteCategory || "Direct Lead"),
    }, resolvedBranchId);

    return { customer: updatedCustomer, lead: updatedLead, action };
  }
};
