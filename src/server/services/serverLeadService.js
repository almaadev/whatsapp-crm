import Customer from "@/shared/models/Customer";
import Lead from "@/shared/models/Lead";
import User from "@/shared/models/User";
import Branch from "@/shared/models/Branch";
import CustomerAddress from "@/shared/models/CustomerAddress";
import { activityService } from "@/server/services/activityService";
import { ActivityEvents, ActivitySources } from "@/shared/constants/activityConstants";
import { getUserNameById } from "@/shared/utils/userUtils";
import { 
  publishPerformanceEvent,
  emitCustomerUpdated,
  emitCustomerBranchUpdated,
  emitLeadStatusUpdate,
  emitFollowUpAdded
} from "@/shared/utils/socketPublisher";
import { resolveLeadStatus } from "@/shared/utils/leadStatusResolver";


function normalisePhone(raw = "") {
  let p = raw.toString().trim();
  if (!p.startsWith("whatsapp:")) p = `whatsapp:${p}`;
  return p;
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

    // 1. Fetch existing customer and lead
    let customerDoc = null;
    if (body.customerId) {
      customerDoc = await Customer.findById(body.customerId);
    }
    if (!customerDoc) {
      customerDoc = await Customer.findOne({ phone: cleanPhone });
    }

    let existingLead = null;
    if (body.leadId) {
      existingLead = await Lead.findById(body.leadId);
      if (!existingLead) {
        throw new Error(`Lead not found for ID: ${body.leadId}`);
      }
    } else if (customerDoc) {
      existingLead = await Lead.findOne({ customerId: customerDoc._id });
    }

    let wasAlreadyClosed = false;
    if (existingLead) {
      const currentStatus = resolveLeadStatus(existingLead);
      wasAlreadyClosed = currentStatus === "Closed" || currentStatus === "Not Interested";
    }

    // Resolve Name, City, Address
    const resolvedName = (body.name?.trim())
      || (customerDoc?.name && customerDoc.name !== "Unknown" ? customerDoc.name : "")
      || "Unknown";
    
    // Resolve current address if customer exists
    const currentAddress = customerDoc
      ? await CustomerAddress.findOne({ customerId: customerDoc._id, isCurrent: true }).lean()
      : null;

    const resolvedCity = body.city?.trim() || currentAddress?.city || "";
    const resolvedAddress = body.address?.trim() || currentAddress?.address || "";
    const resolvedStatus = body.status || (existingLead ? resolveLeadStatus(existingLead) : "New");
    const resolvedPriority = body.priority || "Medium";

    let resolvedBranchId = customerDoc?.branchId || null;
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

    // Capture pre-update snapshot for field-level change tracking
    const targetCycleId = body.followUpCycleId || body.followUpId;
    const targetFollowUpPre = targetCycleId
      ? (existingLead?.leads?.find(f => f._id?.toString() === targetCycleId) || (existingLead?.leads?.length > 0 ? existingLead.leads[existingLead.leads.length - 1] : null))
      : (existingLead?.leads?.length > 0 ? existingLead.leads[existingLead.leads.length - 1] : null);

    let oldBranchNamePre = "Unassigned Branch";
    if (customerDoc?.branchId) {
      const bDoc = await Branch.findById(customerDoc.branchId).lean();
      if (bDoc) oldBranchNamePre = bDoc.name;
    }

    const preSnapshot = customerDoc ? {
      name: (customerDoc.name || "").trim(),
      address: (currentAddress?.address || "").trim(),
      city: (currentAddress?.city || "").trim(),
      source: (customerDoc.source || "Whatsapp").trim(),
      enquiredFor: (targetFollowUpPre?.enquiredFor || "").trim(),
      leadType: (targetFollowUpPre?.leadType || "Direct Lead").trim(),
      branchId: customerDoc.branchId ? customerDoc.branchId.toString() : null,
      branchName: oldBranchNamePre,
      overallRemarks: (customerDoc.remarks || "").trim(),
      day1Remarks: (targetFollowUpPre?.day1Remarks || "").trim(),
      day2Remarks: (targetFollowUpPre?.day2Remarks || "").trim(),
      day3Remarks: (targetFollowUpPre?.day3Remarks || "").trim(),
    } : null;

    // Resolve assigned user/associate
    let assignedUserId = userDoc ? userDoc._id : null;
    let assignedTo = currentUser;

    // Prepare Customer updates
    const customerSetPayload = {
      name: resolvedName,
      status: resolvedStatus,
      priority: resolvedPriority,
      assignedTo,
      assignedUserId
    };
    if (body.remarks !== undefined || body.overallRemarks !== undefined) {
      customerSetPayload.remarks = (body.overallRemarks ?? body.remarks ?? "").trim();
    }
    if (body.source !== undefined) {
      customerSetPayload.source = body.source.trim();
    }
    if (body.enquiredFor !== undefined) {
      customerSetPayload.enquiredFor = body.enquiredFor.trim();
    }
    if (body.leadType) {
      customerSetPayload.activeRouteCategory = body.leadType.trim();
    }
    if (body.branchId !== undefined) {
      customerSetPayload.branchId = resolvedBranchId;
    }

    const previousStatus = customerDoc?.status || "New";

    let isNewCustomer = false;
    if (!customerDoc) {
      isNewCustomer = true;
      customerDoc = new Customer({
        phone: cleanPhone,
        createdBy: session.user.id,
        ...customerSetPayload
      });
      await customerDoc.save();
    } else {
      Object.assign(customerDoc, customerSetPayload);
      await customerDoc.save();
    }

    // Address updates
    const addressChanged = isNewCustomer || 
      (body.address?.trim() !== undefined && body.address.trim() !== (currentAddress?.address || "").trim()) ||
      (body.city?.trim() !== undefined && body.city.trim() !== (currentAddress?.city || "").trim());

    if (addressChanged) {
      const newAddress = await CustomerAddress.create({
        customerId: customerDoc._id,
        city: body.city?.trim() !== undefined ? body.city.trim() : (currentAddress?.city || ""),
        address: body.address?.trim() !== undefined ? body.address.trim() : (currentAddress?.address || ""),
        isCurrent: true,
        validFrom: new Date(),
        createdBy: session.user.id
      });

      if (!isNewCustomer) {
        await CustomerAddress.updateMany(
          { customerId: customerDoc._id, _id: { $ne: newAddress._id } },
          { $set: { isCurrent: false, validTo: new Date() } }
        );
      }

      customerDoc.currentAddressId = newAddress._id;
      await customerDoc.save();
    }

    // Log other status/priority/owner activities
    if (!isNewCustomer) {
      if (customerDoc.priority !== resolvedPriority) {
        await activityService.log({
          eventType: ActivityEvents.CUSTOMER_UPDATED,
          entityType: "Customer",
          entityId: customerDoc._id,
          customerId: customerDoc._id,
          actorId: session.user.id,
          source: ActivitySources.WEB,
          metadata: {
            notes: `${customerDoc.priority || "Medium"} → ${resolvedPriority}`
          }
        });
      }

      if (customerDoc.assignedTo && customerDoc.assignedTo !== currentUser) {
        await activityService.log({
          eventType: ActivityEvents.LEAD_ASSIGNED,
          entityType: "Lead",
          customerId: customerDoc._id,
          actorId: session.user.id,
          source: ActivitySources.WEB,
          metadata: {
            oldOwner: customerDoc.assignedTo,
            newOwner: currentUser,
            notes: `Reassigned to ${currentUser}`
          }
        });
      }
    } else {
      // Log new customer creation
      await activityService.log({
        eventType: ActivityEvents.CUSTOMER_CREATED,
        entityType: "Customer",
        entityId: customerDoc._id,
        customerId: customerDoc._id,
        actorId: session.user.id,
        source: ActivitySources.WEB,
        metadata: {
          notes: `Customer record manually created by ${session.user.name}`
        }
      });

      await activityService.log({
        eventType: ActivityEvents.LEAD_CREATED,
        entityType: "Lead",
        customerId: customerDoc._id,
        actorId: session.user.id,
        source: ActivitySources.WEB,
        metadata: {
          notes: "Lead record created"
        }
      });
    }

    // Construct follow-up and handoff fields
    const currentHandoff = {
      associateId: associateId || "system",
      associateName: currentUser,
      assignedAt: new Date()
    };

    const isClosed = resolvedStatus === "Closed" || resolvedStatus === "Not Interested";
    const rootFields = {
      assignedTo: currentUser,
      associateId,
      isClosed
    };

    if (isClosed && !wasAlreadyClosed) {
      rootFields.closedBy = currentUser;
      rootFields.closedById = associateId;
      rootFields.closedAt = new Date();
    } else if (!isClosed) {
      rootFields.closedBy = null;
      rootFields.closedById = null;
      rootFields.closedAt = null;
    }

    let updatedLead;
    let action = "created";
    let newLeadEntry = null;

    if (!existingLead) {
      newLeadEntry = await buildFollowUp(body, session);
      updatedLead = await Lead.create({
        customerId: customerDoc._id,
        handledByHistory: [currentHandoff],
        leads: [newLeadEntry],
        ...rootFields
      });

      customerDoc.activeLeadId = updatedLead._id;
      await customerDoc.save();
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
      const latestStatus = resolveLeadStatus(existingLead);
      const incomingStatus = body.status ?? latestStatus;

      const VALID_STATUSES = ["New", "Follow Up", "Closed", "Not Interested"];
      if (!VALID_STATUSES.includes(incomingStatus)) {
        throw new Error(`Invalid status: ${incomingStatus}`);
      }

      let shouldCreateNewEntry = false;
      if (incomingStatus !== latestStatus) {
        const ALLOWED_TRANSITIONS = {
          New: ["Follow Up", "Closed", "Not Interested"],
          "Follow Up": ["Closed", "Not Interested"],
          Closed: ["Follow Up", "Not Interested"],
          "Not Interested": ["Follow Up", "Closed"],
        };

        const allowed = ALLOWED_TRANSITIONS[latestStatus] || [];
        if (!allowed.includes(incomingStatus)) {
          throw new Error(
            `Invalid lead status transition: ${latestStatus} → ${incomingStatus}`
          );
        }

        shouldCreateNewEntry = true;
      }

      Object.assign(existingLead, rootFields);

      const targetIdx = targetCycleId
        ? existingLead.leads.findIndex(f => f._id?.toString() === targetCycleId)
        : latestIdx;
      const activeIdx = targetIdx >= 0 ? targetIdx : latestIdx;

      if (!shouldCreateNewEntry) {
        if (activeIdx >= 0) mergeFollowUp(existingLead.leads[activeIdx], body);
        newLeadEntry = existingLead.leads[activeIdx];
        action = "updated_existing_entry";
      } else {
        newLeadEntry = await buildFollowUp(body, session);
        // Ensure new follow-up entry has correct status
        newLeadEntry.status = incomingStatus;
        existingLead.leads.push(newLeadEntry);
        action = "pushed_new_entry";
      }

      await existingLead.save();
      updatedLead = existingLead;
    }

    // Re-read and verify persistence from MongoDB
    const persistedLead = await Lead.findById(updatedLead._id).lean();
    const persistedStatus = resolveLeadStatus(persistedLead);
    if (persistedStatus !== resolvedStatus) {
      console.error("[LeadStatus] PERSISTENCE MISMATCH", {
        leadId: updatedLead._id,
        requestedStatus: resolvedStatus,
        persistedStatus,
      });
      throw new Error(
        `Lead status persistence failed: requested ${resolvedStatus}, persisted ${persistedStatus}`
      );
    }

    // Field-level post-persistence verification and activity logging
    if (!isNewCustomer && preSnapshot) {
      const persistedCustomer = await Customer.findById(customerDoc._id).lean();
      const persistedAddress = await CustomerAddress.findOne({ customerId: customerDoc._id, isCurrent: true }).lean();
      const persistedFollowUp = targetCycleId
        ? (persistedLead?.leads?.find(f => f._id?.toString() === targetCycleId) || (persistedLead?.leads?.length > 0 ? persistedLead.leads[persistedLead.leads.length - 1] : null))
        : (persistedLead?.leads?.length > 0 ? persistedLead.leads[persistedLead.leads.length - 1] : null);

      let postBranchName = "Unassigned Branch";
      if (persistedCustomer?.branchId) {
        const bDoc = await Branch.findById(persistedCustomer.branchId).lean();
        if (bDoc) postBranchName = bDoc.name;
      }

      const postSnapshot = {
        name: (persistedCustomer?.name || "").trim(),
        address: (persistedAddress?.address || "").trim(),
        city: (persistedAddress?.city || "").trim(),
        source: (persistedCustomer?.source || "Whatsapp").trim(),
        enquiredFor: (persistedFollowUp?.enquiredFor || "").trim(),
        leadType: (persistedFollowUp?.leadType || "Direct Lead").trim(),
        branchId: persistedCustomer?.branchId ? persistedCustomer.branchId.toString() : null,
        branchName: postBranchName,
        overallRemarks: (persistedCustomer?.remarks || "").trim(),
        day1Remarks: (persistedFollowUp?.day1Remarks || "").trim(),
        day2Remarks: (persistedFollowUp?.day2Remarks || "").trim(),
        day3Remarks: (persistedFollowUp?.day3Remarks || "").trim(),
      };

      const actorIdForLog = associateId || session.user.id;

      // 1. Full Name
      if (preSnapshot.name !== postSnapshot.name) {
        await activityService.log({
          eventType: ActivityEvents.NAME_UPDATED,
          entityType: "Customer",
          entityId: customerDoc._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: actorIdForLog,
          source: ActivitySources.WEB,
          metadata: {
            field: "name",
            oldValue: preSnapshot.name,
            newValue: postSnapshot.name,
          }
        });
      }

      // 2. Address
      if (preSnapshot.address !== postSnapshot.address) {
        await activityService.log({
          eventType: ActivityEvents.ADDRESS_UPDATED,
          entityType: "Customer",
          entityId: customerDoc._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: actorIdForLog,
          source: ActivitySources.WEB,
          metadata: {
            field: "address",
            oldValue: preSnapshot.address,
            newValue: postSnapshot.address,
          }
        });
      }

      // 3. City
      if (preSnapshot.city !== postSnapshot.city) {
        await activityService.log({
          eventType: ActivityEvents.CITY_UPDATED,
          entityType: "Customer",
          entityId: customerDoc._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: actorIdForLog,
          source: ActivitySources.WEB,
          metadata: {
            field: "city",
            oldValue: preSnapshot.city,
            newValue: postSnapshot.city,
          }
        });
      }

      // 4. Source
      if (preSnapshot.source !== postSnapshot.source) {
        await activityService.log({
          eventType: ActivityEvents.SOURCE_UPDATED,
          entityType: "Customer",
          entityId: customerDoc._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: actorIdForLog,
          source: ActivitySources.WEB,
          metadata: {
            field: "source",
            oldValue: preSnapshot.source,
            newValue: postSnapshot.source,
          }
        });
      }

      // 5. Enquired For
      if (preSnapshot.enquiredFor !== postSnapshot.enquiredFor) {
        await activityService.log({
          eventType: ActivityEvents.ENQUIRED_FOR_UPDATED,
          entityType: "Lead",
          entityId: updatedLead._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: actorIdForLog,
          source: ActivitySources.WEB,
          metadata: {
            field: "enquiredFor",
            oldValue: preSnapshot.enquiredFor,
            newValue: postSnapshot.enquiredFor,
          }
        });
      }

      // 6. Lead Type
      if (preSnapshot.leadType !== postSnapshot.leadType) {
        await activityService.log({
          eventType: ActivityEvents.LEAD_TYPE_UPDATED,
          entityType: "Lead",
          entityId: updatedLead._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: actorIdForLog,
          source: ActivitySources.WEB,
          metadata: {
            field: "leadType",
            oldValue: preSnapshot.leadType,
            newValue: postSnapshot.leadType,
          }
        });
      }

      // 7. Assigned Branch
      if (preSnapshot.branchId !== postSnapshot.branchId) {
        await activityService.log({
          eventType: ActivityEvents.BRANCH_UPDATED,
          entityType: "Customer",
          entityId: customerDoc._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: actorIdForLog,
          source: ActivitySources.WEB,
          metadata: {
            field: "branch",
            oldValue: {
              id: preSnapshot.branchId,
              name: preSnapshot.branchName,
            },
            newValue: {
              id: postSnapshot.branchId,
              name: postSnapshot.branchName,
            }
          }
        });

        emitCustomerBranchUpdated({
          phone: cleanPhone,
          branchId: postSnapshot.branchId,
          branchName: postSnapshot.branchName,
          branchCode: resolvedBranchCode,
          updatedBy: { id: session.user.id, name: session.user.name }
        }, postSnapshot.branchId);
      }

      // 8. Overall Remarks
      if (preSnapshot.overallRemarks !== postSnapshot.overallRemarks) {
        await activityService.log({
          eventType: ActivityEvents.OVERALL_REMARKS_UPDATED,
          entityType: "Customer",
          entityId: customerDoc._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: actorIdForLog,
          source: ActivitySources.WEB,
          metadata: {
            field: "overallRemarks",
            oldValue: preSnapshot.overallRemarks,
            newValue: postSnapshot.overallRemarks,
          }
        });
      }

      const activeFollowUpIdStr = persistedFollowUp?._id ? persistedFollowUp._id.toString() : targetCycleId || null;

      // 9. Day 1 Remarks
      if (preSnapshot.day1Remarks !== postSnapshot.day1Remarks) {
        await activityService.log({
          eventType: ActivityEvents.FOLLOWUP_REMARK_UPDATED,
          entityType: "Lead",
          entityId: updatedLead._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: actorIdForLog,
          source: ActivitySources.WEB,
          metadata: {
            field: "day1Remarks",
            followUpId: activeFollowUpIdStr,
            oldValue: preSnapshot.day1Remarks,
            newValue: postSnapshot.day1Remarks,
          }
        });
      }

      // 10. Day 2 Remarks
      if (preSnapshot.day2Remarks !== postSnapshot.day2Remarks) {
        await activityService.log({
          eventType: ActivityEvents.FOLLOWUP_REMARK_UPDATED,
          entityType: "Lead",
          entityId: updatedLead._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: actorIdForLog,
          source: ActivitySources.WEB,
          metadata: {
            field: "day2Remarks",
            followUpId: activeFollowUpIdStr,
            oldValue: preSnapshot.day2Remarks,
            newValue: postSnapshot.day2Remarks,
          }
        });
      }

      // 11. Day 3 Remarks
      if (preSnapshot.day3Remarks !== postSnapshot.day3Remarks) {
        await activityService.log({
          eventType: ActivityEvents.FOLLOWUP_REMARK_UPDATED,
          entityType: "Lead",
          entityId: updatedLead._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: actorIdForLog,
          source: ActivitySources.WEB,
          metadata: {
            field: "day3Remarks",
            followUpId: activeFollowUpIdStr,
            oldValue: preSnapshot.day3Remarks,
            newValue: postSnapshot.day3Remarks,
          }
        });
      }
    }

    // Telemetry and real-time socket events
    if (isNewCustomer) {
      publishPerformanceEvent("customer_created", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        status: resolvedStatus,
        priority: resolvedPriority,
        assignedTo: currentUser
      }, resolvedBranchId);
    }

    if (isNewCustomer || customerDoc.assignedTo !== currentUser) {
      const isReassignment = !isNewCustomer && customerDoc.assignedTo && customerDoc.assignedTo !== "Unassigned";
      publishPerformanceEvent(isReassignment ? "customer_reassigned" : "customer_assigned", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        assignedTo: currentUser,
        previousAssignedTo: customerDoc?.assignedTo
      }, resolvedBranchId);
    }

    const isNewLead = !existingLead;
    publishPerformanceEvent(isNewLead ? "lead_new" : "lead_existing", {
      phone: cleanPhone,
      name: resolvedName,
      branchId: resolvedBranchId,
      status: resolvedStatus,
      priority: resolvedPriority,
      leadType: body.leadType || "Direct Lead"
    }, resolvedBranchId);

    if (resolvedStatus === "Follow Up") {
      publishPerformanceEvent("followup_added", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        followUp: newLeadEntry,
        performedBy: session.user.name
      }, resolvedBranchId);
    }

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

    if (resolvedStatus === "Closed") {
      publishPerformanceEvent("lead_closed", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        closedBy: currentUser,
        closedAt: new Date(),
        performedBy: session.user.name
      }, resolvedBranchId);

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
      // await activityService.log({
      //   eventType: ActivityEvents.LEAD_STATUS_CHANGED,
      //   entityType: "Lead",
      //   entityId: updatedLead._id,
      //   customerId: customerDoc._id,
      //   leadId: updatedLead._id,
      //   actorId: session.user.id,
      //   source: ActivitySources.WEB,
      //   metadata: {
      //     oldStatus: previousStatus,
      //     newStatus: resolvedStatus,
      //     notes: `Lead status changed from ${previousStatus} to ${resolvedStatus}`
      //   }
      // });

      if (previousStatus === "Follow Up" && resolvedStatus !== "Follow Up") {
        await activityService.log({
          eventType: ActivityEvents.FOLLOWUP_COMPLETED,
          entityType: "Lead",
          entityId: updatedLead._id,
          customerId: customerDoc._id,
          leadId: updatedLead._id,
          actorId: session.user.id,
          source: ActivitySources.WEB,
          metadata: {
            notes: `Follow-up completed with outcome: ${resolvedStatus}`
          }
        });
      }

      publishPerformanceEvent("lead_status_changed", {
        phone: cleanPhone,
        name: resolvedName,
        branchId: resolvedBranchId,
        status: resolvedStatus,
        previousStatus,
        performedBy: session.user.name
      }, resolvedBranchId);

      emitLeadStatusUpdate({
        phone: cleanPhone,
        name: resolvedName,
        status: resolvedStatus,
        previousStatus,
        assignedTo: currentUser,
        leadType: body.leadType || "Direct Lead",
        updatedAt: new Date()
      }, resolvedBranchId);
    }

    if (resolvedStatus === "Follow Up" && action === "pushed_new_entry") {
      await activityService.log({
        eventType: ActivityEvents.FOLLOWUP_CREATED,
        entityType: "Lead",
        entityId: updatedLead._id,
        customerId: customerDoc._id,
        leadId: updatedLead._id,
        actorId: session.user.id,
        source: ActivitySources.WEB,
        metadata: {
          notes: `Follow-up created: ${newLeadEntry?.overAllRemarks || ""}`,
          followupDate: newLeadEntry?.date
        }
      });
    }

    if (resolvedStatus === "Follow Up") {
      emitFollowUpAdded({
        phone: cleanPhone,
        name: resolvedName,
        status: resolvedStatus,
        assignedTo: currentUser,
        followUp: newLeadEntry,
        updatedAt: new Date()
      }, resolvedBranchId);
    }

    emitCustomerUpdated({
      phone: cleanPhone,
      assignedTo: currentUser,
      status: resolvedStatus,
      name: resolvedName,
      activeRouteCategory: body.leadType || (customerDoc?.activeRouteCategory || "Direct Lead"),
    }, resolvedBranchId);

    return { customer: customerDoc, lead: persistedLead, status: persistedStatus, action };
  }
};
