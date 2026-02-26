import { create } from "zustand";

export const useAuthStore = create((set) => ({
  role: null,
  user: null,

  login: (user, role) =>
    set({ user, role }),

  logout: () =>
    set({ user: null, role: null }),
}));
