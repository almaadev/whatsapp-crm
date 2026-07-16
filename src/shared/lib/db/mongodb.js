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
<<<<<<< HEAD
      // Clean up legacy unique index on branches collection if it exists
      mongoose.connection.once("open", () => {
        mongoose.connection.db.collection("branches").dropIndex("code_1").catch((err) => {
          if (err.codeName !== "IndexNotFound" && err.code !== 27) {
            console.warn("Could not drop legacy unique index 'code_1':", err.message);
          }
        });
      });
=======
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
      return mongoose;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
