import Template from "@/shared/models/Template";

export async function findAllTemplates(filter = {}) {
  return await Template.find(filter).lean();
}

export async function findTemplateBySid(sid) {
  return await Template.findOne({ sid }).lean();
}

export async function createTemplate(templatePayload) {
  return await Template.create(templatePayload);
}

export async function deleteTemplate(id) {
  return await Template.findByIdAndDelete(id);
}
