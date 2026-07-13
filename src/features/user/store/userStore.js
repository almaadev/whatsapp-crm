import { create } from "zustand";

export const useUserStore = create((set, get) => ({
  user: null,
  isLoading: false,
  error: null,
  
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null, error: null }),
  
  fetchCurrentUser: async (authRepository) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authRepository.getCurrentUser();
      set({ user: data.user, isLoading: false });
      return data.user;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      console.error("Error fetching current user:", error);
      throw error;
    }
  }
}));
