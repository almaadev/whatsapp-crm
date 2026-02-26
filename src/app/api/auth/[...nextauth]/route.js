import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// 2. Pass authOptions to NextAuth
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };