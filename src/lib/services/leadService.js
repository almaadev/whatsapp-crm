import { aggregateLeads, findLeadByPhone, createLead, updateLead, closeLeadsByPhones } from "../repositories/leadRepository";
import { findCustomerByPhone, upsertCustomer, updateCustomer } from "../repositories/customerRepository";
import { getUserNameById, findUserByName } from "../repositories/userRepository";
import { invalidateCache } from "./cacheService";
import { normalizePhone } from "../utils/phoneUtils";

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

// --- Public Service Methods ---

export const leadService = {
  async getLeads(params) {
    console.log("Fetching leads with params:", params);
    const { from, to, month, year, today, associate, isClosed, view, search, page = 1, limit = 10 } = params;
    const match = {};

    let startDate, endDate;
    if (today === "true") {
      startDate = new Date(); startDate.setHours(0, 0, 0, 0);
      endDate = new Date(); endDate.setHours(23, 59, 59, 999);
    } else if (month && year) {
      startDate = new Date(year, parseInt(month) - 1, 1);
      endDate = new Date(year, parseInt(month), 0, 23, 59, 59, 999);
    } else if (from || to) {
      if (from) startDate = new Date(from);
      if (to) {
        endDate = new Date(to);
        endDate.setHours(23, 59, 59, 999);
      }
    }

    const andConditions = [];

    if (startDate || endDate) {
      const dateMatch = {};
      if (startDate) dateMatch.$gte = startDate;
      if (endDate) dateMatch.$lte = endDate;

      if (view === "activities") {
        andConditions.push({ "leads.date": dateMatch });
      } else {
        andConditions.push({ $or: [{ createdAt: dateMatch }, { "leads.date": dateMatch }] });
      }
    }

    if (associate) {
      if (isClosed === "true") {
        andConditions.push({ closedBy: associate });
      } else {
        andConditions.push({
          $or: [
            { assignedTo: associate },
            { "handledByHistory.associateName": associate },
            { "leads.associateName": associate }
          ]
        });
      }
    }

    if (isClosed === "true") andConditions.push({ isClosed: true });
    if (isClosed === "false") andConditions.push({ isClosed: false });

    if (search) {
      const searchRegex = new RegExp(search, "i");
      andConditions.push({
        $or: [
          { name: searchRegex },
          { phone: searchRegex },
          { city: searchRegex },
          { leadType: searchRegex },
          { "leads.leadType": searchRegex }
        ]
      });
    }

    if (andConditions.length > 0) {
      match.$and = andConditions;
    }

    let pipeline = [];
    if (view === "activities") {
      pipeline = [
        { $unwind: "$leads" },
        { $match: match },
        { $sort: { "leads.date": -1 } },
        {
          $project: {
            phone: 1, name: { $ifNull: ["$name", "Unknown"] },
            enquiredFor: { $ifNull: ["$leads.enquiredFor", ""] },
            status: { $ifNull: ["$leads.status", "New"] },
            priority: { $ifNull: ["$leads.priority", "Medium"] },
            remarks: { $ifNull: ["$leads.overAllRemarks", ""] },
            saleAmount: { $ifNull: ["$leads.saleAmount", "0"] },
            leadType: { $ifNull: ["$leads.leadType", "Direct Lead"] },
            associate: { $ifNull: ["$leads.associateName", "Unassigned"] },
            date: "$leads.date", isActivity: { $literal: true }
          }
        },
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ];
    } else {
      pipeline = [
        { $match: match },
        { 
          $addFields: { 
            latest: { $arrayElemAt: ["$leads", -1] }, 
            first: { $arrayElemAt: ["$leads", 0] },
            interactionCount: {
              $size: {
                $filter: {
                  input: { $ifNull: ["$leads", []] },
                  as: "item",
                  cond: { $eq: ["$$item.status", "Closed"] }
                }
              }
            }
          } 
        },
        {
          $addFields: {
            sortDate: { $ifNull: ["$latest.date", "$createdAt"] }
          }
        },
        { $sort: { sortDate: -1 } },
        {
          $project: {
            phone: 1, 
            name: { $ifNull: ["$name", "Unknown Lead"] },
            displayName: {
              $cond: {
                if: { $in: [{ $ifNull: ["$name", ""] }, ["", "Unknown", "Unknown Lead"]] },
                then: { $replaceAll: { input: "$phone", find: "whatsapp:", replacement: "" } },
                else: "$name"
              }
            },
            city: { $ifNull: ["$city", ""] },
            displayCity: {
              $cond: {
                if: { $in: [{ $ifNull: ["$city", ""] }, [""]] },
                then: "Unknown Location",
                else: "$city"
              }
            },
            address: { $ifNull: ["$address", ""] }, 
            source: { $ifNull: ["$source", "Whatsapp"] },
            enquiredFor: { $ifNull: ["$latest.enquiredFor", ""] }, 
            status: { $ifNull: ["$latest.status", "$status", "New"] },
            priority: { $ifNull: ["$latest.priority", "Medium"] }, 
            remarks: { $ifNull: ["$latest.overAllRemarks", ""] },
            day1Remarks: { $ifNull: ["$latest.day1Remarks", ""] }, 
            day2Remarks: { $ifNull: ["$latest.day2Remarks", ""] },
            day3Remarks: { $ifNull: ["$latest.day3Remarks", ""] }, 
            saleAmount: { $ifNull: ["$latest.saleAmount", "0"] },
            leadType: { $ifNull: ["$latest.leadType", "$leadType", "Direct Lead"] }, 
            associate: { $ifNull: ["$assignedTo", "Admin"] },
            firstHandler: { $ifNull: ["$first.associateName", "$assignedTo", "Admin"] },
            currentHandler: { $ifNull: ["$assignedTo", "Admin"] },
            revenueAttribution: { $toInt: { $ifNull: ["$latest.saleAmount", 0] } },
            isClosed: { $eq: [{ $ifNull: ["$latest.status", "$status", "New"] }, "Closed"] },
            closedByRaw: {
              $cond: {
                if: { $eq: [{ $ifNull: ["$latest.status", "$status", "New"] }, "Closed"] },
                then: { $ifNull: ["$latest.associateName", "$closedBy", "$assignedTo"] },
                else: null
              }
            },
            interactionCount: 1,
            lastActivityDate: "$sortDate",
            handledByHistory: 1,
            createdAt: 1,
            leads: 1
          }
        },
        {
          $addFields: {
            closedBy: "$closedByRaw",
            ownershipTransitionText: {
              $cond: {
                if: "$isClosed",
                then: {
                  $cond: {
                    if: { $and: [{ $ne: ["$closedByRaw", null] }, { $ne: ["$closedByRaw", "$firstHandler"] }] },
                    then: { $concat: ["Closed by ", "$closedByRaw"] },
                    else: null
                  }
                },
                else: null
              }
            }
          }
        },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [
              { $skip: (parseInt(page) - 1) * parseInt(limit) },
              { $limit: parseInt(limit) }
            ]
          }
        }
      ];
    }
    
    const result = await aggregateLeads(pipeline);
    
    if (view === "activities") {
      return { leads: result, total: result.length, totalPages: 1 };
    }

    const total = result[0]?.metadata[0]?.total || 0;
    return {
      leads: result[0]?.data || [],
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    };
  },

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
    });

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

  async getLeadByPhone(phone) {
    const cleanPhone = normalizePhone(decodeURIComponent(phone));
    
    // .lean() not strictly needed since we manually map below, but for perf
    const [lead, customer] = await Promise.all([
      findLeadByPhone(cleanPhone).then(l => l?.toJSON()),
      findCustomerByPhone(cleanPhone)
    ]);

    if (!lead && !customer) return {};
    
    const history = lead?.leads || [];
    const latest = history.length > 0 ? history[history.length - 1] : null;

    return {
      name: lead?.name || customer?.name || "",
      city: lead?.city || customer?.city || "",
      phone: lead?.phone || cleanPhone,
      address: lead?.address || customer?.address || "",
      source: lead?.source || customer?.source || "Whatsapp",
      assignedTo: lead?.assignedTo || customer?.assignedTo || "Unassigned",
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
      latestFollowUp: latest || {}
    };
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
