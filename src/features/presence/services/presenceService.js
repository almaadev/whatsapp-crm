import { realtimeService } from "@/shared/services/realtimeService";

/**
 * Unified Presence Service (delegates to central RealtimeService)
 */
export const presenceService = {
  init(user) {
    if (user) {
      realtimeService.init(null, user);
    }
  },

  destroy() {
    // No-op to preserve online users state across component lifecycles
  }
};
