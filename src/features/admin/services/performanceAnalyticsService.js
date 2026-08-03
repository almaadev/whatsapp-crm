import mongoose from "mongoose";
import User from "@/shared/models/User";
import Lead from "@/shared/models/Lead";
import Customer from "@/shared/models/Customer";
import Message from "@/shared/models/Message";
import Branch from "@/shared/models/Branch";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";

/**
 * Calculates start and end Date objects based on preset values or custom inputs.
 */
export function getOperationalDateBounds(dateRange, customStart, customEnd) {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  if (dateRange === "today") {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
  } else if (dateRange === "yesterday") {
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
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
  } else if (dateRange === "custom" && customStart) {
    startDate = new Date(customStart);
    endDate = customEnd ? new Date(customEnd) : new Date();
  } else {
    // Default to this month
    startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
    endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
  }

  return { startDate, endDate };
}

/**
 * Main analytics compiler that executes MongoDB aggregations and constructs the Response DTO.
 */
export async function getPerformanceAnalytics({
  dateRange,
  customStart,
  customEnd,
  branchFilter,
  departmentFilter,
  roleFilter,
  associateStatus,
  leadTypeFilter,
  associateFilter,
  leadStatus,
  isSuperAdmin,
  adminBranch,
  sessionUserId
}) {
  const { startDate, endDate } = getOperationalDateBounds(dateRange, customStart, customEnd);

  // Fetch branches
  let branchesQuery = {};
  if (!isSuperAdmin) {
    if (adminBranch) {
      branchesQuery = {
        $or: [
          { _id: adminBranch },
          { name: adminBranch }
        ]
      };
    } else {
      branchesQuery = { _id: null };
    }
  }
  const branches = await Branch.find(branchesQuery).lean();
  const branchMap = {};
  branches.forEach((b) => {
    branchMap[b._id.toString()] = b.name;
  });

  // Query users (excl. SuperAdmin)
  const userQuery = { role: { $ne: "superAdmin" } };
  if (branchFilter !== "all" && branchFilter !== "none") {
    userQuery.branch = { $in: [branchFilter, new mongoose.Types.ObjectId(branchFilter)] };
  } else if (!isSuperAdmin && adminBranch) {
    userQuery.branch = { $in: [adminBranch, new mongoose.Types.ObjectId(adminBranch)] };
  }
  if (departmentFilter !== "all") {
    userQuery.department = departmentFilter;
  }
  if (roleFilter !== "all") {
    userQuery.role = roleFilter;
  }
  if (associateFilter !== "all") {
    userQuery._id = associateFilter;
  }

  const allMatchingUsers = await User.find(userQuery).lean();

  // Socket presence values
  const onlineUsersList = Array.from(global.onlineUsers?.values() || []);
  const activeChatHandlersList = Array.from(global.activeChatHandlers?.values() || []);

  const onlineUserIds = new Set(onlineUsersList.map((ou) => ou.userId?.toString()));
  const busyUserIds = new Set(activeChatHandlersList.map((ah) => ah.userId?.toString()));

  // Filter users by presence status if specified
  let users = allMatchingUsers;
  if (associateStatus !== "all") {
    users = allMatchingUsers.filter((u) => {
      const uid = u._id.toString();
      const isOnline = onlineUserIds.has(uid);
      const isBusy = busyUserIds.has(uid);

      if (associateStatus === "online") return isOnline;
      if (associateStatus === "offline") return !isOnline;
      return true;
    });
  }

  const userIds = users.map((u) => u._id.toString());
  const userNames = users.map((u) => u.name);

  // Retrieve customer leads
  const leadQuery = {
    $or: [
      { associateId: { $in: userIds } },
      { assignedTo: { $in: userNames } },
      { "leads.associateId": { $in: userIds } },
    ]
  };

  const leads = await Lead.find(leadQuery).lean();

  // Retrieve messages for response times
  const outboundMessages = await Message.find({
    direction: "OUTBOUND",
    timestamp: { $gte: startDate, $lte: endDate },
    $or: [{ sendBy: { $in: userIds } }, { associateName: { $in: userNames } }],
  }).lean();

  const outboundPhones = Array.from(new Set(outboundMessages.map((m) => m.phone)));
  const inboundMessages = await Message.find({
    direction: "INBOUND",
    phone: { $in: outboundPhones },
    timestamp: { $gte: new Date(startDate.getTime() - 24 * 60 * 60 * 1000), $lte: endDate },
  }).sort({ timestamp: 1 }).lean();

  const inboundGrouped = {};
  inboundMessages.forEach((m) => {
    if (!inboundGrouped[m.phone]) inboundGrouped[m.phone] = [];
    inboundGrouped[m.phone].push(m);
  });

  const responseTracker = {};
  users.forEach((u) => {
    responseTracker[u._id.toString()] = { sum: 0, count: 0 };
    responseTracker[u.name] = responseTracker[u._id.toString()];
  });

  outboundMessages.forEach((outbound) => {
    const handlerId = outbound.sendBy?.toString();
    const handlerName = outbound.associateName;
    const outboundTime = new Date(outbound.timestamp);

    const tracker = responseTracker[handlerId] || responseTracker[handlerName];
    if (!tracker) return;

    const inbounds = inboundGrouped[outbound.phone] || [];
    let matchedInbound = null;
    for (let i = inbounds.length - 1; i >= 0; i--) {
      const inbound = inbounds[i];
      const inboundTime = new Date(inbound.timestamp);
      if (inboundTime < outboundTime) {
        const diff = outboundTime - inboundTime;
        if (diff <= 24 * 60 * 60 * 1000) {
          matchedInbound = inbound;
        }
        break;
      }
    }

    if (matchedInbound) {
      const delay = outboundTime - new Date(matchedInbound.timestamp);
      tracker.sum += delay;
      tracker.count += 1;
    }
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Compile Associate Analytics
  const associateAnalytics = users.map((user) => {
    const uid = user._id.toString();
    const name = user.name;
    const isOnline = onlineUserIds.has(uid);

    let userLeads = leads.filter(
      (lead) => lead.associateId === uid || lead.assignedTo === name
    );

    // Apply lead status filters if requested
    if (leadStatus !== "all") {
      if (leadStatus === "closed") {
        userLeads = userLeads.filter(l => l.isClosed);
      } else if (leadStatus === "followUp") {
        userLeads = userLeads.filter(l => l.status === "Follow Up" && !l.isClosed);
      } else if (leadStatus === "new") {
        userLeads = userLeads.filter(l => l.status === "New" && !l.isClosed);
      } else if (leadStatus === "notInterested") {
        userLeads = userLeads.filter(l => l.status === "Not Interested" && !l.isClosed);
      }
    }

    // Filter by lead type
    if (leadTypeFilter !== "all") {
      userLeads = userLeads.filter(l => {
        const latestFU = l.leads && l.leads.length > 0 ? l.leads[l.leads.length - 1] : null;
        const routeType = latestFU?.leadType || l.source;
        return routeType?.toLowerCase() === leadTypeFilter.toLowerCase();
      });
    }

    let customersHandledToday = 0;
    let customersHandledMonth = 0;
    let newLeads = 0;
    let existingLeads = 0;
    let closed = 0;
    let followUps = 0;
    let pendingFollowUps = 0;
    let notInterested = 0;

    userLeads.forEach((lead) => {
      const closures = (lead.leads || [])
        .filter((fu) => fu.status === "Closed")
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      const hasTodayInteraction = (lead.leads || []).some(fu => new Date(fu.date) >= todayStart);
      if (hasTodayInteraction) {
        customersHandledToday++;
      }
      customersHandledMonth++;

      if (!lead.isClosed) {
        pendingFollowUps++;
      }

      const history = lead.leads || [];
      history.forEach((followUp) => {
        const followUpDate = new Date(followUp.date);
        const isWithinRange = followUpDate >= startDate && followUpDate <= endDate;
        const isHandler = followUp.associateId === uid || followUp.associateName === name;

        if (isHandler && isWithinRange) {
          if (followUp.status === "Follow Up") {
            followUps++;
          } else if (followUp.status === "Not Interested") {
            notInterested++;
          } else if (followUp.status === "Closed") {
            closed++;
            const matchedIdx = closures.findIndex(
              (c) => c._id?.toString() === followUp._id?.toString() ||
                     new Date(c.date).getTime() === new Date(followUp.date).getTime()
            );
            if (matchedIdx === 0) {
              newLeads++;
            } else {
              existingLeads++;
            }
          }
        }
      });
    });

    const rt = responseTracker[uid];
    const avgResponseSeconds = rt && rt.count > 0 ? Math.round(rt.sum / rt.count / 1000) : 0;
    let averageResponseTime = "--";
    if (avgResponseSeconds > 0) {
      const m = Math.floor(avgResponseSeconds / 60);
      const s = avgResponseSeconds % 60;
      averageResponseTime = m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    const currentActiveChatCount = activeChatHandlersList.filter(ah => ah.userId === uid).length;

    return {
      associateId: uid,
      associateName: name,
      role: user.role || "-",
      department: user.department || "-",
      branch: branchMap[user.branch?.toString()] || user.branch || "-",
      status: isOnline ? "Online" : "Offline",
      customersHandledToday,
      customersHandledMonth,
      newLeads,
      existingLeads,
      closed,
      followUps,
      pendingFollowUps,
      notInterested,
      averageResponseTime,
      avgResponseSeconds,
      lastActive: user.updatedAt || user.createdAt,
      currentActiveChatCount
    };
  });

  // Compile Branch Analytics
  const branchAnalytics = await Promise.all(branches.map(async (b) => {
    const branchName = b.name;
    const branchUsers = allMatchingUsers.filter(u => {
      const uBranch = u.branch?.toString();
      return uBranch === b._id.toString() || uBranch === branchName;
    });

    const totalAssociates = branchUsers.length;
    const onlineAssociates = branchUsers.filter(u => onlineUserIds.has(u._id.toString())).length;

    // Received/Assigned counts inside branch
    const branchCustomers = await Customer.find({ branchId: b._id }).lean();
    const customersReceived = branchCustomers.length;
    const customersAssigned = branchCustomers.filter(c => c.assignedTo && c.assignedTo !== "unassigned").length;

    const bUserIds = branchUsers.map(u => u._id.toString());
    const bUserNames = branchUsers.map(u => u.name);

    const branchLeads = leads.filter(l => bUserIds.includes(l.associateId) || bUserNames.includes(l.assignedTo));
    const customersClosed = branchLeads.filter(l => l.isClosed).length;
    const pendingFollowUps = branchLeads.filter(l => !l.isClosed).length;

    const conversionRate = customersAssigned > 0 ? Math.round((customersClosed / customersAssigned) * 100) : 0;

    return {
      branchName,
      totalAssociates,
      onlineAssociates,
      customersReceived,
      customersAssigned,
      customersClosed,
      pendingFollowUps,
      conversionRate
    };
  }));

  // Compile Lead Analytics
  let newLeadsCount = 0;
  let existingLeadsCount = 0;
  let reopenedLeadsCount = 0;
  let closedLeadsCount = 0;
  let followUpsCount = 0;
  let notInterestedCount = 0;
  let lostLeadsCount = 0;

  leads.forEach((l) => {
    if (l.isClosed && new Date(l.closedAt || l.updatedAt) >= startDate && new Date(l.closedAt || l.updatedAt) <= endDate) {
      closedLeadsCount++;
    }
    if (l.status === "Not Interested") {
      lostLeadsCount++;
    }

    const history = l.leads || [];
    history.forEach((fu, index) => {
      const fuDate = new Date(fu.date);
      if (fuDate >= startDate && fuDate <= endDate) {
        if (fu.status === "Follow Up") {
          followUpsCount++;
        } else if (fu.status === "Not Interested") {
          notInterestedCount++;
        } else if (fu.status === "Closed") {
          if (index === 0) newLeadsCount++;
          else existingLeadsCount++;
        } else if (fu.status === "Reopened Chat" || fu.status === "Chat Reopened") {
          reopenedLeadsCount++;
        }
      }
    });
  });

  const leadAnalytics = {
    newLeads: newLeadsCount,
    existingLeads: existingLeadsCount,
    reopenedLeads: reopenedLeadsCount,
    closedLeads: closedLeadsCount,
    followUps: followUpsCount,
    notInterested: notInterestedCount,
    lostLeads: lostLeadsCount
  };

  // Compile Top Performers (based on scoring criteria)
  const topPerformers = [...associateAnalytics]
    .map(r => {
      const score = (r.closed * 10) + (r.followUps * 2) + (r.customersHandledMonth * 3) - (r.pendingFollowUps * 1) - (r.avgResponseSeconds / 60);
      return {
        associateName: r.associateName,
        role: r.role,
        branch: r.branch,
        score: Math.round(score),
        closed: r.closed,
        followUps: r.followUps,
        customersHandledMonth: r.customersHandledMonth
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    associateAnalytics,
    branchAnalytics,
    leadAnalytics,
    topPerformers
  };
}

/**
 * Lazy loads every customer handled timeline history for a specific associate.
 */
export async function getAssociateCustomers(associateId) {
  const user = await User.findById(associateId).lean();
  
  const branches = await Branch.find().lean();
  const branchMap = {};
  branches.forEach(b => {
    branchMap[b._id.toString()] = b.name;
  });

  const customers = await Customer.find({
    $or: [
      { "chatHistory.performedById": associateId },
      { "chatHistory.performedByName": user?.name || "" }
    ]
  }).lean();

  const timelineEntries = [];
  customers.forEach(customer => {
    const history = customer.chatHistory || [];
    history.forEach(item => {
      const matchId = item.performedById?.toString() === associateId;
      const matchName = item.performedByName === user?.name;
      
      if (matchId || matchName) {
        timelineEntries.push({
          customerName: resolveCustomerDisplayName(customer),
          phone: customer.phone,
          enquiredFor: customer.enquiredFor || "-",
          currentStatus: customer.status || "New",
          activityType: item.action || item.eventType || "-",
          handledAt: item.timestamp || item.performedAt || new Date(),
          handledBy: item.performedByName || user?.name || "System",
          branch: branchMap[customer.branchId?.toString()] || "-",
          remark: item.notes || "-"
        });
      }
    });
  });

  // Sort newest first
  timelineEntries.sort((a, b) => new Date(b.handledAt) - new Date(a.handledAt));

  return timelineEntries;
}
