import CredentialsProvider from "next-auth/providers/credentials";
<<<<<<< HEAD
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

=======
import connectDB from "./mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

import redis from "./redis";
import crypto from "crypto";

>>>>>>> c1be5bc (Initial commit from new system)
export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
<<<<<<< HEAD
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        await connectDB();
        
        const user = await User.findOne({ email: credentials.email }).lean();
        
        if (user) {
          const isMatch = (await bcrypt.compare(credentials.password, user.password).catch(()=>false)) || credentials.password === user.password;
          
          if (isMatch) {
            return { 
                id: user._id.toString(), 
                name: user.name, 
                email: user.email, 
                role: user.role, 
                department: user.department,
                accessModules: user.accessModules || [] 
            };
          }
        }
        return null;
      }
    })
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) { 
        token.role = user.role;  
        token.id = user.id; 
        token.department = user.department; 
        // 👇 FIX: Token-la set panrom
        token.accessModules = user.accessModules; 
      }
      return token;
    },
    async session({ session, token }) {
      if (token) { 
        session.user.role = token.role; 
        session.user.department = token.department; 
        session.user.id = token.id; 
        // 👇 FIX: Session-la add panrom
        session.user.accessModules = token.accessModules; 
      }
      return session;
    }
  },
  pages: { signIn: "/" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
=======
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        await connectDB();

        const user = await User.findOne({ email: credentials.email });

        if (!user) {
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
    maxAge: 30 * 24 * 60 * 60, // 30 Days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.department = user.department;
        token.accessModules = user.accessModules;
        
        // Assign a unique JWT ID for blacklisting capability
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
>>>>>>> c1be5bc (Initial commit from new system)
