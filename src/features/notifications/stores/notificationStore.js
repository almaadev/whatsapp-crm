import { create } from "zustand";
import api from "@/shared/lib/axios";
import { normalizePhone } from "@/shared/utils/phoneUtils";

/**
 * Robust helper to match whether two notification items belong to the same customer/conversation.
 */
export function isSameNotificationConversation(a, b) {
  if (!a || !b) return false;
  if (a._id && b._id && String(a._id) === String(b._id)) return true;
  if (a.customerId && b.customerId && String(a.customerId) === String(b.customerId)) return true;
  if (a.phone && b.phone && normalizePhone(a.phone) === normalizePhone(b.phone)) return true;
  return false;
}

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  activeFilter: "all", // "all", "unread", "read"
  isOpen: false,
  isLoading: false,
  page: 1,
  totalPages: 1,
  totalCount: 0,

  setIsOpen: (isOpen) => set({ isOpen }),
  setFilter: (activeFilter) => {
    set({ activeFilter, page: 1 });
    get().fetchNotifications({ filter: activeFilter, page: 1 });
  },

  fetchNotifications: async ({ filter, page = 1 } = {}) => {
    const currentFilter = filter || get().activeFilter;
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/api/notifications?filter=${currentFilter}&page=${page}&limit=30`);
      if (data?.success) {
        // Deduplicate incoming array by customer/conversation identity
        const rawList = Array.isArray(data.notifications) ? data.notifications : [];
        const dedupedList = [];
        for (const item of rawList) {
          const idx = dedupedList.findIndex((existing) => isSameNotificationConversation(existing, item));
          if (idx < 0) {
            dedupedList.push(item);
          }
        }

        set({
          notifications: dedupedList,
          totalCount: data.totalCount || dedupedList.length,
          unreadCount: data.unreadCount || 0,
          page: data.page || 1,
          totalPages: data.totalPages || 1,
          isLoading: false
        });
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await api.get("/api/notifications/unread-count");
      if (data?.success) {
        set({ unreadCount: data.unreadCount || 0 });
      }
    } catch (err) {
      console.error("Failed to fetch unread notification count:", err);
    }
  },

  markRead: async (id) => {
    // Optimistic UI update
    set((state) => {
      const updated = state.notifications.map((n) =>
        String(n._id) === String(id) ? { ...n, isRead: true, readAt: new Date() } : n
      );
      const dec = state.notifications.find((n) => String(n._id) === String(id) && !n.isRead) ? 1 : 0;
      return {
        notifications: updated,
        unreadCount: Math.max(0, state.unreadCount - dec)
      };
    });

    try {
      await api.post(`/api/notifications/${id}/read`);
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  },

  markUnread: async (id) => {
    // Optimistic UI update
    set((state) => {
      const updated = state.notifications.map((n) =>
        String(n._id) === String(id) ? { ...n, isRead: false, readAt: null } : n
      );
      const inc = state.notifications.find((n) => String(n._id) === String(id) && n.isRead) ? 1 : 0;
      return {
        notifications: updated,
        unreadCount: state.unreadCount + inc
      };
    });

    try {
      await api.post(`/api/notifications/${id}/unread`);
    } catch (err) {
      console.error("Failed to mark notification unread:", err);
    }
  },

  dismiss: async (id) => {
    // Optimistic UI update
    set((state) => {
      const target = state.notifications.find((n) => String(n._id) === String(id));
      const updated = state.notifications.filter((n) => String(n._id) !== String(id));
      const dec = target && !target.isRead ? 1 : 0;
      return {
        notifications: updated,
        totalCount: Math.max(0, state.totalCount - 1),
        unreadCount: Math.max(0, state.unreadCount - dec)
      };
    });

    try {
      await api.post(`/api/notifications/${id}/dismiss`);
    } catch (err) {
      console.error("Failed to dismiss notification:", err);
    }
  },

  clearAll: async () => {
    // Optimistic UI update
    set({ notifications: [], unreadCount: 0, totalCount: 0 });
    try {
      await api.post("/api/notifications/clear-all");
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  },

  // Socket Realtime Dispatch Handlers
  handleNotificationCreated: (newNotif) => {
    if (!newNotif || !newNotif._id) return;
    set((state) => {
      // Check if a notification for this customer already exists in store
      const existingIdx = state.notifications.findIndex((n) => isSameNotificationConversation(n, newNotif));

      if (existingIdx >= 0) {
        // Replace existing item and float to top (One customer = One notification)
        const existing = state.notifications[existingIdx];
        const otherNotifs = state.notifications.filter((_, idx) => idx !== existingIdx);
        const merged = { ...existing, ...newNotif };

        const wasRead = existing.isRead;
        const nowRead = newNotif.isRead;
        const inc = (wasRead && !nowRead) ? 1 : ( (!wasRead && nowRead) ? -1 : 0 );
        const newUnread = Math.max(0, state.unreadCount + inc);

        return { notifications: [merged, ...otherNotifs], unreadCount: newUnread };
      }

      const filterMatches =
        state.activeFilter === "all" ||
        (state.activeFilter === "unread" && !newNotif.isRead) ||
        (state.activeFilter === "read" && newNotif.isRead);

      const newList = filterMatches ? [newNotif, ...state.notifications] : state.notifications;
      const inc = !newNotif.isRead ? 1 : 0;
      const newUnread = state.unreadCount + inc;

      return {
        notifications: newList,
        unreadCount: newUnread,
        totalCount: state.totalCount + 1
      };
    });
  },

  handleNotificationUpdated: (updatedNotif) => {
    if (!updatedNotif || !updatedNotif._id) return;
    set((state) => {
      // Find matching customer conversation
      const existingIdx = state.notifications.findIndex((n) => isSameNotificationConversation(n, updatedNotif));

      if (existingIdx >= 0) {
        const existing = state.notifications[existingIdx];
        const otherNotifs = state.notifications.filter((_, idx) => idx !== existingIdx);
        const merged = { ...existing, ...updatedNotif };

        const wasRead = existing.isRead;
        const nowRead = updatedNotif.isRead;
        const inc = (wasRead && !nowRead) ? 1 : ( (!wasRead && nowRead) ? -1 : 0 );
        const newUnread = Math.max(0, state.unreadCount + inc);

        return { notifications: [merged, ...otherNotifs], unreadCount: newUnread };
      } else {
        const filterMatches =
          state.activeFilter === "all" ||
          (state.activeFilter === "unread" && !updatedNotif.isRead) ||
          (state.activeFilter === "read" && updatedNotif.isRead);

        const inc = !updatedNotif.isRead ? 1 : 0;
        const newUnread = state.unreadCount + inc;

        return filterMatches
          ? { notifications: [updatedNotif, ...state.notifications], unreadCount: newUnread, totalCount: state.totalCount + 1 }
          : state;
      }
    });
  },

  handleNotificationRead: ({ notificationId }) => {
    if (!notificationId) return;
    const idStr = String(notificationId);
    set((state) => {
      const target = state.notifications.find((n) => String(n._id) === idStr);
      const isCurrentlyUnread = target && !target.isRead;
      const updatedList = state.notifications.map((n) =>
        String(n._id) === idStr ? { ...n, isRead: true, readAt: new Date() } : n
      );
      return {
        notifications: updatedList,
        unreadCount: isCurrentlyUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount
      };
    });
  },

  handleNotificationUnread: ({ notificationId }) => {
    if (!notificationId) return;
    const idStr = String(notificationId);
    set((state) => {
      const target = state.notifications.find((n) => String(n._id) === idStr);
      const isCurrentlyRead = target && target.isRead;
      const updatedList = state.notifications.map((n) =>
        String(n._id) === idStr ? { ...n, isRead: false, readAt: null } : n
      );
      return {
        notifications: updatedList,
        unreadCount: isCurrentlyRead ? state.unreadCount + 1 : state.unreadCount
      };
    });
  },

  handleNotificationDismissed: ({ notificationId }) => {
    if (!notificationId) return;
    const idStr = String(notificationId);
    set((state) => {
      const target = state.notifications.find((n) => String(n._id) === idStr);
      const wasUnread = target && !target.isRead;
      return {
        notifications: state.notifications.filter((n) => String(n._id) !== idStr),
        unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
        totalCount: Math.max(0, state.totalCount - 1)
      };
    });
  },

  handleNotificationClearedAll: () => {
    set({ notifications: [], unreadCount: 0, totalCount: 0 });
  }
}));
