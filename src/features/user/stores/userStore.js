import { create } from "zustand";
import { decrypt } from "@/shared/utils/crypto";

const ENCRYPTION_PASSWORD = process.env.NEXT_PUBLIC_API_ENCRYPTION_KEY || "AlmaaHerbalCRMSecurityKey2026";

export const useUserStore = create((set, get) => ({
  user: null,
  isLoading: false,
  isInitialized: false,
  error: null,
  isSuspended: false,
  
  setUser: (user) => set({ user, isInitialized: true, isLoading: false }),
  clearUser: () => set({ user: null, error: null, isSuspended: false, isInitialized: true, isLoading: false }),
  
  fetchCurrentUser: async (authRepository) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authRepository.getCurrentUser();
      
      let currentUser = data.user;
      if (data.data) {
        const decryptedText = await decrypt(data.data, ENCRYPTION_PASSWORD);
        currentUser = JSON.parse(decryptedText);
      }
      
      set({ user: currentUser, isLoading: false, isInitialized: true });
      return currentUser;
    } catch (error) {
      const errMsg = error.response?.data?.error || error.message || "Unauthorized";
      const status = error.status || error.response?.status;
      if (status === 403 && errMsg === "Suspended") {
        set({ isSuspended: true, isLoading: false, isInitialized: true });
      } else {
        set({ error: errMsg, isLoading: false, isInitialized: true });
        console.error("Error fetching current user:", errMsg);
      }
      throw error;
    }
  }
}));

