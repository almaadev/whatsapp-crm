import { create } from "zustand";

export const usePresenceStore = create((set) => ({
  activeHandlers: {}, // phone -> { userId, name, socketId, timestamp }
  setHandler: (phone, handler) => set((state) => ({
    activeHandlers: { ...state.activeHandlers, [phone]: handler }
  })),
  removeHandler: (phone) => set((state) => {
    const newHandlers = { ...state.activeHandlers };
    delete newHandlers[phone];
    return { activeHandlers: newHandlers };
  }),
  syncHandlers: (handlersArray) => set((state) => {
    const newHandlers = {};
    handlersArray.forEach(([phone, handler]) => {
      newHandlers[phone] = handler;
    });
    return { activeHandlers: newHandlers };
  })
}));
