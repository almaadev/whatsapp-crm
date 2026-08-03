import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "../src/shared/lib/db/mongodb.js";
import User from "../src/shared/models/User.js";
import Branch from "../src/shared/models/Branch.js";

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await connectDB();
    console.log("Connected successfully!");

    // 1. Retrieve the Main Branch ID
    const branchDoc = await Branch.findOne({ name: "Main Branch" });
    if (!branchDoc) {
      throw new Error("Main Branch not found! Please create a branch first.");
    }
    const branchId = branchDoc._id.toString();
    console.log(`Using Branch: ${branchDoc.name} (ID: ${branchId})`);

    // 2. Define the desired superadmin payload
    const email = "admin@almaa.com";
    const passwordText = "admin123";
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordText, salt);

    const targetPayload = {
      name: "System Admin",
      preferredName: "Admin",
      email: email,
      number: "6383225445",
      password: hashedPassword,
      role: "superAdmin",
      department: "admin",
      branch: branchId,
      isAdmin: true,
      active: true,
      accessModules: [
        "Leads",
        "Customers",
        "Reports",
        "Bulk Messages",
        "Messages log",
        "Chat Inbox",
        "Product Lead",
        "MD Camp",
        "Therapy"
      ],
      leads: 0,
      target: 0,
      achieved: 0
    };

    // 3. Update or Create User
    console.log(`Checking for user with email ${email}...`);
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      console.log(`Found existing user with ID: ${existingUser._id}. Updating fields to match schema...`);
      // Update fields
      const updatedUser = await User.findByIdAndUpdate(
        existingUser._id,
        { $set: targetPayload },
        { new: true, runValidators: true }
      );
      console.log("Successfully updated Super Admin user:");
      console.log(JSON.stringify(updatedUser, null, 2));
    } else {
      console.log("No user found. Creating new Super Admin user...");
      const newUser = await User.create(targetPayload);
      console.log("Successfully created Super Admin user:");
      console.log(JSON.stringify(newUser, null, 2));
    }

  } catch (error) {
    console.error("Error creating/updating Super Admin user:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

run();
