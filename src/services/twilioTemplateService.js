import api from "@/lib/axios";

export const twilioTemplateService = {

async getTemplates() {
const { data } = await api.get("/api/admin/templates");
if (!data.success) throw new Error(data.error || "Failed to fetch templates from Twilio");
return data.templates;
},

async createTemplate(formData) {
const { data } = await api.post("/api/admin/templates", formData, {
headers: { "Content-Type": "multipart/form-data" }
});
if (!data.success) throw new Error(data.error || "Failed to create template in Twilio");
return data;
},

async deleteTemplate(sid) {
const { data } = await api.delete(`/api/admin/templates/${sid}`);
if (!data.success) throw new Error(data.error || "Failed to delete template from Twilio");
return data;
}
};