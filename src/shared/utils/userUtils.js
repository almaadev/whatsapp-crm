import connectDB from "@/shared/lib/db/mongodb";
import User from "@/shared/models/User";
import mongoose from "mongoose";

/**
 * Fetches a user's name by their MongoDB ID.
 * Returns the name if found, or a fallback string if not found or invalid.
 *
 * @param {string} userId - The MongoDB ObjectId of the user.
 * @param {string} fallbackName - The name to return if the user isn't found (default: "Unknown").
 * @returns {Promise<string>} - The user's name.
 */
export async function getUserNameById(userId, fallbackName = "Unknown") {
  try {
    // 1. Validate if the ID is a proper MongoDB ObjectId format
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return fallbackName;
    }

    // 2. Ensure Database connection
    await connectDB();

    // 3. Fetch ONLY the 'name' field for maximum performance
    const user = await User.findById(userId).select("name").lean();

    // 4. Return the name, or the fallback if the user document was deleted
    return user?.name || fallbackName;

  } catch (error) {
    console.error(`Error fetching user name for ID ${userId}:`, error);
    return fallbackName;
  }
}