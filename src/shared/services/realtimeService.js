import { connectSocket } from "@/features/chat/services/socketService";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useNotificationStore } from "@/features/notifications/stores/notificationStore";
import { usePresenceStore as useOnlineUsersStore } from "@/features/presence/stores/presenceStore";
import { usePresenceStore as useChatPresenceStore } from "@/features/chat/stores/presenceStore";
import { usePerformanceMonitorStore } from "@/features/admin/stores/performanceMonitorStore";
import { notificationAudioService } from "@/shared/services/notificationAudioService";

class RealtimeServiceManager {
  constructor() {
    this.listenersAttached = false;
    this.queryClient = null;
    this.socket = null;
    this.user = null;
    this._handleConnect = this._handleConnect.bind(this);
  }

  /**
   * Register the authenticated user into server rooms (user:<userId>, branch:<branchId>, etc.)
   */
  registerUser() {
    if (!this.socket || !this.socket.connected) return;
    const user = this.user;
    if (!user) return;

    const uId = (user.userId || user.id || user._id)?.toString();
    if (!uId) return;

    const branchId = user.branchId || user.branch || null;
    const registrationPayload = {
      userId: uId,
      id: uId,
      name: user.name || "User",
      email: user.email || "",
      role: user.role || "associate",
      department: user.department || "",
      branch: branchId ? branchId.toString() : null,
      branchId: branchId ? branchId.toString() : null,
    };

    this.socket.emit("register_user", registrationPayload);
    console.log(`[SOCKET DEBUG] userId=${uId}`);
    console.log(`[SOCKET CLIENT] registered user ${registrationPayload.name} (${registrationPayload.role}) | userId: ${uId} | branchId: ${branchId}`);
  }

  /**
   * Handle socket connect/reconnect events: always re-register user into room subscriptions
   */
  _handleConnect() {
    const uId = (this.user?.userId || this.user?.id || this.user?._id);
    console.log(`[SOCKET DEBUG] connected | socketId=${this.socket?.id} | userId=${uId}`);
    this.registerUser();
  }

  /**
   * Initialize central Realtime Event Dispatcher
   * @param {Object} queryClient - TanStack React Query Client
   * @param {Object} user - Authenticated user details
   */
  init(queryClient, user) {
    if (queryClient) this.queryClient = queryClient;
    if (user) this.user = user;

    // Preload audio files early on authenticated layout mount
    notificationAudioService.preload();

    this.socket = connectSocket();

    // Ensure connect/reconnect listeners are cleanly attached without duplicate handlers
    this.socket.off("connect", this._handleConnect);
    this.socket.off("reconnect", this._handleConnect);
    this.socket.on("connect", this._handleConnect);
    this.socket.on("reconnect", this._handleConnect);

    // If socket is already connected when init() is called or user updates, register immediately
    if (this.socket.connected) {
      this.registerUser();
    }

    // Attach business event listeners ONLY ONCE for the application lifetime
    if (!this.listenersAttached) {
      this.attachEventListeners();
      this.listenersAttached = true;
      console.log("⚡ [RealtimeService] Central Realtime Event Bus Initialized.");
    }

    // Initial unread notification count synchronization
    try {
      useNotificationStore.getState().fetchUnreadCount();
    } catch (e) {
      console.error("[RealtimeService] Error fetching unread count:", e);
    }
  }

  attachEventListeners() {
    if (!this.socket) return;

    // Detach any existing event listeners first to prevent Fast Refresh duplicates
    this.socket.off("new_message");
    this.socket.off("message_status_update");
    this.socket.off("lead_status_update");
    this.socket.off("lead_status_changed");
    this.socket.off("followup_added");
    this.socket.off("customer_updated");
    this.socket.off("customer_branch_updated");
    this.socket.off("chat_status_updated");
    this.socket.off("chat_deleted");
    this.socket.off("presence_change");
    this.socket.off("sync_active_handlers");
    this.socket.off("chat_handled");
    this.socket.off("chat_unhandled");
    this.socket.off("chat_lock_updated");
    this.socket.off("performance_monitor_event");
    this.socket.off("template_sent");
    this.socket.off("bulk_message_status");
    this.socket.off("dashboard_stats_updated");
    this.socket.off("notification_created");
    this.socket.off("notification_updated");
    this.socket.off("notification_read");
    this.socket.off("notification_unread");
    this.socket.off("notification_dismissed");
    this.socket.off("notification_cleared_all");
    this.socket.off("crm_realtime_test");

    // --- 0. REALTIME PIPELINE TEST EVENT ---
    this.socket.on("crm_realtime_test", (data) => {
      console.log(`[REALTIME TEST] RECEIVED | userId: ${data?.userId} | timestamp: ${data?.timestamp}`);
    });

    // --- 1. INCOMING & OUTGOING MESSAGES ---
    const handleMessage = (msg) => {
      console.log(`[REALTIME DEBUG] EVENT RECEIVED | event=new_message | customerId=${msg?.customerId} | canonicalPhone=${msg?.canonicalPhone || msg?.phone} | messageId=${msg?.messageId || msg?._id}`);

      // 1. Trigger Audio & Browser Notification IMMEDIATELY on socket event arrival
      notificationAudioService.handleMessageNotification(msg);

      // 2. Update main chat store (updates both ChatList and open ChatArea)
      try {
        useChatStore.getState().addMessage(msg);
      } catch (err) {
        console.error("[RealtimeService] Error updating chatStore:", err);
      }
    };

    this.socket.on("new_message", handleMessage);

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
        this.queryClient.invalidateQueries({ queryKey: ["detailed-customer"] });
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

    // --- 3.1 CHAT / CUSTOMER DELETED ---
    this.socket.on("chat_deleted", (data) => {
      console.log("[RealtimeService] chat_deleted received:", data);
      const customerIds = data?.customerIds || (data?.customerId ? [data.customerId] : []);
      const phones = data?.phones || (data?.phone ? [data.phone] : []);

      try {
        useChatStore.getState().removeConversations({ customerIds, phones });
      } catch (err) {
        console.error("[RealtimeService] Error removing chat from store:", err);
      }

      if (this.queryClient) {
        this.queryClient.invalidateQueries({ queryKey: ["chats"] });
        this.queryClient.invalidateQueries({ queryKey: ["leads"] });
        this.queryClient.invalidateQueries({ queryKey: ["customers"] });
        this.queryClient.invalidateQueries({ queryKey: ["detailed-customer"] });
      }
    });


    // --- 4. PRESENCE & HANDLERS ---
    this.socket.on("presence_change", (onlineUsers) => {
      console.log(`[RealtimeService] Presence update: ${onlineUsers.length} online users`);
      try {
        useOnlineUsersStore.getState().setOnlineUsers(onlineUsers);
      } catch (e) {}
    });

    this.socket.on("sync_active_handlers", (handlersArray) => {
      try {
        useChatPresenceStore.getState().syncHandlers(handlersArray);
      } catch (e) {}
    });

    this.socket.on("chat_handled", ({ phone, handler }) => {
      try {
        useChatPresenceStore.getState().setHandler(phone, handler);
      } catch (e) {}
    });

    this.socket.on("chat_unhandled", ({ phone }) => {
      try {
        useChatPresenceStore.getState().removeHandler(phone);
      } catch (e) {}
    });

    this.socket.on("chat_lock_updated", ({ phone, handler }) => {
      try {
        useChatPresenceStore.getState().setHandler(phone, handler);
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

    // --- 7. PERSISTENT NOTIFICATION CENTER EVENTS ---
    this.socket.on("notification_created", (data) => {
      console.log("🔔 [REALTIME] notification_created received:", data?.title);
      useNotificationStore.getState().handleNotificationCreated(data);
    });

    this.socket.on("notification_updated", (data) => {
      console.log("🔔 [REALTIME] notification_updated received:", data?.title);
      useNotificationStore.getState().handleNotificationUpdated(data);
    });

    this.socket.on("notification_read", (data) => {
      useNotificationStore.getState().handleNotificationRead(data);
    });

    this.socket.on("notification_unread", (data) => {
      useNotificationStore.getState().handleNotificationUnread(data);
    });

    this.socket.on("notification_dismissed", (data) => {
      useNotificationStore.getState().handleNotificationDismissed(data);
    });

    this.socket.on("notification_cleared_all", () => {
      useNotificationStore.getState().handleNotificationClearedAll();
    });
  }
}

export const realtimeService = new RealtimeServiceManager();

