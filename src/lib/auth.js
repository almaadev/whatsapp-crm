import CredentialsProvider from "next-auth/providers/credentials";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        await connectDB();
        
        const user = await User.findOne({ email: credentials.email }).lean();
        
        if (user) {
          // Check if password matches (Supports both hashed and old plain-text passwords during transition)
          const isMatch = (await bcrypt.compare(credentials.password, user.password).catch(()=>false)) || credentials.password === user.password;
          
          if (isMatch) {
            return { id: user._id.toString(), name: user.name, email: user.email, role: user.role };
          }
        }
        return null;
      }
    })
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = user.role; token.id = user.id; }
      return token;
    },
    async session({ session, token }) {
      if (token) { session.user.role = token.role; session.user.id = token.id; }
      return session;
    }
  },
  pages: { signIn: "/" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  
};