import { findAllAutomations, findAutomationByKey, createAutomation, updateAutomation, deleteAutomation } from "../repositories/keywordAutomationRepository";

export const keywordAutomationService = {
  async getAllKeywords() {
    return await findAllAutomations();
  },

  async createKeyword(body) {
    const { key, templateSid, isActive } = body;
    const cleanKey = key.toLowerCase().trim();

    const exists = await findAutomationByKey(cleanKey);
    if (exists) throw new Error("This keyword already exists.");

    return await createAutomation({ key: cleanKey, templateSid, isActive });
  },

  async updateKeyword(id, body) {
    if (body.key) {
      const cleanKey = body.key.trim().toLowerCase();
      const exists = await findAutomationByKey(cleanKey);
      if (exists && exists._id.toString() !== id) {
        throw new Error("Keyword already exists.");
      }
      body.key = cleanKey;
    }
    return await updateAutomation(id, body);
  },

  async deleteKeyword(id) {
    await deleteAutomation(id);
    return { success: true };
  },

  async toggleKeywordStatus(id, isActive) {
    return await updateAutomation(id, { isActive });
  }
};
