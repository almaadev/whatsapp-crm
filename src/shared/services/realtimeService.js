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
    this._lastRegisteredKey = null;
    this._heartbeatInterval = null;
    this._visibilityAttached = false;
    this._handleConnect = this._handleConnect.bind(this);
    this._handleDisconnect = this._handleDisconnect.bind(this);
  }

  /**
   * Register the authenticated user into server rooms (user:<userId>, branch:<branchId>, etc.)
   * Fully idempotent: will NOT emit redundant register_user if already registered on this socket instance.
   */
  registerUser() {
    if (!this.socket || !this.socket.connected) return;
    const user = this.user;
    if (!user) return;

    const uId = (user.userId || user.id || user._id)?.toString();
    if (!uId) return;

    let branchId = null;
    if (user.branchId) {
      branchId = typeof user.branchId === "object" ? (user.branchId._id || user.branchId.id || "").toString() : user.branchId.toString();
    } else if (user.branch) {
      branchId = typeof user.branch === "object" ? (user.branch._id || user.branch.id || "").toString() : user.branch.toString();
    }
    if (branchId === "[object Object]" || !branchId) branchId = "";

    const branchStr = branchId;
    const role = user.role || "associate";
    const department = user.department || "";

    const registrationKey = `${this.socket.id || "sock"}:${uId}:${branchStr}:${role}:${department}`;
    if (this._lastRegisteredKey === registrationKey) {
      return; // Already registered with this exact payload on this socket connection
    }
    this._lastRegisteredKey = registrationKey;

    const registrationPayload = {
      userId: uId,
      id: uId,
      name: user.name || "User",
      email: user.email || "",
      role,
      department,
      branch: branchStr || null,
      branchId: branchStr || null,
    };

    if (process.env.NODE_ENV === "development") {
      console.log(`[SOCKET] register_user | userId=${uId} | role=${role} | branchId=${branchStr || "none"}`);
    }
    this.socket.emit("register_user", registrationPayload);
  }

  /**
   * Handle socket connect/reconnect events: always re-register user into room subscriptions
   */
  _handleConnect() {
    if (process.env.NODE_ENV === "development") {
      console.log(`[SOCKET] connected (${this.socket?.id})`);
    }
    this._lastRegisteredKey = null;
    this.registerUser();
  }

  /**
   * Handle socket disconnect event
   */
  _handleDisconnect(reason) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[SOCKET] disconnected reason=${reason}`);
    }
    this._lastRegisteredKey = null;
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

    // Ensure connect/reconnect/disconnect listeners are cleanly attached without duplicate handlers
    this.socket.off("connect", this._handleConnect);
    this.socket.off("reconnect", this._handleConnect);
    this.socket.off("disconnect", this._handleDisconnect);
    this.socket.on("connect", this._handleConnect);
    this.socket.on("reconnect", this._handleConnect);
    this.socket.on("disconnect", this._handleDisconnect);

    // If socket is already connected when init() is called or user updates, register (if not already registered)
    if (this.socket.connected) {
      this.registerUser();
    }

    // Start single central heartbeat interval (every 12 seconds)
    if (!this._heartbeatInterval) {
      this._heartbeatInterval = setInterval(() => {
        if (this.socket && this.socket.connected) {
          this.socket.emit("heartbeat");
        }
      }, 12000);
    }

    // Attach visibility handler once to wake up socket on tab focus
    if (!this._visibilityAttached && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          if (this.socket && !this.socket.connected) {
            this.socket.connect();
          } else {
            this.registerUser();
          }
        }
      });
      this._visibilityAttached = true;
    }

    // Attach business event listeners ONLY ONCE for the application lifetime
    if (!this.listenersAttached) {
      this.attachEventListeners();
      this.listenersAttached = true;
      
    }

    // Initial unread notification count synchronization
    try {
      useNotificationStore.getState().fetchUnreadCount();
    } catch (e) {
      console.error("[RealtimeService] Error fetching unread count:", e);
    }
  }

  destroy() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
    this._lastRegisteredKey = null;
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
      
    });

    // --- 1. INCOMING & OUTGOING MESSAGES ---
    const handleMessage = (msg) => {
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
      useNotificationStore.getState().handleNotificationCreated(data);
    });

    this.socket.on("notification_updated", (data) => {
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

