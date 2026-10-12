import mongoose from "mongoose";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  const MONGODB_URI =
    process.env.NODE_ENV === "test" && process.env.MONGODB_TEST_URI
      ? process.env.MONGODB_TEST_URI
      : process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env",
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      family: 4, // FIX: Forces Mongoose to use IPv4 instead of IPv6
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      mongoose.connection.once("open", () => {
        // Clean up legacy unique index on branches collection if it exists
        mongoose.connection.db.collection("branches").dropIndex("code_1").catch((err) => {
          if (err.codeName !== "IndexNotFound" && err.code !== 27) {
            console.warn("Could not drop legacy unique index 'code_1':", err.message);
          }
        });

        // Safely migrate legacy unique phone_1 index on leads to partial unique index
        mongoose.connection.db.collection("leads").indexes().then(async (leadIndexes) => {
          const oldPhoneIdx = leadIndexes.find(
            (idx) => idx.name === "phone_1" || (idx.key && idx.key.phone === 1)
          );
          if (oldPhoneIdx && oldPhoneIdx.unique && !oldPhoneIdx.partialFilterExpression) {
            console.log("⚠️ [MongoDB] Detected legacy non-partial unique index 'phone_1' on leads. Migrating to partial unique index...");
            await mongoose.connection.db.collection("leads").dropIndex(oldPhoneIdx.name);
            await mongoose.connection.db.collection("leads").createIndex(
              { phone: 1 },
              {
                unique: true,
                partialFilterExpression: { phone: { $type: "string", $gt: "" } },
                background: true,
              }
            );
            console.log("✅ [MongoDB] Migrated leads phone_1 index to partial unique index successfully.");
          }
        }).catch((err) => {
          if (err.codeName !== "NamespaceNotFound" && err.code !== 26) {
            console.warn("Notice checking leads phone index:", err.message);
          }
        });

        // Run user branch legacy data migration
        mongoose.connection.db.collection("users").find({}).toArray().then(async (users) => {
          const branches = await mongoose.connection.db.collection("branches").find({}).toArray();
          const branchMapByName = {};
          branches.forEach(b => {
            branchMapByName[b.name.toLowerCase()] = b._id;
          });
          for (const u of users) {
            if (u.branch) {
              const currentBranch = u.branch.toString();
              const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(currentBranch);
              if (!isValidObjectId) {
                const matchedBranchId = branchMapByName[currentBranch.toLowerCase()];
                if (matchedBranchId) {
                  await mongoose.connection.db.collection("users").updateOne(
                    { _id: u._id },
                    { $set: { branch: matchedBranchId.toString() } }
                  );
                  console.log(`[Migration] Updated user ${u.email} branch name "${u.branch}" to ID: ${matchedBranchId.toString()}`);
                }
              }
            }
          }
        }).catch(err => {
          console.warn("Error running user branch migration:", err.message);
        });
      });
      return mongoose;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
