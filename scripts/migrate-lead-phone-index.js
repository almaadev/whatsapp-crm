/**
 * Database Migration Script: Leads Phone Unique Index Migration
 * 
 * Safely migrates the `leads` collection index from a legacy unique index on `phone`
 * (which causes E11000 duplicate key error on `{ phone: null }`) to a partial unique index
 * that enforces uniqueness only on valid, non-empty phone strings.
 * 
 * Usage:
 *   Dry Run (Safe preview):
 *     node --loader ./scripts/loader.js scripts/migrate-lead-phone-index.js
 * 
 *   Apply Migration:
 *     node --loader ./scripts/loader.js scripts/migrate-lead-phone-index.js --apply
 * 
 *   Rollback (Recreate legacy index if needed):
 *     node --loader ./scripts/loader.js scripts/migrate-lead-phone-index.js --rollback
 */
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());

import mongoose from "mongoose";
import connectDB from "../src/shared/lib/db/mongodb.js";

const isApplyMode = process.argv.includes("--apply");
const isRollbackMode = process.argv.includes("--rollback");
const isDryRun = !isApplyMode && !isRollbackMode;

async function runIndexMigration() {
  console.log("\n========================================================");
  console.log("🗄️  MONGO DB INDEX MIGRATION: LEADS PHONE PARTIAL UNIQUE INDEX");
  console.log(`MODE: ${isRollbackMode ? "🔄 ROLLBACK" : isApplyMode ? "⚡ APPLY" : "🔍 DRY RUN (PREVIEW)"}`);
  console.log("========================================================\n");

  await connectDB();
  const db = mongoose.connection.db;
  console.log(`Connected to Database: ${db.databaseName}\n`);

  const leadsCollection = db.collection("leads");

  // 1. Audit Existing Documents in leads
  const totalLeads = await leadsCollection.countDocuments();
  const nullOrMissingPhoneCount = await leadsCollection.countDocuments({
    $or: [{ phone: null }, { phone: { $exists: false } }, { phone: "" }],
  });
  const validPhoneCount = totalLeads - nullOrMissingPhoneCount;

  console.log("📊 Document Statistics on 'leads' collection:");
  console.log(`   - Total leads documents:             ${totalLeads}`);
  console.log(`   - Leads with missing/null/empty phone: ${nullOrMissingPhoneCount}`);
  console.log(`   - Leads with valid phone strings:     ${validPhoneCount}\n`);

  // 2. Check for Duplicate Valid Phone Numbers
  const phoneAggregation = await leadsCollection.aggregate([
    { $match: { phone: { $type: "string", $gt: "" } } },
    { $group: { _id: "$phone", count: { $sum: 1 }, ids: { $push: "$_id" } } },
    { $match: { count: { $gt: 1 } } },
  ]).toArray();

  if (phoneAggregation.length > 0) {
    console.warn("⚠️  WARNING: Duplicate valid phone numbers found among existing leads:");
    for (const dup of phoneAggregation) {
      console.warn(`   - Phone [${dup._id}] appears ${dup.count} times (IDs: ${dup.ids.join(", ")})`);
    }
    if (!isRollbackMode && isApplyMode) {
      console.error("❌ Cannot apply unique index without resolving duplicate valid phone strings first!");
      process.exit(1);
    }
  } else {
    console.log("✅ Zero duplicate valid phone strings found. Safe for unique index creation.\n");
  }

  // 3. Inspect Existing Indexes
  const existingIndexes = await leadsCollection.indexes();
  console.log("🔎 Current indexes on 'leads':");
  for (const idx of existingIndexes) {
    const isPhoneIdx = idx.name === "phone_1" || (idx.key && idx.key.phone === 1);
    console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${Boolean(idx.unique)}, partial: ${Boolean(idx.partialFilterExpression)}) ${isPhoneIdx ? "⬅️ [TARGET]" : ""}`);
  }
  console.log("");

  const existingPhoneIndex = existingIndexes.find(
    (idx) => idx.name === "phone_1" || (idx.key && idx.key.phone === 1)
  );

  // 4. Execution Logic
  if (isRollbackMode) {
    console.log("🔄 Executing ROLLBACK...");
    if (existingPhoneIndex) {
      console.log(`   Dropping index '${existingPhoneIndex.name}'...`);
      await leadsCollection.dropIndex(existingPhoneIndex.name);
      console.log(`   Index '${existingPhoneIndex.name}' dropped.`);
    }
    console.log("   Recreating legacy index: { phone: 1 }, { unique: true, sparse: true }...");
    await leadsCollection.createIndex({ phone: 1 }, { unique: true, sparse: true, background: true });
    console.log("✅ Rollback completed: Legacy sparse unique index applied.\n");
  } else if (isApplyMode) {
    console.log("⚡ Executing MIGRATION...");
    if (existingPhoneIndex) {
      console.log(`   Dropping existing index '${existingPhoneIndex.name}'...`);
      await leadsCollection.dropIndex(existingPhoneIndex.name);
      console.log(`   Index '${existingPhoneIndex.name}' dropped.`);
    }

    console.log("   Creating partial unique index: { phone: 1 } with partialFilterExpression: { phone: { $type: 'string', $gt: '' } }...");
    await leadsCollection.createIndex(
      { phone: 1 },
      {
        unique: true,
        partialFilterExpression: { phone: { $type: "string", $gt: "" } },
        background: true,
      }
    );
    console.log("✅ Partial unique index on 'leads.phone' successfully created!\n");
  } else {
    console.log("🔍 DRY RUN SUMMARY:");
    if (existingPhoneIndex) {
      if (existingPhoneIndex.unique && existingPhoneIndex.partialFilterExpression) {
        console.log("   ✅ Target partial unique index is ALREADY present and healthy.");
      } else {
        console.log(`   ⚠️ Found index '${existingPhoneIndex.name}' without proper partial filter.`);
        console.log("   ⚡ Migration will drop it and replace it with partial unique index.");
      }
    } else {
      console.log("   ℹ️ No 'phone_1' index currently exists on leads.");
      console.log("   ⚡ Migration will create a new partial unique index on { phone: 1 }.");
    }
    console.log("\n💡 To apply this migration to the database, run:");
    console.log("   node --loader ./scripts/loader.js scripts/migrate-lead-phone-index.js --apply\n");
    console.log("💡 To rollback, run:");
    console.log("   node --loader ./scripts/loader.js scripts/migrate-lead-phone-index.js --rollback\n");
  }

  // 5. Verify Final Index State
  if (isApplyMode || isRollbackMode) {
    const updatedIndexes = await leadsCollection.indexes();
    console.log("📋 Verified indexes on 'leads' collection:");
    for (const idx of updatedIndexes) {
      console.log(`   - ${idx.name}: ${JSON.stringify(idx.key)} (unique: ${Boolean(idx.unique)}, partialFilter: ${JSON.stringify(idx.partialFilterExpression || null)})`);
    }
    console.log("");
  }

  await mongoose.disconnect();
  process.exit(0);
}

runIndexMigration().catch((err) => {
  console.error("❌ Migration failed with error:", err);
  process.exit(1);
});
