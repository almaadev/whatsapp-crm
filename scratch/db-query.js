import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "../src/shared/lib/db/mongodb.js";
import User from "../src/shared/models/User.js";

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await connectDB();
    console.log("Connected successfully!");

    const adminUser = await User.findOne({ email: "admin@almaa.com" }).lean();
    if (adminUser) {
      console.log("Admin password hash:", adminUser.password);
      const isMatch = await bcrypt.compare("admin123", adminUser.password);
      console.log("Does password 'admin123' match?", isMatch);
    } else {
      console.log("admin@almaa.com user not found.");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
