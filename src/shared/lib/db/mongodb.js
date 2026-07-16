import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env",
  );
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      family: 4, // FIX: Forces Mongoose to use IPv4 instead of IPv6
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      // Clean up legacy unique index on branches collection if it exists
      mongoose.connection.once("open", () => {
        mongoose.connection.db.collection("branches").dropIndex("code_1").catch((err) => {
          if (err.codeName !== "IndexNotFound" && err.code !== 27) {
            console.warn("Could not drop legacy unique index 'code_1':", err.message);
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
