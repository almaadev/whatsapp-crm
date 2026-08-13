import mongoose from "mongoose";
import User from "@/shared/models/User";
import Lead from "@/shared/models/Lead";
import Customer from "@/shared/models/Customer";
import Message from "@/shared/models/Message";
import Branch from "@/shared/models/Branch";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";

import { getOperationalDateBounds } from "@/shared/utils/dateRangeResolver";

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

  // Retrieve recent chronological activity logs for Live Activity Feed
  const customerQuery = {};
  if (branchFilter !== "all" && branchFilter !== "none") {
    customerQuery.branchId = branchFilter;
  }
  const recentCustomers = await Customer.find(customerQuery)
    .sort({ "chatHistory.timestamp": -1 })
    .limit(40)
    .lean();

  const liveActivity = [];
  recentCustomers.forEach(customer => {
    const history = customer.chatHistory || [];
    history.forEach(item => {
      liveActivity.push({
        id: item._id?.toString() || `${customer.phone}-${item.timestamp ? new Date(item.timestamp).getTime() : Date.now()}-${Math.random()}`,
        customerName: resolveCustomerDisplayName(customer),
        phone: customer.phone,
        enquiredFor: customer.enquiredFor || "-",
        currentStatus: customer.status || "New",
        activityType: item.action || item.eventType || "-",
        timestamp: item.timestamp || item.performedAt || new Date(),
        performedBy: item.performedByName || "System",
        notes: item.notes || "-"
      });
    });
  });

  liveActivity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const initialLiveActivity = liveActivity.slice(0, 20);

  return {
    associateAnalytics,
    branchAnalytics,
    leadAnalytics,
    topPerformers,
    liveActivity: initialLiveActivity
  };
}

import Activity from "@/shared/models/Activity";
import CustomerAddress from "@/shared/models/CustomerAddress";
import { resolveLeadStatus } from "@/shared/utils/leadStatusResolver";
import { getActivityTitle } from "@/shared/utils/activityFormatter";

/**
 * Lazy loads customer-level handled history DTOs for a specific associate.
 */
export async function getAssociateCustomers(associateId, options = {}) {
  const {
    dateRange = "thisMonth",
    customStart,
    customEnd,
    branchFilter = "all",
    isSuperAdmin = false,
    adminBranch = null
  } = options;

  // 1. Resolve User identity (associateId -> User ObjectId & name)
  let user = null;
  const isObjectId = mongoose.Types.ObjectId.isValid(associateId);
  if (isObjectId) {
    user = await User.findById(associateId).lean();
  }
  if (!user) {
    user = await User.findOne({
      $or: [
        { name: associateId },
        { email: associateId }
      ]
    }).lean();
  }

  const associateObjectId = user?._id || (isObjectId ? new mongoose.Types.ObjectId(associateId) : null);
  const associateIdStr = associateObjectId ? associateObjectId.toString() : associateId;
  const associateName = user?.name || "";

  // 2. IST Date bounds & Branch RBAC
  const { startDate, endDate } = getOperationalDateBounds(dateRange, customStart, customEnd);

  const branches = await Branch.find().lean();
  const branchMap = {};
  branches.forEach(b => {
    branchMap[b._id.toString()] = b.name;
  });

  let effectiveBranch = branchFilter;
  if (!isSuperAdmin) {
    effectiveBranch = adminBranch || "none";
  }

  // 3. Primary Handled Customer Qualification (Rule 1 & 2)
  const idVariations = [associateIdStr];
  if (associateObjectId) idVariations.push(associateObjectId);

  const qualifiedCustomerSet = new Set();
  const handlingTimestampMap = {};

  const leadMatchConditions = [
    { associateId: { $in: idVariations } },
    { "handledByHistory.associateId": { $in: idVariations } },
    { "leads.associateId": { $in: idVariations } }
  ];
  if (associateName) {
    leadMatchConditions.push({ assignedTo: associateName });
    leadMatchConditions.push({ "leads.associateName": associateName });
    leadMatchConditions.push({ "handledByHistory.associateName": associateName });
  }

  const qualifiedLeads = await Lead.find({
    $or: leadMatchConditions,
    $and: [
      {
        $or: [
          { createdAt: { $gte: startDate, $lte: endDate } },
          { updatedAt: { $gte: startDate, $lte: endDate } },
          { "handledByHistory.assignedAt": { $gte: startDate, $lte: endDate } },
          { "leads.date": { $gte: startDate, $lte: endDate } }
        ]
      }
    ]
  }).lean();

  qualifiedLeads.forEach(l => {
    if (l.customerId) {
      const cid = l.customerId.toString();
      qualifiedCustomerSet.add(cid);

      let handledTs = l.createdAt;
      if (l.handledByHistory?.length) {
        const matchH = l.handledByHistory.find(h => idVariations.includes(h.associateId?.toString()) || h.associateName === associateName);
        if (matchH?.assignedAt) handledTs = matchH.assignedAt;
      }
      if (!handlingTimestampMap[cid] || new Date(handledTs) < new Date(handlingTimestampMap[cid])) {
        handlingTimestampMap[cid] = handledTs;
      }
    }
  });

  const customerMatchConditions = [
    { assignedUserId: { $in: idVariations } },
    { createdBy: { $in: idVariations } }
  ];
  if (associateName) {
    customerMatchConditions.push({ assignedTo: associateName });
  }

  const qualifiedCustomersDirect = await Customer.find({
    $or: customerMatchConditions,
    createdAt: { $gte: startDate, $lte: endDate }
  }).lean();

  qualifiedCustomersDirect.forEach(c => {
    const cid = c._id.toString();
    qualifiedCustomerSet.add(cid);
    if (!handlingTimestampMap[cid] || new Date(c.createdAt) < new Date(handlingTimestampMap[cid])) {
      handlingTimestampMap[cid] = c.createdAt;
    }
  });

  const qualifiedCustomerIds = Array.from(qualifiedCustomerSet);
  if (qualifiedCustomerIds.length === 0) {
    return [];
  }

  // 4. Fetch related Customer, Address, Lead, and Activity data
  const customerQuery = { _id: { $in: qualifiedCustomerIds } };
  if (effectiveBranch !== "all" && effectiveBranch !== "none") {
    const branchDoc = await Branch.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(effectiveBranch) ? effectiveBranch : null },
        { name: effectiveBranch }
      ]
    }).lean();
    if (branchDoc) {
      customerQuery.branchId = branchDoc._id;
    }
  }

  const customers = await Customer.find(customerQuery)
    .populate("currentAddressId")
    .lean();

  const matchedCustomerIds = customers.map(c => c._id);
  const leads = await Lead.find({ customerId: { $in: matchedCustomerIds } }).lean();
  const activities = await Activity.find({ customerId: { $in: matchedCustomerIds } }).sort({ createdAt: -1 }).lean();

  const leadByCustId = {};
  leads.forEach(l => {
    leadByCustId[l.customerId.toString()] = l;
  });

  const activitiesByCustId = {};
  activities.forEach(a => {
    const cid = a.customerId.toString();
    if (!activitiesByCustId[cid]) activitiesByCustId[cid] = [];
    activitiesByCustId[cid].push(a);
  });

  // 5. Aggregate by customerId into 1 Customer = 1 Row DTOs
  const customerDTOs = customers.map(customer => {
    const cid = customer._id.toString();
    const lead = leadByCustId[cid];
    const custActivities = activitiesByCustId[cid] || [];
    const followUps = lead?.leads || [];
    const latestFollowUp = followUps.length > 0 ? followUps[followUps.length - 1] : null;

    const branchName = branchMap[customer.branchId?.toString()] || customer.branchName || "Unassigned Branch";
    const currentStatus = resolveLeadStatus(lead) || customer.status || "New";

    const historyList = [];
    const seenEventKeys = new Set();

    followUps.forEach(fu => {
      const matchAssoc = idVariations.includes(fu.associateId?.toString()) || fu.associateName === associateName;
      if (matchAssoc) {
        const key = `fu_${fu._id?.toString() || fu.date}`;
        if (!seenEventKeys.has(key)) {
          seenEventKeys.add(key);
          historyList.push({
            eventType: "FOLLOWUP_ENTRY",
            action: `Follow-Up (${fu.status || "Note"})`,
            handledAt: fu.date || fu.createdAt,
            handledBy: fu.associateName || associateName,
            remark: fu.overAllRemarks || fu.day1Remarks || fu.day2Remarks || fu.day3Remarks || fu.note || "-"
          });
        }
      }
    });

    custActivities.forEach(act => {
      const matchActor = idVariations.includes(act.actorId?.toString()) ||
                         idVariations.includes(act.metadata?.performedById) ||
                         act.metadata?.performedByName === associateName;
      if (matchActor) {
        const key = `act_${act._id?.toString()}`;
        if (!seenEventKeys.has(key)) {
          seenEventKeys.add(key);
          const actTitle = getActivityTitle(act.eventType, act.metadata?.performedByName || associateName, act.metadata) || act.eventType;
          historyList.push({
            eventType: act.eventType,
            action: actTitle,
            handledAt: act.createdAt,
            handledBy: act.metadata?.performedByName || associateName,
            remark: act.metadata?.newValue || act.metadata?.notes || act.metadata?.remarks || "-"
          });
        }
      }
    });

    historyList.sort((a, b) => new Date(b.handledAt) - new Date(a.handledAt));

    const latestHistoryItem = historyList.length > 0 ? historyList[0] : null;
    const latestActivityDate = latestHistoryItem ? latestHistoryItem.handledAt : (customer.updatedAt || customer.createdAt);
    const handledAt = handlingTimestampMap[cid] || customer.createdAt;

    return {
      customerId: cid,
      customerName: resolveCustomerDisplayName({ lead, customer, phone: customer.phone }),
      phone: customer.phone,
      branch: branchName,
      associate: customer.assignedTo || associateName || "Unassigned",
      currentStatus,
      leadType: lead?.latestFollowUp?.leadType || customer.activeRouteCategory || "Direct Lead",
      enquiredFor: latestFollowUp?.enquiredFor || customer.enquiredFor || "-",
      priority: latestFollowUp?.priority || customer.priority || "Medium",
      handledAt,
      followUpDate: latestFollowUp?.nextFollowUp || latestFollowUp?.date || null,
      followUpRemark: latestFollowUp?.day1Remarks || latestFollowUp?.overAllRemarks || "-",
      closedDate: lead?.closedAt || null,
      closedRemark: lead?.closedBy ? `Closed by ${lead.closedBy}` : "-",
      latestActivityDate,
      activityType: latestHistoryItem ? latestHistoryItem.action : "Customer Handled",
      remark: latestHistoryItem?.remark || latestFollowUp?.overAllRemarks || customer.remarks || "-",
      history: historyList
    };
  });

  customerDTOs.sort((a, b) => new Date(b.latestActivityDate || b.handledAt) - new Date(a.latestActivityDate || a.handledAt));

  return customerDTOs;
}
