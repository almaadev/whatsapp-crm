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
import { resolveLeadStatus } from "@/shared/utils/leadStatusResolver";
import { getOperationalDateBounds } from "@/shared/utils/dateRangeResolver";

export const dynamic = "force-dynamic";

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

      // 1. Build Match Stage for Lead
      const leadMatchStage = {};

      // Role boundary security
      if (!isSuperAdmin) {
        // Find customers belonging to admin's branch
        const branchCustomers = await Customer.find({ branchId: new mongoose.Types.ObjectId(adminBranch) }).select("_id").lean();
        const customerIds = branchCustomers.map(c => c._id);
        leadMatchStage.customerId = { $in: customerIds };
      } else if (branchFilter !== "all" && branchFilter !== "none" && /^[0-9a-fA-F]{24}$/.test(branchFilter)) {
        const branchCustomers = await Customer.find({ branchId: new mongoose.Types.ObjectId(branchFilter) }).select("_id").lean();
        const customerIds = branchCustomers.map(c => c._id);
        leadMatchStage.customerId = { $in: customerIds };
      }

      // Department & Role permission checks
      const userFilters = {};
      if (!isSuperAdmin) {
        const adminAllowedDepts = ["telecalling", "support"];
        if (departmentFilter !== "all" && adminAllowedDepts.includes(departmentFilter)) {
          userFilters.department = departmentFilter;
        } else if (departmentFilter !== "all") {
          userFilters.department = { $in: adminAllowedDepts };
        }

        const adminAllowedRoles = ["doctor"];
        if (roleFilter !== "all" && adminAllowedRoles.includes(roleFilter)) {
          userFilters.role = roleFilter;
        } else if (roleFilter !== "all") {
          userFilters.role = { $in: adminAllowedRoles };
        }
      } else {
        if (departmentFilter !== "all") {
          userFilters.department = departmentFilter;
        }
        if (roleFilter !== "all") {
          userFilters.role = roleFilter;
        }
      }

      if (associateFilter !== "all" && /^[0-9a-fA-F]{24}$/.test(associateFilter)) {
        userFilters._id = new mongoose.Types.ObjectId(associateFilter);
      }

      if (Object.keys(userFilters).length > 0) {
        const matchedUsers = await User.find(userFilters).select("name _id").lean();
        const matchedNames = matchedUsers.map(u => u.name);
        const matchedUserIds = matchedUsers.map(u => u._id.toString());
        leadMatchStage.$or = [
          { associateId: { $in: matchedUserIds } },
          { assignedTo: { $in: matchedNames } },
          { "leads.associateId": { $in: matchedUserIds } }
        ];
      }

      // Search term
      if (search) {
        const searchRegex = new RegExp(search, "i");
        const matchedCustomers = await Customer.find({
          $or: [
            { name: searchRegex },
            { phone: searchRegex },
            { city: searchRegex },
            { enquiredFor: searchRegex },
            { assignedTo: searchRegex }
          ]
        }).select("_id").lean();
        const customerIds = matchedCustomers.map(c => c._id);
        
        if (leadMatchStage.customerId) {
          const branchIdsSet = new Set(leadMatchStage.customerId.$in.map(id => id.toString()));
          const searchIds = customerIds.filter(id => branchIdsSet.has(id.toString()));
          leadMatchStage.customerId = { $in: searchIds };
        } else {
          leadMatchStage.customerId = { $in: customerIds };
        }
      }

      // Date range filtering
      if (startDate || endDate) {
        const dateFilter = {};
        if (startDate) dateFilter.$gte = startDate;
        if (endDate) dateFilter.$lte = endDate;
        
        leadMatchStage.$or = leadMatchStage.$or || [];
        leadMatchStage.$or.push(
          { createdAt: dateFilter },
          { "leads.date": dateFilter }
        );
      }

      // Query database
      const rawLeads = await Lead.find(leadMatchStage)
        .populate({
          path: "customerId",
          populate: {
            path: "branchId",
            model: "Branch"
          }
        })
        .lean();

      // Populate branches cache
      const branches = await Branch.find().lean();
      const branchMap = {};
      branches.forEach(b => {
        branchMap[b._id.toString()] = b.name;
      });

      // Group by customerId to ensure: ONE customer = ONE row
      const customerRowsMap = new Map();

      rawLeads.forEach(lead => {
        const customer = lead.customerId;
        if (!customer) return;

        const customerIdStr = customer._id.toString();
        
        // Filter followups by date range
        const relevantFollowups = (lead.leads || []).filter(fu => {
          const fuDate = new Date(fu.date);
          return (!startDate || fuDate >= startDate) && (!endDate || fuDate <= endDate);
        });

        // Skip if outside range (if date range is filtered)
        const leadCreatedInRange = (!startDate || lead.createdAt >= startDate) && (!endDate || lead.createdAt <= endDate);
        if ((startDate || endDate) && !leadCreatedInRange && relevantFollowups.length === 0) {
          return;
        }

        // Sort chronologically
        relevantFollowups.sort((a, b) => new Date(a.date) - new Date(b.date));

        const latestEvent = relevantFollowups.length > 0 ? relevantFollowups[relevantFollowups.length - 1] : null;

        // Follow up date & remark
        const followUpEvents = relevantFollowups.filter(e => e.status === "Follow Up");
        const latestFollowUpEvent = followUpEvents.length > 0 ? followUpEvents[followUpEvents.length - 1] : null;

        // Closed date & remark
        const closedEvents = relevantFollowups.filter(e => e.status === "Closed");
        const latestClosedEvent = closedEvents.length > 0 ? closedEvents[closedEvents.length - 1] : null;

        // Current status is resolved lead status of the latest lead
        const currentLeadStatus = resolveLeadStatus(lead);
        const currentPriority = latestEvent?.priority || customer.priority || "Medium";

        const handHistory = lead.handledByHistory?.map(h => h.associateName) || [];
        const followupHandlers = (lead.leads || []).map(f => f.associateName).filter(Boolean);
        const leadHandlers = Array.from(new Set([lead.assignedTo, ...handHistory, ...followupHandlers].filter(name => name && name !== "unassigned" && name !== "System")));

        const customerName = resolveCustomerDisplayName({ customer, phone: customer.phone });
        const phone = customer.phone;

        if (!customerRowsMap.has(customerIdStr)) {
          customerRowsMap.set(customerIdStr, {
            id: customerIdStr,
            customerId: customerIdStr,
            customerName,
            phone,
            firstEnquiryDate: customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : "-",
            enquiredFor: latestEvent?.enquiredFor || customer.enquiredFor || "-",
            city: customer.city || "-",
            assignedBranch: branchMap[customer.branchId?.toString()] || "-",
            handledByAssociates: leadHandlers.join(", ") || "-",
            currentLeadStatus,
            currentLeadOwner: lead.assignedTo || customer.assignedTo || "unassigned",
            latestRemark: latestEvent?.overAllRemarks || latestEvent?.note || customer.remarks || "-",
            lastFollowUpDate: latestFollowUpEvent?.date ? new Date(latestFollowUpEvent.date).toLocaleDateString() : "-",
            lastActivity: customer.lastInteractionAt || customer.updatedAt || customer.createdAt,
            createdDate: customer.createdAt,
            timeline: (lead.leads || []).map(fu => ({
              associate: fu.associateName || "System",
              action: fu.status || "-",
              remark: fu.overAllRemarks || fu.note || "-",
              date: fu.date ? new Date(fu.date).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "-"
            })).reverse(),
            // Contract fields
            branchId: customer.branchId?.toString() || "",
            branchName: branchMap[customer.branchId?.toString()] || "-",
            associateId: lead.associateId || "",
            associateName: lead.assignedTo || "unassigned",
            associateNames: leadHandlers,
            leadStatus: currentLeadStatus,
            priority: currentPriority,
            followUpDate: latestFollowUpEvent ? latestFollowUpEvent.date : null,
            followUpRemark: latestFollowUpEvent ? (latestFollowUpEvent.overAllRemarks || latestFollowUpEvent.note || "-") : "-",
            closedDate: latestClosedEvent ? latestClosedEvent.date : null,
            closedRemark: latestClosedEvent ? (latestClosedEvent.overAllRemarks || latestClosedEvent.note || "-") : "-",
            latestActivityDate: latestEvent?.date || lead.updatedAt || lead.createdAt
          });
        } else {
          // Merge lead information
          const existing = customerRowsMap.get(customerIdStr);
          existing.associateNames = Array.from(new Set([...existing.associateNames, ...leadHandlers]));
          existing.handledByAssociates = existing.associateNames.join(", ") || "-";

          const isNewer = new Date(lead.updatedAt || lead.createdAt) > new Date(existing.latestActivityDate || 0);
          if (isNewer) {
            existing.currentLeadStatus = currentLeadStatus;
            existing.leadStatus = currentLeadStatus;
            existing.priority = currentPriority;
            existing.currentLeadOwner = lead.assignedTo || existing.currentLeadOwner;
            existing.associateId = lead.associateId || existing.associateId;
            existing.associateName = lead.assignedTo || existing.associateName;
            if (latestEvent?.enquiredFor) {
              existing.enquiredFor = latestEvent.enquiredFor;
            }
          }

          if (latestFollowUpEvent) {
            if (!existing.followUpDate || new Date(latestFollowUpEvent.date) > new Date(existing.followUpDate)) {
              existing.followUpDate = latestFollowUpEvent.date;
              existing.followUpRemark = latestFollowUpEvent.overAllRemarks || latestFollowUpEvent.note || "-";
              existing.lastFollowUpDate = new Date(latestFollowUpEvent.date).toLocaleDateString();
            }
          }

          if (latestClosedEvent) {
            if (!existing.closedDate || new Date(latestClosedEvent.date) > new Date(existing.closedDate)) {
              existing.closedDate = latestClosedEvent.date;
              existing.closedRemark = latestClosedEvent.overAllRemarks || latestClosedEvent.note || "-";
            }
          }

          if (latestEvent?.date && new Date(latestEvent.date) > new Date(existing.latestActivityDate)) {
            existing.latestActivityDate = latestEvent.date;
            existing.latestRemark = latestEvent.overAllRemarks || latestEvent.note || existing.latestRemark;
          }

          // Merge timeline
          const newTimeline = (lead.leads || []).map(fu => ({
            associate: fu.associateName || "System",
            action: fu.status || "-",
            remark: fu.overAllRemarks || fu.note || "-",
            date: fu.date ? new Date(fu.date).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "-"
          })).reverse();
          existing.timeline = Array.from(new Map([...existing.timeline, ...newTimeline].map(item => [item.date + item.action + item.remark, item])).values());
        }
      });

      const customerReportRows = Array.from(customerRowsMap.values());

      // Server-side Sorting
      const sortBy = searchParams.get("sortBy") || "date";
      const sortOrder = searchParams.get("sortOrder") || "desc";
      const sortDirection = sortOrder === "asc" ? 1 : -1;

      customerReportRows.sort((a, b) => {
        let valA = a[sortBy] || "";
        let valB = b[sortBy] || "";
        if (sortBy === "customerName") {
          valA = a.customerName;
          valB = b.customerName;
        } else if (sortBy === "associate") {
          valA = a.currentLeadOwner;
          valB = b.currentLeadOwner;
        } else if (sortBy === "status") {
          valA = a.currentLeadStatus;
          valB = b.currentLeadStatus;
        } else if (sortBy === "branch") {
          valA = a.assignedBranch;
          valB = b.assignedBranch;
        } else {
          valA = new Date(a.createdDate || 0);
          valB = new Date(b.createdDate || 0);
        }
        if (typeof valA === "string") {
          return valA.localeCompare(valB) * sortDirection;
        }
        return (valA - valB) * sortDirection;
      });

      // Pagination Count
      const totalCount = customerReportRows.length;

      let paginatedRows = customerReportRows;
      if (limitParam !== "all") {
        paginatedRows = customerReportRows.slice((page - 1) * limit, page * limit);
      }

      return NextResponse.json({
        success: true,
        customerReportRows: paginatedRows,
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
      })
      .populate("customerId")
      .lean();

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

      // Populate branches cache
      const branches = await Branch.find().lean();
      const branchMap = {};
      branches.forEach(b => {
        branchMap[b._id.toString()] = b.name;
      });

      const associatePerformanceSummary = matchingUsers.map((user) => {
        const uid = user._id.toString();
        const name = user.name;

        // Filter leads where this associate is involved
        const associateLeads = leads.filter(l => 
          l.associateId === uid || 
          l.assignedTo === name || 
          l.leads?.some(fu => fu.associateId === uid || fu.associateName === name)
        );

        // Group by customer to ensure: ONE customer = ONE row
        const customerRowsMap = new Map();

        let followUps = 0;
        let notInterested = 0;
        let newLeadsClosed = 0;
        let existingLeadsClosed = 0;
        let pending = 0;

        associateLeads.forEach((lead) => {
          const customer = lead.customerId;
          if (!customer) return;

          const customerIdStr = customer._id.toString();

          // Filter followups by date range AND handler
          const relevantEvents = (lead.leads || []).filter(fu => {
            const fuDate = new Date(fu.date);
            const isHandler = fu.associateId === uid || fu.associateName === name;
            const matchesDate = (!startDate || fuDate >= startDate) && (!endDate || fuDate <= endDate);
            return isHandler && matchesDate;
          });

          // Metrics calculation (independent of date range for pending, but followups/closed are filtered)
          if (!lead.isClosed && (lead.associateId === uid || lead.assignedTo === name)) {
            pending++;
          }

          const closures = (lead.leads || [])
            .filter(fu => fu.status === "Closed")
            .sort((a, b) => new Date(a.date) - new Date(b.date));

          relevantEvents.forEach((fu) => {
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
          });

          // Group by customer for history table
          if (relevantEvents.length > 0) {
            // Sort chronologically
            relevantEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

            const latestEvent = relevantEvents[relevantEvents.length - 1];

            // Filter for Follow Up status events
            const followUpEvents = relevantEvents.filter(e => e.status === "Follow Up");
            const latestFollowUpEvent = followUpEvents.length > 0 ? followUpEvents[followUpEvents.length - 1] : null;

            // Filter for Closed status events
            const closedEvents = relevantEvents.filter(e => e.status === "Closed");
            const latestClosedEvent = closedEvents.length > 0 ? closedEvents[closedEvents.length - 1] : null;

            const handHistory = lead.handledByHistory?.map(h => h.associateName) || [];
            const followupHandlers = (lead.leads || []).map(f => f.associateName).filter(Boolean);
            const leadHandlers = Array.from(new Set([lead.assignedTo, ...handHistory, ...followupHandlers].filter(n => n && n !== "unassigned" && n !== "System")));

            const customerName = resolveCustomerDisplayName({ customer, phone: customer.phone });
            const phone = customer.phone;

            if (!customerRowsMap.has(customerIdStr)) {
              customerRowsMap.set(customerIdStr, {
                id: customerIdStr,
                customerId: customerIdStr,
                customerName,
                phone,
                enquiredFor: latestEvent?.enquiredFor || customer.enquiredFor || "-",
                leadStatus: resolveLeadStatus(lead),
                priority: latestEvent?.priority || customer.priority || "Medium",
                followUpDate: latestFollowUpEvent ? latestFollowUpEvent.date : null,
                followUpRemark: latestFollowUpEvent ? (latestFollowUpEvent.overAllRemarks || latestFollowUpEvent.note || "-") : "-",
                closedDate: latestClosedEvent ? latestClosedEvent.date : null,
                closedRemark: latestClosedEvent ? (latestClosedEvent.overAllRemarks || latestClosedEvent.note || "-") : "-",
                latestActivityDate: latestEvent?.date || null,
                date: latestEvent?.date || null,
                timeline: (lead.leads || []).map(fu => ({
                  associate: fu.associateName || "System",
                  action: fu.status || "-",
                  remark: fu.overAllRemarks || fu.note || "-",
                  date: fu.date ? new Date(fu.date).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "-"
                })).reverse(),
                // Contract fields
                branchId: customer.branchId?.toString() || "",
                branchName: branchMap[customer.branchId?.toString()] || "-",
                associateId: uid,
                associateName: name,
                associateNames: leadHandlers
              });
            } else {
              // Merge multiple leads for the same customer
              const existing = customerRowsMap.get(customerIdStr);
              
              if (latestFollowUpEvent) {
                if (!existing.followUpDate || new Date(latestFollowUpEvent.date) > new Date(existing.followUpDate)) {
                  existing.followUpDate = latestFollowUpEvent.date;
                  existing.followUpRemark = latestFollowUpEvent.overAllRemarks || latestFollowUpEvent.note || "-";
                }
              }

              if (latestClosedEvent) {
                if (!existing.closedDate || new Date(latestClosedEvent.date) > new Date(existing.closedDate)) {
                  existing.closedDate = latestClosedEvent.date;
                  existing.closedRemark = latestClosedEvent.overAllRemarks || latestClosedEvent.note || "-";
                }
              }

              if (latestEvent?.date && new Date(latestEvent.date) > new Date(existing.latestActivityDate)) {
                existing.latestActivityDate = latestEvent.date;
                existing.date = latestEvent.date;
                existing.priority = latestEvent.priority || existing.priority;
                existing.enquiredFor = latestEvent.enquiredFor || existing.enquiredFor;
              }
            }
          }
        });

        const associateCustomerHistory = Array.from(customerRowsMap.values());
        // Sort history by date descending
        associateCustomerHistory.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        const customersHandledCount = associateCustomerHistory.length;

        // Average response time tracking
        const tracker = userResponseTracker[uid];
        const avgResponseSeconds = tracker && tracker.count > 0 ? Math.round(tracker.sum / tracker.count / 1000) : 0;
        const averageResponseTime = formatSeconds(avgResponseSeconds);

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