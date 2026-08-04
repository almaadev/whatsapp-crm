import { connectSocket } from "@/features/chat/services/socketService";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { usePresenceStore } from "@/features/presence/stores/presenceStore";
import { usePerformanceMonitorStore } from "@/features/admin/stores/performanceMonitorStore";
import { notificationAudioService } from "@/shared/services/notificationAudioService";

class RealtimeServiceManager {
  constructor() {
    this.initialized = false;
    this.queryClient = null;
    this.socket = null;
    this.user = null;
  }

  /**
   * Initialize central Realtime Event Dispatcher
   * @param {Object} queryClient - TanStack React Query Client
   * @param {Object} user - Authenticated user details
   */
  init(queryClient, user) {
    this.queryClient = queryClient;
    this.user = user;

    // Preload audio files early on authenticated layout mount
    notificationAudioService.preload();

    this.socket = connectSocket();

    if (user && (user.id || user._id)) {
      const uId = (user.id || user._id).toString();
      const branchId = user.branchId || user.branch || null;
      this.socket.emit("register_user", {
        userId: uId,
        id: uId,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        branch: branchId,
        branchId: branchId
      });
      console.log(`[RealtimeService] Registered user: ${user.name} (${user.role})`);
    }

    if (this.initialized) return;
    this.initialized = true;

    this.attachEventListeners();
    console.log("⚡ [RealtimeService] Central Realtime Event Bus Initialized.");
  }

  attachEventListeners() {
    if (!this.socket) return;

    // --- 1. INCOMING & OUTGOING MESSAGES ---
    const handleMessage = (msg) => {
      console.log(`[Socket] Incoming Message | Phone: ${msg?.phone}`);

      // 1. Trigger Audio & Browser Notification IMMEDIATELY on socket event arrival
      notificationAudioService.handleMessageNotification(msg);

      // 2. Update main chat store
      try {
        useChatStore.getState().addMessage(msg);
      } catch (err) {
        console.error("[RealtimeService] Error updating chatStore:", err);
      }

      // 3. Invalidate React Query Caches
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ["chats"] });
        if (msg.chatType && msg.chatType !== "Direct Lead") {
          const slug = msg.chatType.toLowerCase().replace(/\s+/g, "-");
          this.queryClient.invalidateQueries({ queryKey: ["category-chats", slug] });
        }
      }
    };

    this.socket.on("new_message", handleMessage);
    this.socket.on("new_product_message", handleMessage);
    this.socket.on("new_mdcamp_message", handleMessage);
    this.socket.on("new_therapy_message", handleMessage);

    // --- 2. MESSAGE STATUS UPDATES ---
    this.socket.on("message_status_update", (update) => {
      console.log(`[RealtimeService] Message status update for SID: ${update.sid} -> ${update.status}`);
      try {
        const state = useChatStore.getState();
        if (update.phone && state.updateMessageStatus) {
          state.updateMessageStatus(update.phone, update.sid || update.tempId, update.status, update.sid);
        }
      } catch (e) {}

      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ["chats"] });
      }
    });

    // --- 3. LEAD & CUSTOMER UPDATES ---
    const handleCustomerOrLeadUpdate = (data) => {
      console.log(`[RealtimeService] Customer/Lead update event:`, data);
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ["leads"] });
        this.queryClient.invalidateQueries({ queryKey: ["customers"] });
        this.queryClient.invalidateQueries({ queryKey: ["chats"] });
        this.queryClient.invalidateQueries({ queryKey: ["category-chats"] });
      }
      try {
        usePerformanceMonitorStore.getState().refresh();
      } catch (e) {}
    };

    this.socket.on("lead_status_update", handleCustomerOrLeadUpdate);
    this.socket.on("lead_status_changed", handleCustomerOrLeadUpdate);
    this.socket.on("followup_added", handleCustomerOrLeadUpdate);
    this.socket.on("customer_updated", handleCustomerOrLeadUpdate);
    this.socket.on("customer_branch_updated", handleCustomerOrLeadUpdate);
    this.socket.on("chat_status_updated", handleCustomerOrLeadUpdate);

    // --- 4. PRESENCE & HANDLERS ---
    this.socket.on("presence_change", (onlineUsers) => {
      console.log(`[RealtimeService] Presence update: ${onlineUsers.length} online users`);
      try {
        usePresenceStore.getState().setOnlineUsers(onlineUsers);
      } catch (e) {}
    });

    this.socket.on("sync_active_handlers", (handlersArray) => {
      try {
        usePresenceStore.getState().syncHandlers(handlersArray);
      } catch (e) {}
    });

    this.socket.on("chat_handled", ({ phone, handler }) => {
      try {
        usePresenceStore.getState().setHandler(phone, handler);
      } catch (e) {}
    });

    this.socket.on("chat_unhandled", ({ phone }) => {
      try {
        usePresenceStore.getState().removeHandler(phone);
      } catch (e) {}
    });

    this.socket.on("chat_lock_updated", ({ phone, handler }) => {
      try {
        usePresenceStore.getState().setHandler(phone, handler);
      } catch (e) {}
      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ["chats"] });
      }
    });

    // --- 5. PERFORMANCE MONITOR TELEMETRY ---
    this.socket.on("performance_monitor_event", (eventData) => {
      console.log(`[RealtimeService] Telemetry event: ${eventData.eventType}`);
      try {
        usePerformanceMonitorStore.getState().mergeSocketEvent(eventData);
      } catch (e) {}
    });

    // --- 6. TEMPLATES, BULK & DASHBOARD ---
    this.socket.on("template_sent", () => {
      if (this.queryClient) this.queryClient.invalidateQueries({ queryKey: ["templates"] });
    });

    this.socket.on("bulk_message_status", () => {
      if (this.queryClient) this.queryClient.invalidateQueries({ queryKey: ["bulk-messages"] });
    });

    this.socket.on("dashboard_stats_updated", () => {
      if (this.queryClient) this.queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    });
  }
}

export const realtimeService = new RealtimeServiceManager();
