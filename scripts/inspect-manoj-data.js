import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import connectDB from "../src/shared/lib/db/mongodb.js";
import User from "../src/shared/models/User.js";
import Branch from "../src/shared/models/Branch.js";
import TwilioNumber from "../src/shared/models/TwilioNumber.js";

async function test() {
  await connectDB();
  const manoj = await User.findOne({ email: "manoj@gmail.com" }).lean();
  console.log("MANOJ DOC:", manoj);

  const allNumbers = await TwilioNumber.find()
    .populate("assignedAssociates", "name preferredName email department branch")
    .populate("branchId", "name code address phone")
    .populate("assignedAdmins", "name email")
    .lean();

  console.log("\nALL NUMBERS RAW:");
  for (const num of allNumbers) {
    console.log(`Number ${num.phoneNumber} (${num._id}):`);
    console.log(`  assignedAdmins:`, num.assignedAdmins?.map(a => a._id?.toString() || a.toString()));
    console.log(`  assignedAssociates:`, num.assignedAssociates?.map(a => a._id?.toString() || a.toString()));
  }

  const role = manoj.role;
  const department = manoj.department;
  const userId = (manoj.id || manoj._id)?.toString();
  const isAdmin = department === "admin" || role === "admin" || manoj.isAdmin;
  console.log("\nisAdmin for Manoj:", isAdmin);

  const assignedSenderIds = new Set(
    [
      ...(manoj.assignedSenderNumbers || []),
      ...(manoj.assignedTwilioNumbers || []),
      manoj.assignedSenderNumber,
    ]
      .filter(Boolean)
      .map((id) => (id._id || id).toString())
  );
  console.log("assignedSenderIds:", Array.from(assignedSenderIds));

  for (const num of allNumbers) {
    const numId = (num._id || num).toString();
    console.log(`Checking number ${num.phoneNumber} (${numId}):`);
    console.log(`  assignedSenderIds.has(${numId}):`, assignedSenderIds.has(numId));
    const isDirectAdmin = (num.assignedAdmins || []).some(
      (id) => (id?._id || id).toString() === userId
    );
    console.log(`  isDirectAdmin:`, isDirectAdmin);
    const isDirectAssociate = (num.assignedAssociates || []).some(
      (id) => (id?._id || id).toString() === userId
    );
    console.log(`  isDirectAssociate:`, isDirectAssociate);
  }

  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
