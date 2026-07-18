import User from "@/shared/models/User";

export async function findAllUsers(filter = {}) {
  return await User.find(filter).lean();
}

export async function findUserById(id) {
  return await User.findById(id).lean(); // For reading
}

export async function getUserDocumentById(id) {
  return await User.findById(id); // For saving updates
}

export async function findUserByName(name) {
  return await User.findOne({ name }).lean();
}

export async function createUser(userPayload) {
  return await User.create(userPayload);
}

export async function updateUser(id, userPayload) {
  return await User.findByIdAndUpdate(id, { $set: userPayload }, { returnDocument: "after" });
}

export async function deleteUser(id) {
  return await User.findByIdAndDelete(id);
}

export async function getUserNameById(id, fallbackName = "Unknown") {
  if (!id) return fallbackName;
  try {
    const user = await User.findById(id).lean();
    return user ? user.name : fallbackName;
  } catch (error) {
    return fallbackName;
  }
}
