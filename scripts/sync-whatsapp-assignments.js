/**
 * scripts/sync-whatsapp-assignments.js
 * 
 * Safely repairs and synchronizes WhatsApp number assignments across:
 * 1. TwilioNumber.assignedAssociates (Canonical many-to-many source of truth)
 * 2. TwilioNumber.assignedAdmins (Removes non-admin associates)
 * 3. User.assignedSenderNumbers, User.assignedTwilioNumbers, User.assignedSenderNumber
 * 4. Invalidates Redis cache
 */

import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import connectDB from "../src/shared/lib/db/mongodb.js";
import User from "../src/shared/models/User.js";
import Branch from "../src/shared/models/Branch.js";
import TwilioNumber from "../src/shared/models/TwilioNumber.js";
import { isAdminAuthorized } from "../src/shared/utils/auth.js";

async function runSync() {
  console.log("\n=======================================================");
  console.log("🔄 STARTING WHATSAPP ASSIGNMENT CANONICAL SYNCHRONIZATION");
  console.log("=======================================================\n");

  await connectDB();

  const allUsers = await User.find({}).lean();
  const allTwilioNumbers = await TwilioNumber.find({}).lean();

  console.log(`📊 Found ${allUsers.length} total users and ${allTwilioNumbers.length} WhatsApp numbers.`);

  const userMap = new Map();
  allUsers.forEach((u) => userMap.set(u._id.toString(), u));

  let cleanedAdminCount = 0;
  let syncedUserCount = 0;

  // ─── STEP A: Clean non-admins from TwilioNumber.assignedAdmins ──────────────
  console.log("\n🧹 Step A: Auditing TwilioNumber.assignedAdmins for non-admin associates...");

  for (const num of allTwilioNumbers) {
    const rawAdmins = (num.assignedAdmins || []).map((id) => (id._id || id).toString());
    const validAdmins = [];
    const removedAssociates = [];

    for (const adminId of rawAdmins) {
      const userDoc = userMap.get(adminId);
      if (!userDoc) {
        removedAssociates.push(`Unknown (${adminId})`);
        continue;
      }

      const isLegitAdmin = isAdminAuthorized(userDoc.role, userDoc.department);
      if (isLegitAdmin) {
        validAdmins.push(userDoc._id);
      } else {
        removedAssociates.push(`${userDoc.name} (${userDoc.email} [${userDoc.role}/${userDoc.department}])`);
        cleanedAdminCount++;
      }
    }

    if (removedAssociates.length > 0) {
      console.log(`  🔹 Number ${num.phoneNumber} (${num.friendlyName}): Removing non-admin IDs -> ${removedAssociates.join(", ")}`);
      await TwilioNumber.findByIdAndUpdate(num._id, {
        $set: { assignedAdmins: validAdmins },
      });
    }
  }

  // ─── STEP B & C: Synchronize User Legacy Fields from Canonical TwilioNumbers ─
  console.log("\n🔄 Step B & C: Rebuilding User reference fields from TwilioNumber.assignedAssociates...");

  for (const user of allUsers) {
    const userIdStr = user._id.toString();
    const isSuper = user.role === "superAdmin";
    const isAdmin = isAdminAuthorized(user.role, user.department);

    if (isSuper) {
      // Super admin does not require restricted assignment fields
      continue;
    }

    if (isAdmin) {
      // For Admin, sync from TwilioNumber.assignedAdmins or TwilioNumber.assignedAssociates
      const adminNumbers = await TwilioNumber.find({
        $or: [
          { assignedAdmins: user._id },
          { assignedAssociates: user._id },
        ],
      }).select("_id").lean();

      const numIds = adminNumbers.map((n) => n._id);
      await User.findByIdAndUpdate(user._id, {
        $set: {
          assignedSenderNumbers: numIds,
          assignedTwilioNumbers: numIds,
          assignedSenderNumber: numIds.length > 0 ? numIds[0] : null,
        },
      });
      syncedUserCount++;
      continue;
    }

    // For Normal Associate: Canonical relationship is TwilioNumber.assignedAssociates
    const canonicalNumbers = await TwilioNumber.find({
      assignedAssociates: user._id,
    }).select("_id").lean();

    const numIds = canonicalNumbers.map((n) => n._id);

    await User.findByIdAndUpdate(user._id, {
      $set: {
        assignedSenderNumbers: numIds,
        assignedTwilioNumbers: numIds,
        assignedSenderNumber: numIds.length > 0 ? numIds[0] : null,
      },
    });

    syncedUserCount++;
  }

  // ─── STEP D: Invalidate Redis Cache ─────────────────────────────────────────
  console.log("\n🧹 Step D: Invalidating Redis cache...");
  try {
    const redisModule = await import("../src/shared/lib/db/redis.js").catch(() => null);
    const redis = redisModule?.default;
    if (redis && redis.status === "ready") {
      await redis.del("users:all");
      console.log("  ✅ Cleared users:all in Redis.");
    } else {
      console.log("  ℹ️ Redis not connected or ready; skipping cache clear.");
    }
  } catch (err) {
    console.warn("  ⚠️ Redis cache invalidation notice:", err.message);
  }

  console.log("\n=======================================================");
  console.log(`✅ SYNC COMPLETE: Cleaned ${cleanedAdminCount} invalid admin assignments, synchronized ${syncedUserCount} users.`);
  console.log("=======================================================\n");

  process.exit(0);
}

runSync().catch((err) => {
  console.error("❌ Synchronization script failed:", err);
  process.exit(1);
});
