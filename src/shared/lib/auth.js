import CredentialsProvider from "next-auth/providers/credentials";
import connectDB from "./db/mongodb.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

import redis from "./db/redis.js";
import crypto from "crypto";

const credentialsProviderFn = typeof CredentialsProvider === "function" ? CredentialsProvider : (CredentialsProvider?.default || CredentialsProvider);

export const authOptions = {
  providers: [
    credentialsProviderFn({
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
          branch: user.branch,
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
        token.branch = user.branch;
        token.accessModules = user.accessModules || [];
        token.jti = crypto.randomUUID();
      }

      // If token is missing accessModules, sync from DB
      if (token?.id && (!token.accessModules || !Array.isArray(token.accessModules))) {
        try {
          await connectDB();
          const dbUser = await User.findById(token.id).select("role department branch accessModules active").lean();
          if (dbUser && dbUser.active !== false) {
            token.role = dbUser.role;
            token.department = dbUser.department;
            token.branch = dbUser.branch;
            token.accessModules = dbUser.accessModules || [];
          }
        } catch (dbErr) {
          console.warn("[NextAuth jwt] DB sync warning:", dbErr.message);
        }
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
        session.user.branch = token.branch;
        session.user.accessModules = token.accessModules || [];
      }
      return session;
    },
  },
  pages: {
    signIn: "/", // Redirect here if not authenticated
  },
  secret: process.env.NEXTAUTH_SECRET,
};  
