import { create } from "zustand";

export const usePresenceStore = create((set, get) => ({
  onlineUsers: [],
  onlineUserIds: new Set(),

  setOnlineUsers: (users) => {
    if (!Array.isArray(users)) return;
    const ids = new Set(users.map((u) => u.userId?.toString()).filter(Boolean));
    set({
      onlineUsers: users,
      onlineUserIds: ids
    });
  },

  isUserOnline: (userId) => {
    if (!userId) return false;
    return get().onlineUserIds.has(userId.toString());
  }
}));
