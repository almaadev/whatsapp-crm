import { normalizePhone, getPhoneVariations } from "@/shared/utils/phoneUtils";
import mongoose from "mongoose";
import Lead from "@/shared/models/Lead";
import Customer from "@/shared/models/Customer";
import Branch from "@/shared/models/Branch";

function mapKeys(obj, fromKey, toKey) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => mapKeys(item, fromKey, toKey));
  }
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const newKey = key === fromKey ? toKey : key;
    result[newKey] = mapKeys(val, fromKey, toKey);
  }
  return result;
}

export const leadQueryService = {
  async getLeads(params, session = null) {
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

    if (session) {
      const { getBranchFilterForUser } = await import("@/shared/utils/serverAuth");
      const { branchQuery } = await getBranchFilterForUser(session);
      if (branchQuery && Object.keys(branchQuery).length > 0) {
        const mappedBranchQuery = mapKeys(branchQuery, "branchId", "customerInfo.branchId");
        andConditions.push(mappedBranchQuery);
      }
    }

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
          { "customerInfo.name": searchRegex },
          { "customerInfo.phone": searchRegex },
          { "addressInfo.city": searchRegex },
          { leadType: searchRegex },
          { "leads.leadType": searchRegex }
        ]
      });
    }

    if (andConditions.length > 0) {
      match.$and = andConditions;
    }

    const lookupStages = [
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customerInfo"
        }
      },
      { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: "customeraddresses",
          let: { custId: "$customerId" },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: [ "$customerId", "$$custId" ] }, { $eq: [ "$isCurrent", true ] } ] } } }
          ],
          as: "addressInfo"
        }
      },
      { $unwind: { path: "$addressInfo", preserveNullAndEmptyArrays: true } }
    ];

    let pipeline = [];
    if (view === "activities") {
      pipeline = [
        ...lookupStages,
        { $unwind: "$leads" },
        { $match: match },
        { $sort: { "leads.date": -1 } },
        {
          $project: {
            phone: { $ifNull: ["$customerInfo.phone", ""] },
            name: { $ifNull: ["$customerInfo.name", "Unknown"] },
            city: { $ifNull: ["$addressInfo.city", ""] },
            address: { $ifNull: ["$addressInfo.address", ""] },
            source: { $ifNull: ["$customerInfo.source", "Whatsapp"] },
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
        ...lookupStages,
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
            phone: { $ifNull: ["$customerInfo.phone", ""] }, 
            name: { $ifNull: ["$customerInfo.name", "Unknown Lead"] },
            displayName: {
              $cond: {
                if: { $in: [{ $ifNull: ["$customerInfo.name", ""] }, ["", "Unknown", "Unknown Lead"]] },
                then: { $replaceAll: { input: { $ifNull: ["$customerInfo.phone", ""] }, find: "whatsapp:", replacement: "" } },
                else: "$customerInfo.name"
              }
            },
            city: { $ifNull: ["$addressInfo.city", ""] },
            displayCity: {
              $cond: {
                if: { $in: [{ $ifNull: ["$addressInfo.city", ""] }, [""]] },
                then: "Unknown Location",
                else: "$addressInfo.city"
              }
            },
            address: { $ifNull: ["$addressInfo.address", ""] }, 
            source: { $ifNull: ["$customerInfo.source", "Whatsapp"] },
            enquiredFor: { $ifNull: ["$latest.enquiredFor", ""] }, 
            status: { $ifNull: ["$latest.status", "$status", "New"] },
            priority: { $ifNull: ["$latest.priority", "Medium"] }, 
            remarks: { $ifNull: ["$latest.overAllRemarks", ""] },
            day1Remarks: { $ifNull: ["$latest.day1Remarks", ""] }, 
            day2Remarks: { $ifNull: ["$latest.day2Remarks", ""] },
            day3Remarks: { $ifNull: ["$latest.day3Remarks", ""] }, 
            saleAmount: { $ifNull: ["$latest.saleAmount", "0"] },
            leadType: { $ifNull: ["$latest.leadType", "$leadType", "Direct Lead"] }, 
            associate: { $ifNull: ["$assignedTo", "Unassigned"] },
            firstHandler: { $ifNull: ["$first.associateName", "$assignedTo", "Unassigned"] },
            currentHandler: { $ifNull: ["$assignedTo", "Unassigned"] },
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
    
    const result = await Lead.aggregate(pipeline);
    
    const rawLeads = view === "activities" ? result : (result[0]?.data || []);
    const phones = rawLeads.map((l) => l.phone).filter(Boolean);

    let enrichedLeads = rawLeads;
    if (phones.length > 0) {
      const Customer = (await import("@/shared/models/Customer")).default;
      const customers = await Customer.find({ phone: { $in: phones } }).select("phone branchId").lean();
      const branches = await Branch.find().select("name code").lean();
      const branchMapObj = {};
      branches.forEach((b) => {
        branchMapObj[b._id.toString()] = { name: b.name, code: b.code || "" };
      });

      const custBranchByPhone = new Map();
      customers.forEach((c) => {
        const bId = c.branchId ? c.branchId.toString() : null;
        const bObj = bId && branchMapObj[bId] ? branchMapObj[bId] : null;
        custBranchByPhone.set(c.phone, {
          branchId: bId,
          branchName: bObj ? bObj.name : "Unassigned Branch",
          branchCode: bObj ? bObj.code : "",
        });
      });

      enrichedLeads = rawLeads.map((l) => {
        const bInfo = custBranchByPhone.get(l.phone) || {
          branchId: null,
          branchName: "Unassigned Branch",
          branchCode: "",
        };
        return {
          ...l,
          ...bInfo,
        };
      });
    }

    if (view === "activities") {
      return { leads: enrichedLeads, total: enrichedLeads.length, totalPages: 1 };
    }

    const total = result[0]?.metadata[0]?.total || 0;
    return {
      leads: enrichedLeads,
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    };
  },

  async getLeadByPhone(phone) {
    const cleanPhone = normalizePhone(decodeURIComponent(phone));
    const phoneVars = getPhoneVariations(cleanPhone);
    
    const customer = await Customer.findOne({ phone: { $in: phoneVars } }).lean();
    let lead = null;
    if (customer) {
      lead = await Lead.findOne({ customerId: customer._id }).lean();
      if (!lead && customer.activeLeadId) {
        lead = await Lead.findById(customer.activeLeadId).lean();
      }
    }

    if (!lead && !customer) return {};
    
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

    let customerBranchId = customer?.branchId ? customer.branchId.toString() : null;
    let customerBranchName = "Unassigned Branch";
    let customerBranchCode = "";
    if (customerBranchId && mongoose.Types.ObjectId.isValid(customerBranchId)) {
      const bObj = await Branch.findById(customerBranchId).lean();
      if (bObj) {
        customerBranchName = bObj.name;
        customerBranchCode = bObj.code || "";
      }
    }

    return {
      name: customer?.name || lead?.name || "",
      city: customer?.currentAddressId?.city || customer?.city || lead?.city || "",
      phone: customer?.phone || lead?.phone || cleanPhone,
      address: customer?.currentAddressId?.address || customer?.address || lead?.address || "",
      assignedTo: (lead?.assignedTo && lead.assignedTo.toLowerCase() !== "unassigned")
        ? lead.assignedTo
        : (customer?.assignedTo && customer.assignedTo.toLowerCase() !== "unassigned" ? customer.assignedTo : "Unassigned"),
      enquiredFor: latest?.enquiredFor || customer?.enquiredFor || "",
      status: latest?.status || customer?.status || "New",
      priority: latest?.priority || customer?.priority || "Medium",
      remarks: latest?.overAllRemarks || customer?.remarks || "",
      day1Remarks: latest?.day1Remarks ?? "",
      day2Remarks: latest?.day2Remarks ?? "",
      day3Remarks: latest?.day3Remarks ?? "",
      saleAmount: latest?.saleAmount || customer?.saleAmount || "0",
      leadType: latest?.leadType || customer?.activeRouteCategory || "Direct Lead",
      branchId: customerBranchId,
      branchName: customerBranchName,
      branchCode: customerBranchCode,
      history: history,
      latestFollowUp: latest || {},
      creatorInfo
    };
  }
};
