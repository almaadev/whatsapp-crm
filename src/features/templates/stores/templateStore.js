import { create } from "zustand";
import { templateRepository } from "@/shared/api/repositories/templateRepository";

export const useTemplateStore = create((set, get) => ({
  templates: [],
  loading: false,
  fetched: false,

  fetchTemplates: async () => {
    if (get().fetched) return;
    set({ loading: true });
    try {
      const { data: json } = await templateRepository.getTemplates();
      if (json.success) {
        set({ templates: json.templates || [], fetched: true });
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
