import { templateRepository } from "@/shared/api/repositories/templateRepository";

export const twilioTemplateService = {

  async getTemplates() {
    const { data } = await templateRepository.getTemplates();
    if (!data.success) throw new Error(data.error || "Failed to fetch templates from Twilio");
    return data.templates;
  },

  async createTemplate(formData) {
    const { data } = await templateRepository.createAdminTemplate(formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    if (!data.success) throw new Error(data.error || "Failed to create template in Twilio");
    return data;
  },

  async deleteTemplate(sid) {
    const { data } = await templateRepository.deleteAdminTemplate(sid);
    if (!data.success) throw new Error(data.error || "Failed to delete template from Twilio");
    return data;
  }
};