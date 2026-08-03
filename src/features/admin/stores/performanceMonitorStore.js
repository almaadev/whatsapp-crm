import { create } from "zustand";

export const usePerformanceMonitorStore = create((set, get) => ({
  filters: {
    dateRange: "thisMonth",
    startDate: "",
    endDate: "",
    branchId: "all",
    department: "all",
    role: "all",
    associateStatus: "all",
    leadType: "all",
    associateId: "all",
    leadStatus: "all"
  },
  analyticsData: null,
  isLoading: false,
  error: null,

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value
      }
    }));
    // Auto fetch when filters change
    get().fetchAnalytics();
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: {
        ...state.filters,
        ...newFilters
      }
    }));
    get().fetchAnalytics();
  },

  fetchAnalytics: async () => {
    const { filters, isLoading } = get();
    if (isLoading) return; // Prevent duplicate concurrent API requests

    set({ isLoading: true, error: null });

    try {
      let query = `dateRange=${filters.dateRange}&department=${filters.department}&role=${filters.role}&associateStatus=${filters.associateStatus}&leadType=${filters.leadType}&associateId=${filters.associateId}&leadStatus=${filters.leadStatus}`;
      
      if (filters.branchId !== "all") {
        query += `&branchId=${filters.branchId}`;
      }
      if (filters.dateRange === "custom" && filters.startDate) {
        query += `&startDate=${filters.startDate}&endDate=${filters.endDate}`;
      }

      const res = await fetch(`/api/admin/performance-monitor?${query}`);
      const payload = await res.json();

      if (payload.success) {
        set({ analyticsData: payload, isLoading: false });
      } else {
        set({ error: payload.error || "Failed to load metrics", isLoading: false });
      }
    } catch (err) {
      console.error("Zustand Analytics Sync Error:", err);
      set({ error: "Network error fetching analytics", isLoading: false });
    }
  },

  mergeSocketEvent: (event) => {
    const { eventType, payload, branchId, timestamp } = event;
    const { analyticsData } = get();
    if (!analyticsData) return;

    // Deep copy data to trigger re-renders
    const data = JSON.parse(JSON.stringify(analyticsData));
    if (!data.liveActivity) data.liveActivity = [];

    // Helper to find associate
    const findAssociate = (assocId, name) => {
      if (!data.associateAnalytics) return null;
      return data.associateAnalytics.find(a => 
        (assocId && a.associateId === assocId.toString()) || 
        (name && a.associateName?.toLowerCase() === name.toLowerCase())
      );
    };

    // Helper to find branch
    const findBranch = (bId) => {
      if (!data.branchAnalytics) return null;
      return data.branchAnalytics.find(b => 
        (bId && b.branchId === bId.toString()) ||
        (payload.branchName && b.branchName?.toLowerCase() === payload.branchName.toLowerCase())
      );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 1. UPDATE ASSOCIATE ANALYTICS
    // ─────────────────────────────────────────────────────────────────────────
    if (eventType === "associate_online") {
      const a = findAssociate(payload.associateId, payload.name);
      if (a) a.status = "Online";
    } else if (eventType === "associate_offline") {
      const a = findAssociate(payload.associateId, payload.name);
      if (a) a.status = "Offline";
    } else if (eventType === "lock_chat" || eventType === "active_chat_started") {
      const a = findAssociate(payload.handler?.userId, payload.handler?.name);
      if (a) {
        a.currentActiveChatCount = (a.currentActiveChatCount || 0) + 1;
      }
    } else if (eventType === "unlock_chat" || eventType === "active_chat_closed") {
      const a = findAssociate(payload.handler?.userId, payload.handler?.name);
      if (a) {
        a.currentActiveChatCount = Math.max(0, (a.currentActiveChatCount || 1) - 1);
      }
    } else if (eventType === "followup_added") {
      const a = findAssociate(payload.followUp?.associateId, payload.followUp?.associateName || payload.performedBy);
      if (a) {
        a.followUps = (a.followUps || 0) + 1;
        a.pendingFollowUps = (a.pendingFollowUps || 0) + 1;
      }
    } else if (eventType === "followup_completed") {
      const a = findAssociate(payload.followUp?.associateId, payload.followUp?.associateName || payload.performedBy);
      if (a) {
        a.followUps = (a.followUps || 0) + 1;
        a.pendingFollowUps = Math.max(0, (a.pendingFollowUps || 1) - 1);
      }
    } else if (eventType === "lead_closed") {
      const a = findAssociate(null, payload.closedBy || payload.performedBy);
      if (a) {
        a.closed = (a.closed || 0) + 1;
        a.pendingFollowUps = Math.max(0, (a.pendingFollowUps || 1) - 1);
      }
    } else if (eventType === "customer_assigned") {
      const a = findAssociate(null, payload.assignedTo);
      if (a) {
        a.customersHandledMonth = (a.customersHandledMonth || 0) + 1;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. UPDATE BRANCH ANALYTICS
    // ─────────────────────────────────────────────────────────────────────────
    const b = findBranch(branchId || payload.branchId);
    if (b) {
      if (eventType === "customer_created" || eventType === "lead_new") {
        b.customersReceived = (b.customersReceived || 0) + 1;
      } else if (eventType === "customer_assigned" || eventType === "customer_reassigned") {
        b.customersAssigned = (b.customersAssigned || 0) + 1;
      } else if (eventType === "lead_closed") {
        b.customersClosed = (b.customersClosed || 0) + 1;
        b.pendingFollowUps = Math.max(0, (b.pendingFollowUps || 1) - 1);
      } else if (eventType === "followup_added") {
        b.pendingFollowUps = (b.pendingFollowUps || 0) + 1;
      } else if (eventType === "followup_completed") {
        b.pendingFollowUps = Math.max(0, (b.pendingFollowUps || 1) - 1);
      } else if (eventType === "associate_online") {
        b.onlineAssociates = (b.onlineAssociates || 0) + 1;
      } else if (eventType === "associate_offline") {
        b.onlineAssociates = Math.max(0, (b.onlineAssociates || 1) - 1);
      }

      // Recalculate conversion rate
      if (b.customersReceived > 0) {
        b.conversionRate = Math.round((b.customersClosed / b.customersReceived) * 100);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. UPDATE LEAD FUNNEL PIPELINE
    // ─────────────────────────────────────────────────────────────────────────
    if (data.leadAnalytics) {
      if (eventType === "lead_new") {
        data.leadAnalytics.newLeads = (data.leadAnalytics.newLeads || 0) + 1;
      } else if (eventType === "lead_existing") {
        data.leadAnalytics.existingLeads = (data.leadAnalytics.existingLeads || 0) + 1;
      } else if (eventType === "followup_added") {
        data.leadAnalytics.followUps = (data.leadAnalytics.followUps || 0) + 1;
      } else if (eventType === "lead_closed") {
        data.leadAnalytics.closedLeads = (data.leadAnalytics.closedLeads || 0) + 1;
      } else if (eventType === "lead_reopened") {
        data.leadAnalytics.reopenedLeads = (data.leadAnalytics.reopenedLeads || 0) + 1;
      } else if (eventType === "lead_not_interested") {
        data.leadAnalytics.notInterested = (data.leadAnalytics.notInterested || 0) + 1;
      } else if (eventType === "lead_lost") {
        data.leadAnalytics.lostLeads = (data.leadAnalytics.lostLeads || 0) + 1;
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. RECALCULATE LEADERBOARD STANDINGS
    // ─────────────────────────────────────────────────────────────────────────
    if (data.associateAnalytics) {
      const scoringMap = data.associateAnalytics.map(r => {
        const score = (r.closed * 10) + (r.followUps * 2) + (r.customersHandledMonth * 3) - (r.pendingFollowUps * 1) - ((r.avgResponseSeconds || 0) / 60);
        return {
          associateName: r.associateName,
          role: r.role,
          branch: r.branch,
          score: Math.round(score),
          closed: r.closed,
          followUps: r.followUps,
          customersHandledMonth: r.customersHandledMonth
        };
      });
      scoringMap.sort((x, y) => y.score - x.score);
      data.topPerformers = scoringMap.slice(0, 5);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. UPDATE LIVE ACTIVITY FEED
    // ─────────────────────────────────────────────────────────────────────────
    const eventId = payload.activityId || `${eventType}-${payload.phone || ""}-${timestamp || Date.now()}`;
    const duplicate = data.liveActivity.some(act => act.id === eventId);

    if (!duplicate) {
      let notes = payload.notes || "-";
      if (eventType === "incoming_whatsapp_message") notes = `Received message: "${payload.message}"`;
      else if (eventType === "outgoing_message") notes = `Sent message: "${payload.message}"`;
      else if (eventType === "followup_added") notes = `Added Follow-Up scheduled for ${payload.followUp?.date ? new Date(payload.followUp.date).toLocaleDateString() : "next date"}`;
      else if (eventType === "lead_closed") notes = `Closed Lead successfully`;
      else if (eventType === "lead_converted") notes = `Converted lead with Sale amount: ₹${payload.saleAmount}`;
      else if (eventType === "customer_branch_changed") notes = `Assigned branch updated to ${payload.branchName || "Unassigned"}`;
      else if (eventType === "associate_online") notes = `Staff became Online`;
      else if (eventType === "associate_offline") notes = `Staff logged out or disconnected`;

      let actionText = eventType.replace(/_/g, " ").toUpperCase();
      if (eventType === "incoming_whatsapp_message") actionText = "INBOUND CHAT";
      else if (eventType === "outgoing_message") actionText = "OUTBOUND CHAT";

      const newActivity = {
        id: eventId,
        customerName: payload.name || payload.customerName || payload.phone || "System",
        phone: payload.phone || "-",
        enquiredFor: payload.enquiredFor || "-",
        currentStatus: payload.status || "Active",
        activityType: actionText,
        timestamp: timestamp || new Date().toISOString(),
        performedBy: payload.performedBy || payload.name || "System",
        notes
      };

      data.liveActivity.unshift(newActivity);
      // Limit to 30 elements
      if (data.liveActivity.length > 30) {
        data.liveActivity.pop();
      }
    }

    set({ analyticsData: data });
  },

  refresh: () => {
    get().fetchAnalytics();
  }
}));
