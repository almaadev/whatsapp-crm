import { create } from "zustand";

export const useTemplateStore = create((set, get) => ({
  templates: [],
  loading: false,
  fetched: false,

  fetchTemplates: async () => {
    if (get().fetched) return;
    set({ loading: true });
    try {
      const res = await fetch("/api/templates");
      const json = await res.json();
      if (json.success) {
        set({ templates: json.data, fetched: true });
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      set({ loading: false });
    }
  },

  addTemplate: (tpl) =>
    set((state) => ({ templates: [tpl, ...state.templates] })),

  updateTemplate: (id, tpl) =>
    set((state) => ({
      templates: state.templates.map((t) => (t._id === id ? tpl : t)),
    })),

  removeTemplate: (id) =>
    set((state) => ({
      templates: state.templates.filter((t) => t._id !== id),
    })),

  forceRefresh: async () => {
    set({ fetched: false });
    await get().fetchTemplates();
  },
}));
