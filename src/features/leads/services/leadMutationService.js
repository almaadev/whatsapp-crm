import { createLead, updateLead, closeLeadsByPhones, findLeadByPhone } from "@/shared/repositories/leadRepository";
import { findCustomerByPhone, upsertCustomer, updateCustomer } from "@/shared/repositories/customerRepository";
import { getUserNameById, findUserByName } from "@/shared/repositories/userRepository";
import { invalidateCache } from "@/shared/lib/cacheService";
import { normalizePhone } from "@/shared/utils/phoneUtils";

// --- Private Helpers ---

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

export const leadMutationService = {
  async createOrUpdateLead(body, session) {
    const cleanPhone = normalizePhone(body.phone || body.mobile);
    const currentUser = session.user.id ? await getUserNameById(session.user.id, session.user.name) : "Unknown";
    const userDoc = await findUserByName(currentUser);
    const associateId = userDoc ? userDoc._id.toString() : session.user.id;

    const existingLead = await findLeadByPhone(cleanPhone);
    let wasAlreadyClosed = false;

    if (existingLead && existingLead.leads?.length > 0) {
      const latestStatus = existingLead.leads[existingLead.leads.length - 1].status;
      if (latestStatus === "Closed") {
        wasAlreadyClosed = true;
        body.status = "Closed";
      }
    }

    const existingCustomer = await findCustomerByPhone(cleanPhone);
    const resolvedName = body.name?.trim() || (existingCustomer?.name && existingCustomer.name !== "Unknown" ? existingCustomer.name : "") || "Unknown";
    const resolvedCity = body.city?.trim() || existingCustomer?.city || "";
    const resolvedAddress = body.address?.trim() || existingCustomer?.address || "";
    const resolvedStatus = body.status || "New";
    const resolvedPriority = body.priority || "Medium";
    
    const updatedCustomer = await upsertCustomer(cleanPhone, { 
      name: resolvedName, city: resolvedCity, address: resolvedAddress, status: resolvedStatus, priority: resolvedPriority 
    }, associateId);

    const rootFields = rootLeadFields(body, resolvedName, resolvedCity, resolvedAddress, currentUser, associateId);

    if (wasAlreadyClosed) {
      delete rootFields.closedBy;
      delete rootFields.closedById;
      delete rootFields.closedAt;
      rootFields.isClosed = true;
    }

    const currentHandoff = { associateId: associateId || "system", associateName: currentUser, assignedAt: new Date() };

    if (!existingLead) {
      const newFollowUp = await buildFollowUp(body, session);
      const newLead = await createLead({
        phone: cleanPhone, customerProfile: updatedCustomer._id, ...rootFields,
        handledByHistory: [currentHandoff], leads: [newFollowUp]
      });
      await updateCustomer(cleanPhone, { leadProfile: newLead._id });
      await invalidateCache("chats:all_data");
      return { success: true, lead: newLead, action: "created" };
    }

    if (!existingLead.handledByHistory) existingLead.handledByHistory = [];
    const lastHandler = existingLead.handledByHistory.length > 0 ? existingLead.handledByHistory[existingLead.handledByHistory.length - 1] : null;
    
    if (!lastHandler || lastHandler.associateName !== currentUser) {
      existingLead.handledByHistory.push(currentHandoff);
    }

    const latestIdx = existingLead.leads.length - 1;
    const latestStatus = existingLead.leads[latestIdx]?.status ?? "New";
    const incomingStatus = body.status ?? latestStatus;
    let shouldCreateNewEntry = false;

    if (latestStatus === "Closed") shouldCreateNewEntry = false;
    else if (latestStatus === "Not Interested") shouldCreateNewEntry = incomingStatus === "Follow Up";
    else if (latestStatus === "Follow Up") shouldCreateNewEntry = incomingStatus === "Closed" || incomingStatus === "Not Interested";
    else shouldCreateNewEntry = false;

    if (!shouldCreateNewEntry) {
      Object.assign(existingLead, rootFields);
      if (latestIdx >= 0) mergeFollowUp(existingLead.leads[latestIdx], body);
      await updateLead(existingLead);
      await invalidateCache("chats:all_data");
      return { success: true, lead: existingLead, action: "updated_existing_entry" };
    } else {
      Object.assign(existingLead, rootFields);
      const newFollowUp = await buildFollowUp(body, session);
      existingLead.leads.push(newFollowUp);
      await updateLead(existingLead);
      await invalidateCache("chats:all_data");
      return { success: true, lead: existingLead, action: "pushed_new_entry" };
    }
  },

  async closeLeads(phones, session, currentState) {
    const newStateBoolean = currentState !== "TRUE"; 
    const closedBy = await getUserNameById(session.user.id);

    const updateData = {
      isClosed: newStateBoolean,
      status: newStateBoolean ? "Closed" : "Follow Up",
      lastClosedBy: newStateBoolean ? closedBy : "",
    };
    if (newStateBoolean) updateData.priority = "";

    for (let phone of phones) {
      let cleanPhone = normalizePhone(phone);
      await updateCustomer(cleanPhone, updateData);
    }

    const cleanPhones = phones.map(normalizePhone);
    await closeLeadsByPhones(cleanPhones, { name: closedBy, id: session.user.id });
    
    await invalidateCache("chats:all_data");
    return { success: true, newState: newStateBoolean ? "TRUE" : "FALSE" };
  },

  async updateLeadStatus(body, session) {
    const { phone, status, associateName, notes, priority } = body;
    const cleanPhone = normalizePhone(phone);
    const isClosed = status === "Closed";
    
    const resolvedAssociateName = associateName || session.user.name;
    const userDoc = await findUserByName(resolvedAssociateName);
    const associateId = userDoc ? userDoc._id.toString() : "";

    const customer = await findCustomerByPhone(cleanPhone);
    if (customer) {
      const updates = { status, assignedTo: resolvedAssociateName, isClosed };
      if (priority) updates.priority = priority;
      if (notes) updates.remarks = notes;
      await updateCustomer(cleanPhone, updates);
    }

    let lead = await findLeadByPhone(cleanPhone);
    const now = new Date();
    const newFollowUpEntry = {
      date: now, year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate(),
      enquiredFor: customer?.enquiredFor || "", associateId, associateName: resolvedAssociateName,
      priority: priority || "Medium", status, overAllRemarks: notes || "", leadType: "Direct Lead"
    };

    if (!lead) {
      lead = await createLead({
        phone: cleanPhone, name: customer?.name || "Unknown", city: customer?.city || "",
        address: customer?.address || "", source: customer?.source || "Whatsapp",
        assignedTo: resolvedAssociateName, associateId, isClosed, leads: [newFollowUpEntry],
        closedBy: isClosed ? resolvedAssociateName : null,
        closedById: isClosed ? associateId : null,
        closedAt: isClosed ? now : null
      });
    } else {
      newFollowUpEntry.leadType = lead.leads?.length > 0 ? lead.leads[lead.leads.length - 1].leadType : "Direct Lead";
      lead.leads.push(newFollowUpEntry);
      lead.assignedTo = resolvedAssociateName;
      lead.associateId = associateId;
      lead.isClosed = isClosed;
      
      if (isClosed) {
        lead.closedBy = resolvedAssociateName; lead.closedById = associateId; lead.closedAt = now;
      } else {
        lead.closedBy = null; lead.closedById = null; lead.closedAt = null;
      }

      if (lead.assignedTo !== resolvedAssociateName) {
        lead.handledByHistory.push({ associateId, associateName: resolvedAssociateName, assignedAt: now });
      }
      await updateLead(lead);
    }

    await invalidateCache("chats:all_data", "chats:main_inbox_data");
    return { success: true };
  }
};
