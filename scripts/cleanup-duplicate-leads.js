/**
 * Safe Duplicate Lead & Customer Cleanup / Migration Script
 * 
 * Usage:
 *   Dry Run (Safe, no changes made):
 *     node --loader ./scripts/loader.js scripts/cleanup-duplicate-leads.js
 *     node --loader ./scripts/loader.js scripts/cleanup-duplicate-leads.js --dry-run
 * 
 *   Apply Changes:
 *     node --loader ./scripts/loader.js scripts/cleanup-duplicate-leads.js --apply
 */
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import connectDB from "../src/shared/lib/db/mongodb.js";
import Customer from "../src/shared/models/Customer.js";
import Lead from "../src/shared/models/Lead.js";
import Message from "../src/shared/models/Message.js";
import Activity from "../src/shared/models/Activity.js";
import { normalizePhone, getPhoneVariations } from "../src/shared/utils/phoneUtils.js";

const isApplyMode = process.argv.includes("--apply");
const isDryRun = !isApplyMode;

async function runCleanup() {
  console.log("\n========================================================");
  console.log(`🧹 CRM DUPLICATE LEAD CLEANUP & RECONCILIATION SCRIPT`);
  console.log(`MODE: ${isApplyMode ? "⚡ APPLY (LIVE CHANGES)" : "🔍 DRY RUN (SAFE PREVIEW)"}`);
  console.log("========================================================\n");

  await connectDB();

  // 1. Snapshot Initial Counts
  const initialCustomersCount = await Customer.countDocuments();
  const initialLeadsCount = await Lead.countDocuments();
  const initialMessagesCount = await Message.countDocuments();
  const initialActivitiesCount = await Activity.countDocuments();

  console.log(`📊 Initial Database State:`);
  console.log(`   - Customers:  ${initialCustomersCount}`);
  console.log(`   - Leads:      ${initialLeadsCount}`);
  console.log(`   - Messages:   ${initialMessagesCount}`);
  console.log(`   - Activities: ${initialActivitiesCount}\n`);

  let duplicateCustomerGroupsCount = 0;
  let duplicateCustomersRemovedCount = 0;
  let duplicateLeadGroupsCount = 0;
  let duplicateLeadsMergedCount = 0;
  let orphanedLeadsCount = 0;
  let messagesReassignedCount = 0;
  let activitiesReassignedCount = 0;

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 1: Reconcile Duplicate Customer Records by Normalized Phone
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("🔍 Step 1: Checking for duplicate Customer records...");
  const allCustomers = await Customer.find().lean();
  const phoneCustomerMap = new Map();

  for (const cust of allCustomers) {
    const raw = cust.phone || "";
    const cleanDigits = raw.replace(/\D/g, "").slice(-10);
    if (!cleanDigits) continue;
    if (!phoneCustomerMap.has(cleanDigits)) {
      phoneCustomerMap.set(cleanDigits, []);
    }
    phoneCustomerMap.get(cleanDigits).push(cust);
  }

  for (const [cleanDigits, custList] of phoneCustomerMap.entries()) {
    if (custList.length <= 1) continue;

    duplicateCustomerGroupsCount++;
    // Sort canonical customer: prefer standard 'whatsapp:+91' prefix, or oldest createdAt
    custList.sort((a, b) => {
      const aIsStandard = (a.phone || "").startsWith("whatsapp:+91");
      const bIsStandard = (b.phone || "").startsWith("whatsapp:+91");
      if (aIsStandard && !bIsStandard) return -1;
      if (!aIsStandard && bIsStandard) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const canonicalCustomer = custList[0];
    const duplicateCustomers = custList.slice(1);

    console.log(`   Found duplicate customer group for phone [${cleanDigits}]:`);
    console.log(`   -> Canonical: ID=${canonicalCustomer._id} Phone=${canonicalCustomer.phone} Name=${canonicalCustomer.name}`);

    for (const dupCust of duplicateCustomers) {
      console.log(`   -> Duplicate: ID=${dupCust._id} Phone=${dupCust.phone} Name=${dupCust.name}`);
      duplicateCustomersRemovedCount++;

      if (isApplyMode) {
        // Reassign leads, messages, activities to canonical customer
        await Lead.updateMany({ customerId: dupCust._id }, { customerId: canonicalCustomer._id });
        const msgRes = await Message.updateMany({ phone: dupCust.phone }, { phone: canonicalCustomer.phone });
        const actRes = await Activity.updateMany({ customerId: dupCust._id }, { customerId: canonicalCustomer._id });
        messagesReassignedCount += msgRes.modifiedCount || 0;
        activitiesReassignedCount += actRes.modifiedCount || 0;

        await Customer.deleteOne({ _id: dupCust._id });
      }
    }
  }

  console.log(`   Duplicate customer groups resolved: ${duplicateCustomerGroupsCount}\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 2: Reconcile Duplicate Lead Records per Customer
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("🔍 Step 2: Checking for duplicate Lead records per Customer...");
  const validCustomers = await Customer.find().select("_id phone name activeLeadId").lean();
  const validCustomerIds = validCustomers.map((c) => c._id.toString());
  const validCustomerIdSet = new Set(validCustomerIds);

  const allLeads = await Lead.find().lean();
  const customerLeadMap = new Map();

  for (const lead of allLeads) {
    const cId = lead.customerId ? lead.customerId.toString() : null;
    if (!cId || !validCustomerIdSet.has(cId)) {
      continue;
    }
    if (!customerLeadMap.has(cId)) {
      customerLeadMap.set(cId, []);
    }
    customerLeadMap.get(cId).push(lead);
  }

  for (const [cId, leadList] of customerLeadMap.entries()) {
    if (leadList.length <= 1) continue;

    duplicateLeadGroupsCount++;
    // Sort to pick canonical lead:
    // 1. Most follow-up entries (leads.length)
    // 2. Active (isClosed === false)
    // 3. Most recently updated
    leadList.sort((a, b) => {
      const aFollowups = (a.leads || []).length;
      const bFollowups = (b.leads || []).length;
      if (bFollowups !== aFollowups) return bFollowups - aFollowups;

      if (!a.isClosed && b.isClosed) return -1;
      if (a.isClosed && !b.isClosed) return 1;

      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });

    const canonicalLead = leadList[0];
    const duplicateLeads = leadList.slice(1);

    console.log(`   Customer [${cId}] has ${leadList.length} Lead documents:`);
    console.log(`   -> Canonical Lead: ID=${canonicalLead._id} (Followups: ${(canonicalLead.leads || []).length}, Closed: ${canonicalLead.isClosed})`);

    const mergedFollowups = [...(canonicalLead.leads || [])];
    const seenFollowupKeys = new Set(
      mergedFollowups.map((f) => `${new Date(f.date).toISOString()}_${f.status}_${f.overAllRemarks || ""}`)
    );

    const mergedHandoffs = [...(canonicalLead.handledByHistory || [])];
    const seenHandoffKeys = new Set(
      mergedHandoffs.map((h) => `${h.associateId}_${new Date(h.assignedAt).toISOString()}`)
    );

    for (const dupLead of duplicateLeads) {
      duplicateLeadsMergedCount++;
      console.log(`   -> Merging Duplicate Lead: ID=${dupLead._id} (Followups: ${(dupLead.leads || []).length})`);

      // Merge followups
      for (const fu of dupLead.leads || []) {
        const key = `${new Date(fu.date).toISOString()}_${fu.status}_${fu.overAllRemarks || ""}`;
        if (!seenFollowupKeys.has(key)) {
          seenFollowupKeys.add(key);
          mergedFollowups.push(fu);
        }
      }

      // Merge handoff history
      for (const h of dupLead.handledByHistory || []) {
        const key = `${h.associateId}_${new Date(h.assignedAt).toISOString()}`;
        if (!seenHandoffKeys.has(key)) {
          seenHandoffKeys.add(key);
          mergedHandoffs.push(h);
        }
      }

      if (isApplyMode) {
        // Re-point Messages and Activities
        const msgRes = await Message.updateMany({ leadId: dupLead._id }, { leadId: canonicalLead._id });
        const actRes = await Activity.updateMany({ leadId: dupLead._id }, { leadId: canonicalLead._id });
        messagesReassignedCount += msgRes.modifiedCount || 0;
        activitiesReassignedCount += actRes.modifiedCount || 0;

        // Delete duplicate lead document
        await Lead.deleteOne({ _id: dupLead._id });
      }
    }

    if (isApplyMode) {
      mergedFollowups.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      await Lead.updateOne(
        { _id: canonicalLead._id },
        {
          $set: {
            leads: mergedFollowups,
            handledByHistory: mergedHandoffs,
            assignedTo: canonicalLead.assignedTo || null,
            associateId: canonicalLead.associateId || "",
          },
        }
      );
      await Customer.updateOne({ _id: cId }, { activeLeadId: canonicalLead._id });
    }
  }

  console.log(`   Duplicate lead groups merged: ${duplicateLeadGroupsCount}\n`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 3: Clean up Orphaned Lead Records (No Matching Customer)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("🔍 Step 3: Checking for orphaned Lead records (no existing customer)...");
  const orphanedLeads = allLeads.filter((l) => !l.customerId || !validCustomerIdSet.has(l.customerId.toString()));
  orphanedLeadsCount = orphanedLeads.length;

  console.log(`   Found ${orphanedLeadsCount} orphaned Lead documents.`);
  if (orphanedLeadsCount > 0) {
    if (isApplyMode) {
      const orphanedIds = orphanedLeads.map((l) => l._id);
      const delRes = await Lead.deleteMany({ _id: { $in: orphanedIds } });
      console.log(`   Deleted ${delRes.deletedCount} orphaned Lead documents.`);
    } else {
      console.log(`   [DRY RUN] Would delete ${orphanedLeadsCount} orphaned Lead documents.`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP 4: Enforce Unique Index on Lead.customerId
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n🔒 Step 4: Enforcing unique database index on Lead.customerId...");
  if (isApplyMode) {
    try {
      const indexes = await Lead.collection.indexes();
      const existingCustIndex = indexes.find((idx) => idx.name === "customerId_1" || (idx.key && idx.key.customerId === 1));

      if (existingCustIndex && !existingCustIndex.unique) {
        console.log(`   Dropping non-unique index '${existingCustIndex.name}'...`);
        await Lead.collection.dropIndex(existingCustIndex.name);
      }

      console.log("   Creating unique index: { customerId: 1 }, { unique: true }...");
      await Lead.collection.createIndex({ customerId: 1 }, { unique: true, background: true });
      console.log("   ✅ Unique index on Lead.customerId successfully applied.");
    } catch (idxErr) {
      console.error("   ⚠️ Index creation warning:", idxErr.message);
    }
  } else {
    console.log("   [DRY RUN] Would drop non-unique customerId_1 and apply unique index { customerId: 1 }.");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Summary Report
  // ─────────────────────────────────────────────────────────────────────────────
  const finalCustomersCount = isApplyMode ? await Customer.countDocuments() : initialCustomersCount - duplicateCustomersRemovedCount;
  const finalLeadsCount = isApplyMode ? await Lead.countDocuments() : initialLeadsCount - duplicateLeadsMergedCount - orphanedLeadsCount;

  console.log("\n========================================================");
  console.log("📋 RECONCILIATION SUMMARY REPORT");
  console.log("========================================================");
  console.log(`Status:                       ${isApplyMode ? "✅ APPLIED SUCCESSFULLY" : "🔍 DRY RUN COMPLETED"}`);
  console.log(`Duplicate Customer Groups:    ${duplicateCustomerGroupsCount}`);
  console.log(`Duplicate Customers Removed:  ${duplicateCustomersRemovedCount}`);
  console.log(`Duplicate Lead Groups:        ${duplicateLeadGroupsCount}`);
  console.log(`Duplicate Leads Merged:       ${duplicateLeadsMergedCount}`);
  console.log(`Orphaned Leads Cleaned:       ${orphanedLeadsCount}`);
  console.log(`Messages Reassigned:          ${messagesReassignedCount}`);
  console.log(`Activities Reassigned:        ${activitiesReassignedCount}`);
  console.log(`Customers Count:              ${initialCustomersCount} -> ${finalCustomersCount}`);
  console.log(`Leads Count:                  ${initialLeadsCount} -> ${finalLeadsCount}`);
  console.log("========================================================\n");

  if (!isApplyMode) {
    console.log("💡 To apply these changes to the live database, run:");
    console.log("   node --loader ./scripts/loader.js scripts/cleanup-duplicate-leads.js --apply\n");
  }

  process.exit(0);
}

runCleanup().catch((err) => {
  console.error("❌ Cleanup script failed:", err);
  process.exit(1);
});
