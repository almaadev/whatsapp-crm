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