import CredentialsProvider from "next-auth/providers/credentials";
<<<<<<<< HEAD:src/shared/lib/auth.js
import connectDB from "@/shared/lib/db/mongodb";
import User from "@/shared/models/User";
import bcrypt from "bcryptjs";

import redis from "@/shared/lib/db/redis";
========
import connectDB from "./db/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

import redis from "./db/redis";
>>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32:src/lib/auth.js
import crypto from "crypto";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid email or password");
        }

        await connectDB();

        const user = await User.findOne({
          email: credentials.email.toLowerCase().trim(),
        });

        if (!user || user.active === false) {
          throw new Error("Invalid email or password");
        }

        const isMatch = await bcrypt.compare(credentials.password, user.password);

        if (!isMatch) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          accessModules: user.accessModules,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.department = user.department;
        token.accessModules = user.accessModules;
        token.jti = crypto.randomUUID();
      }

      // SECURITY ENHANCEMENT: Check Token Blacklist in Redis
      if (token.jti && redis && redis.status === "ready") {
        const isRevoked = await redis.get(`blacklist:${token.jti}`);
        if (isRevoked) {
          // Throwing an error here immediately destroys the session and denies access to protected APIs/Pages
          throw new Error("Session has been revoked. Please log in again.");
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.department = token.department;
        session.user.accessModules = token.accessModules;
      }
      return session;
    },
  },
  pages: {
    signIn: "/", // Redirect here if not authenticated
  },
  secret: process.env.NEXTAUTH_SECRET,
};  
