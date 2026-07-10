import Template from "@/models/Template";

export async function findAllTemplates(filter = {}) {
  return await Template.find(filter).lean();
}

export async function findTemplateBySid(sid) {
  return await Template.findOne({ sid }).lean();
}

export async function createTemplate(data) {
  return await Template.create(data);
}

export async function deleteTemplate(id) {
  return await Template.findByIdAndDelete(id);
}
