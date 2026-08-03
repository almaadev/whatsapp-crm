import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import User from "@/shared/models/User";
import Lead from "@/shared/models/Lead";
import Customer from "@/shared/models/Customer";
import Message from "@/shared/models/Message";
import Branch from "@/shared/models/Branch";
import mongoose from "mongoose";
import { isAdminAuthorized, isSuperAdmin as checkSuperAdmin } from "@/shared/utils/auth";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";

export const dynamic = "force-dynamic";

/**
 * Calculates start and end Date objects based on preset values or custom inputs.
 */
function getOperationalDateBounds(dateRange, customFrom, customTo) {
  const now = new Date();
  let startDate = null;
  let endDate = null;

  if (dateRange === "today") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (dateRange === "yesterday") {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
  } else if (dateRange === "thisWeek") {
    const dayOfWeek = now.getDay();
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (dateRange === "thisMonth") {
    startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
  } else if (dateRange === "lastMonth") {
    startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999));
  } else if (dateRange === "custom") {
    if (customFrom) {
      startDate = new Date(customFrom);
      startDate.setHours(0, 0, 0, 0);
    }
    if (customTo) {
      endDate = new Date(customTo);
      endDate.setHours(23, 59, 59, 999);
    }
  }

  return { startDate, endDate };
}

/**
 * Format seconds into a friendly human-readable format.
 */
function formatSeconds(seconds) {
  if (!seconds || seconds <= 0) return "--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export async function GET(req) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = checkSuperAdmin(session.user.role);
    const isAdmin = isAdminAuthorized(session.user.role, session.user.department);

    if (!isSuperAdmin && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: Admin access required." }, { status: 403 });
    }

    const branches = await Branch.find().lean();
    const branchMap = {};
    branches.forEach(b => {
      branchMap[b._id.toString()] = b.name;
    });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // Fetch branch info of logged-in user
    let adminBranch = null;
    let branchFilter = searchParams.get("branchId") || "all";

    if (!isSuperAdmin) {
      const adminUser = await User.findById(session.user.id).lean();
      adminBranch = adminUser ? adminUser.branch?.toString() : null;
      branchFilter = adminBranch || "none";
    }

    const search = searchParams.get("search") || "";
    const departmentFilter = searchParams.get("department") || "all";
    const roleFilter = searchParams.get("role") || "all";
    const associateFilter = searchParams.get("associateId") || "all";
    const includeMe = searchParams.get("includeMe") === "true";

    const dateRange = searchParams.get("dateRange") || "thisMonth";
    const customFrom = searchParams.get("startDate");
    const customTo = searchParams.get("endDate");
    const { startDate, endDate } = getOperationalDateBounds(dateRange, customFrom, customTo);

    // ==========================================
    // ACTION: CUSTOMER REPORT
    // ==========================================
    if (action === "customerReport") {
      const page = parseInt(searchParams.get("page")) || 1;
      const limitParam = searchParams.get("limit") || "25";
      const limit = limitParam === "all" ? 999999 : parseInt(limitParam);

      const customerMatchStage = {};

      // Role boundary security
      if (!isSuperAdmin) {
        customerMatchStage.branchId = new mongoose.Types.ObjectId(adminBranch);
      } else if (branchFilter !== "all" && branchFilter !== "none" && /^[0-9a-fA-F]{24}$/.test(branchFilter)) {
        customerMatchStage.branchId = new mongoose.Types.ObjectId(branchFilter);
      }

      // Date Range Filter on Customer.createdAt
      if (startDate || endDate) {
        customerMatchStage.createdAt = {};
        if (startDate) customerMatchStage.createdAt.$gte = startDate;
        if (endDate) customerMatchStage.createdAt.$lte = endDate;
      }

      // Search term (Name, Phone, City, Enquired For, Associate)
      if (search) {
        const searchRegex = { $regex: search, $options: "i" };
        customerMatchStage.$or = [
          { name: searchRegex },
          { phone: searchRegex },
          { city: searchRegex },
          { enquiredFor: searchRegex },
          { assignedTo: searchRegex }
        ];
      }

      const customerReportQuery = [
        { $match: customerMatchStage },
        // Join associate info
        {
          $lookup: {
            from: "users",
            let: { assocName: "$assignedTo" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$name", "$$assocName"] },
                      { $ne: ["$role", "superAdmin"] }
                    ]
                  }
                }
              }
            ],
            as: "assocDoc"
          }
        },
        { $unwind: { path: "$assocDoc", preserveNullAndEmptyArrays: true } },
        // Join branch info
        {
          $lookup: {
            from: "branches",
            localField: "branchId",
            foreignField: "_id",
            as: "branchDoc"
          }
        },
        { $unwind: { path: "$branchDoc", preserveNullAndEmptyArrays: true } },
        // Join lead information
        {
          $lookup: {
            from: "leads",
            localField: "phone",
            foreignField: "phone",
            as: "leadDoc"
          }
        },
        { $unwind: { path: "$leadDoc", preserveNullAndEmptyArrays: true } }
      ];

      // Department & Role permission checks
      const extraFilters = {};
      if (!isSuperAdmin) {
        const adminAllowedDepts = ["telecalling", "support"];
        if (departmentFilter !== "all" && adminAllowedDepts.includes(departmentFilter)) {
          extraFilters["assocDoc.department"] = departmentFilter;
        } else if (departmentFilter !== "all") {
          extraFilters["assocDoc.department"] = { $in: adminAllowedDepts };
        }

        const adminAllowedRoles = ["doctor"];
        if (roleFilter !== "all" && adminAllowedRoles.includes(roleFilter)) {
          extraFilters["assocDoc.role"] = roleFilter;
        } else if (roleFilter !== "all") {
          extraFilters["assocDoc.role"] = { $in: adminAllowedRoles };
        }
      } else {
        if (departmentFilter !== "all") {
          extraFilters["assocDoc.department"] = departmentFilter;
        }
        if (roleFilter !== "all") {
          extraFilters["assocDoc.role"] = roleFilter;
        }
      }

      if (associateFilter !== "all" && /^[0-9a-fA-F]{24}$/.test(associateFilter)) {
        extraFilters["assocDoc._id"] = new mongoose.Types.ObjectId(associateFilter);
      }

      if (Object.keys(extraFilters).length > 0) {
        customerReportQuery.push({ $match: extraFilters });
      }

      // Server-side Sorting
      const sortBy = searchParams.get("sortBy") || "date";
      const sortOrder = searchParams.get("sortOrder") || "desc";
      const sortDirection = sortOrder === "asc" ? 1 : -1;

      let sortStage = {};
      if (sortBy === "customerName") {
        sortStage = { name: sortDirection };
      } else if (sortBy === "associate") {
        sortStage = { assignedTo: sortDirection };
      } else if (sortBy === "status") {
        sortStage = { status: sortDirection };
      } else if (sortBy === "branch") {
        sortStage = { "branchDoc.name": sortDirection };
      } else {
        sortStage = { createdAt: sortDirection };
      }
      customerReportQuery.push({ $sort: sortStage });

      // Pagination Count
      const countQuery = [...customerReportQuery, { $count: "total" }];
      const countRes = await Customer.aggregate(countQuery);
      const totalCount = countRes.length > 0 ? countRes[0].total : 0;

      if (limitParam !== "all") {
        customerReportQuery.push({ $skip: (page - 1) * limit });
        customerReportQuery.push({ $limit: limit });
      }

      const rawCustomers = await Customer.aggregate(customerReportQuery);

      // Compute formatting
      const customerReportRows = rawCustomers.map((cust) => {
        const handHistory = cust.leadDoc?.handledByHistory?.map(h => h.associateName) || [];
        const chatHistoryNames = cust.chatHistory?.map(c => c.performedByName).filter(Boolean) || [];
        const allHandlers = Array.from(new Set([cust.assignedTo, ...handHistory, ...chatHistoryNames].filter(name => name && name !== "unassigned" && name !== "System")));
        const handledBy = allHandlers.join(", ") || "-";

        const latestFollowUp = cust.leadDoc?.leads && cust.leadDoc.leads.length > 0 ? cust.leadDoc.leads[cust.leadDoc.leads.length - 1] : null;
        const remarks = latestFollowUp?.overAllRemarks || latestFollowUp?.note || cust.remarks || "-";

        const customerTimeline = (cust.chatHistory || []).map(hist => ({
          associate: hist.performedByName || "System",
          action: hist.action || hist.eventType || "-",
          remark: hist.notes || "-",
          date: hist.timestamp ? new Date(hist.timestamp).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "-"
        }));

        return {
          id: cust._id.toString(),
          customerName: resolveCustomerDisplayName(cust),
          phone: cust.phone,
          firstEnquiryDate: cust.createdAt ? new Date(cust.createdAt).toLocaleDateString() : "-",
          enquiredFor: latestFollowUp?.enquiredFor || cust.enquiredFor || "-",
          city: cust.city || "-",
          assignedBranch: cust.branchDoc?.name || "-",
          handledByAssociates: handledBy,
          currentLeadStatus: latestFollowUp?.status || cust.status || "New",
          currentLeadOwner: cust.assignedTo || "unassigned",
          latestRemark: remarks,
          lastFollowUpDate: latestFollowUp?.date ? new Date(latestFollowUp.date).toLocaleDateString() : "-",
          lastActivity: cust.lastInteractionAt || cust.updatedAt || cust.createdAt,
          createdDate: cust.createdAt,
          timeline: customerTimeline
        };
      });

      return NextResponse.json({
        success: true,
        customerReportRows,
        pagination: {
          total: totalCount,
          page,
          limit: limitParam === "all" ? totalCount : limit,
          pages: limitParam === "all" ? 1 : Math.ceil(totalCount / limit)
        }
      });
    }

    // ==========================================
    // ACTION: ASSOCIATE REPORT
    // ==========================================
    if (action === "associateReport") {
      const page = parseInt(searchParams.get("page")) || 1;
      const limitParam = searchParams.get("limit") || "25";
      const limit = limitParam === "all" ? 999999 : parseInt(limitParam);

      const baseFilters = { active: true };
      const sessionUserId = new mongoose.Types.ObjectId(session.user.id);

      // Exclude logged-in user and superAdmins by default from baseFilters
      baseFilters._id = { $ne: sessionUserId };
      baseFilters.role = { $ne: "superAdmin" };

      // Security validations & Branch matching (supports String and ObjectId)
      if (!isSuperAdmin) {
        if (adminBranch) {
          baseFilters.branch = { $in: [adminBranch, new mongoose.Types.ObjectId(adminBranch)] };
        }
      } else if (branchFilter !== "all" && branchFilter !== "none" && /^[0-9a-fA-F]{24}$/.test(branchFilter)) {
        baseFilters.branch = { $in: [branchFilter, new mongoose.Types.ObjectId(branchFilter)] };
      }

      // Filter by Department and Role
      if (!isSuperAdmin) {
        const adminAllowedDepts = ["telecalling", "support"];
        if (departmentFilter !== "all" && adminAllowedDepts.includes(departmentFilter)) {
          baseFilters.department = departmentFilter;
        } else if (departmentFilter !== "all") {
          baseFilters.department = { $in: adminAllowedDepts };
        }

        const adminAllowedRoles = ["doctor"];
        if (roleFilter !== "all" && adminAllowedRoles.includes(roleFilter)) {
          baseFilters.role = roleFilter;
        } else if (roleFilter !== "all") {
          baseFilters.role = { $in: adminAllowedRoles };
        }
      } else {
        if (departmentFilter !== "all") {
          baseFilters.department = departmentFilter;
        }
        if (roleFilter !== "all") {
          baseFilters.role = roleFilter;
        }
      }

      if (associateFilter !== "all" && /^[0-9a-fA-F]{24}$/.test(associateFilter)) {
        baseFilters._id = new mongoose.Types.ObjectId(associateFilter);
      }

      // Search (Associate Name, Phone, Customer Name)
      let searchUserIds = [];
      if (search) {
        const searchRegex = { $regex: search, $options: "i" };
        const matchingLeads = await Lead.find({
          $or: [
            { name: searchRegex },
            { phone: searchRegex }
          ]
        }).select("associateId assignedTo leads.associateId").lean();

        matchingLeads.forEach(lead => {
          if (lead.associateId) searchUserIds.push(lead.associateId);
          if (lead.leads) {
            lead.leads.forEach(f => {
              if (f.associateId) searchUserIds.push(f.associateId);
            });
          }
        });
      }

      if (search) {
        const searchRegex = { $regex: search, $options: "i" };
        const searchConditions = [
          { name: searchRegex },
          { email: searchRegex },
          { number: searchRegex }
        ];

        if (searchUserIds.length > 0) {
          const objectIds = searchUserIds
            .filter(id => /^[0-9a-fA-F]{24}$/.test(id))
            .map(id => new mongoose.Types.ObjectId(id));
          if (objectIds.length > 0) {
            searchConditions.push({ _id: { $in: objectIds } });
          }
        }
        baseFilters.$and = baseFilters.$and || [];
        baseFilters.$and.push({ $or: searchConditions });
      }

      // Final match stage using OR condition for includeMe
      let associateMatchStage = {};
      if (includeMe) {
        associateMatchStage = {
          $or: [
            { _id: sessionUserId },
            baseFilters
          ]
        };
      } else {
        associateMatchStage = baseFilters;
      }

      const totalCount = await User.countDocuments(associateMatchStage);

      const usersQuery = User.find(associateMatchStage);
      if (limitParam !== "all") {
        usersQuery.skip((page - 1) * limit).limit(limit);
      }
      const matchingUsers = await usersQuery.lean();

      const userIds = matchingUsers.map(u => u._id.toString());
      const userNames = matchingUsers.map(u => u.name);

      // Find leads handled by matching users
      const leads = await Lead.find({
        $or: [
          { associateId: { $in: userIds } },
          { assignedTo: { $in: userNames } },
          { "leads.associateId": { $in: userIds } }
        ]
      }).lean();

      // Find message history
      const messages = await Message.find({
        $or: [
          { sendBy: { $in: userIds } },
          { associateName: { $in: userNames } }
        ]
      }).sort({ timestamp: 1 }).lean();

      const inboundGrouped = {};
      messages.forEach((m) => {
        if (m.direction === "INBOUND") {
          if (!inboundGrouped[m.phone]) inboundGrouped[m.phone] = [];
          inboundGrouped[m.phone].push(m);
        }
      });

      const userResponseTracker = {};
      userIds.forEach((uid) => {
        userResponseTracker[uid] = { sum: 0, count: 0 };
      });

      messages.forEach((outbound) => {
        if (outbound.direction === "OUTBOUND") {
          const handlerId = outbound.sendBy?.toString();
          const inbounds = inboundGrouped[outbound.phone] || [];
          let matchedInbound = null;
          for (let i = inbounds.length - 1; i >= 0; i--) {
            const inbound = inbounds[i];
            if (new Date(inbound.timestamp) < new Date(outbound.timestamp)) {
              const diff = new Date(outbound.timestamp) - new Date(inbound.timestamp);
              if (diff <= 24 * 60 * 60 * 1000) matchedInbound = inbound;
              break;
            }
          }
          if (matchedInbound && userResponseTracker[handlerId]) {
            userResponseTracker[handlerId].sum += new Date(outbound.timestamp) - new Date(matchedInbound.timestamp);
            userResponseTracker[handlerId].count += 1;
          }
        }
      });

      const associatePerformanceSummary = matchingUsers.map((user) => {
        const uid = user._id.toString();
        const name = user.name;

        const associateLeads = leads.filter(l => l.associateId === uid || l.assignedTo === name || l.leads?.some(fu => fu.associateId === uid));
        const customersHandledCount = new Set(associateLeads.map(l => l.phone)).size;

        let newLeadsClosed = 0;
        let existingLeadsClosed = 0;
        let pending = 0;
        let followUps = 0;
        let notInterested = 0;

        associateLeads.forEach((lead) => {
          const closures = (lead.leads || [])
            .filter(fu => fu.status === "Closed")
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          if (!lead.isClosed) {
            pending++;
          }

          const history = lead.leads || [];
          history.forEach((fu) => {
            const fuDate = new Date(fu.date);
            const isHandler = fu.associateId === uid || fu.associateName === name;
            
            if (isHandler && (!startDate || fuDate >= startDate) && (!endDate || fuDate <= endDate)) {
              if (fu.status === "Follow Up") {
                followUps++;
              }
              if (fu.status === "Not Interested") {
                notInterested++;
              }
              if (fu.status === "Closed") {
                const matchedIdx = closures.findIndex(
                  c => c._id?.toString() === fu._id?.toString() ||
                       new Date(c.date).getTime() === new Date(fu.date).getTime()
                );
                const leadSequence = matchedIdx !== -1 ? matchedIdx + 1 : 1;
                if (leadSequence === 1) {
                  newLeadsClosed++;
                } else {
                  existingLeadsClosed++;
                }
              }
            }
          });
        });

        const tracker = userResponseTracker[uid];
        const avgResponseSeconds = tracker && tracker.count > 0 ? Math.round(tracker.sum / tracker.count / 1000) : 0;
        const averageResponseTime = formatSeconds(avgResponseSeconds);

        const associateCustomerHistory = [];
        associateLeads.forEach((lead) => {
          const history = lead.leads || [];
          history.forEach((fu) => {
            const isHandler = fu.associateId === uid || fu.associateName === name;
            if (isHandler) {
              associateCustomerHistory.push({
                customerName: resolveCustomerDisplayName(lead),
                phone: lead.phone,
                enquiredFor: fu.enquiredFor || lead.enquiredFor || "-",
                leadStatus: fu.status || "New",
                remark: fu.overAllRemarks || fu.note || "-",
                latestActivityDate: fu.date,
                date: fu.date
              });
            }
          });
        });
        associateCustomerHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

        return {
          associateId: uid,
          associateName: name,
          branch: branchMap[user.branch?.toString()] || user.branch || "-",
          role: user.role || "-",
          department: user.department || "-",
          customersHandled: customersHandledCount,
          followUps,
          closed: newLeadsClosed + existingLeadsClosed,
          notInterested,
          pending,
          newLeadsClosed,
          existingLeadsClosed,
          averageResponseTime,
          lastActivity: user.updatedAt || user.createdAt,
          associateCustomerHistory
        };
      });

      // Sort summary rows (Associate Name, Customers, Date)
      const sortBy = searchParams.get("sortBy") || "associateName";
      const sortOrder = searchParams.get("sortOrder") || "asc";
      const sortDirection = sortOrder === "asc" ? 1 : -1;

      associatePerformanceSummary.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        if (typeof valA === "string") {
          return valA.localeCompare(valB) * sortDirection;
        }
        return (valA - valB) * sortDirection;
      });

      return NextResponse.json({
        success: true,
        associatePerformanceSummary,
        pagination: {
          total: totalCount,
          page,
          limit: limitParam === "all" ? totalCount : limit,
          pages: limitParam === "all" ? 1 : Math.ceil(totalCount / limit)
        }
      });
    }

    return NextResponse.json({ error: "Invalid action type." }, { status: 400 });

  } catch (error) {
    console.error("Reports API Error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate report metrics." }, { status: 500 });
  }
}