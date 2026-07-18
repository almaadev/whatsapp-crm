import { aggregateLeads, findLeadByPhone } from "@/shared/repositories/leadRepository";
import { findCustomerByPhone } from "@/shared/repositories/customerRepository";
import { normalizePhone } from "@/shared/utils/phoneUtils";
import mongoose from "mongoose";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";

export const leadQueryService = {
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

  async getLeadByPhone(phone) {
    const cleanPhone = normalizePhone(decodeURIComponent(phone));
    
    const [lead, customer] = await Promise.all([
      findLeadByPhone(cleanPhone).then(l => l?.toJSON()),
      findCustomerByPhone(cleanPhone)
    ]);

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
      day1Remarks: latest?.day1Remarks ?? "",
      day2Remarks: latest?.day2Remarks ?? "",
      day3Remarks: latest?.day3Remarks ?? "",
      saleAmount: latest?.saleAmount || "0",
      leadType: latest?.leadType || "Direct Lead",
      history: history,
      latestFollowUp: latest || {},
      creatorInfo
    };
  }
};
