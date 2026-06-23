
export const twilioTemplateService = {

    async getTemplates() {
        const res = await fetch("/api/admin/templates");
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to fetch templates from Twilio");
        return data.templates;
    },

    async createTemplate(formData) {
        const res = await fetch("/api/admin/templates", {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to create template in Twilio");
        return data;
    },

    async deleteTemplate(sid) {
        const res = await fetch(`/api/admin/templates/${sid}`, {
            method: "DELETE",
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to delete template from Twilio");
        return data;
    }
};