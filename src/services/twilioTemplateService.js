// src/services/twilioTemplateService.js

export const twilioTemplateService = {
  /**
   * Fetches all templates directly from Twilio.
   */
  async getTemplates() {
    const res = await fetch("/api/admin/templates/create");
    const data = await res.json();
    console.log("Response from /api/admin/templates/create:", data);
    if (!data.success)
      throw new Error(data.error || "Failed to fetch templates from Twilio");
    return data.templates;
  },

  /**
   * Creates a new template in Twilio.
   */
  async createTemplate(formData) {
    const res = await fetch("/api/admin/templates/create", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!data.success)
      throw new Error(data.error || "Failed to create template in Twilio");
    return data;
  },

  /**
   * Deletes a template from Twilio.
   */
  async deleteTemplate(sid) {
    const res = await fetch(`/api/templates/${sid}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!data.success)
      throw new Error(data.error || "Failed to delete template from Twilio");
    return data;
  },
};
