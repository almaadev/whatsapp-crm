import api from "@/shared/lib/axios";

export const reminderRepository = {
  getReminder: (phone) => api.post("/api/reminders", { action: "GET", phone }),
  cancelReminder: (phone) => api.post("/api/reminders", { action: "CANCEL", phone }),
  setReminder: (payload) => api.post("/api/reminders", { action: "SET", ...payload }),
};
