import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/shared/lib/auth";
import { cache } from "react";
import connectDB from "@/shared/lib/db/mongodb";
import User from "@/shared/models/User";

export const getCurrentUser = cache(async () => {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return null;
  }

  await connectDB();
  const dbUser = await User.findById(session.user.id).lean();
  
  if (!dbUser || dbUser.active === false) {
    return null;
  }
  
  return {
    ...session.user,
    id: dbUser._id.toString(),
    name: dbUser.name,
    email: dbUser.email,
    role: dbUser.role,
    department: dbUser.department,
    accessModules: dbUser.accessModules,
  };
});

export async function requireSession() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const session = { user };
  return { session, error: null };
}

export async function requireAdmin() {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };

  if (!isAdminUser(session.user)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { session, error: null };
}

export async function authorize({ 
  allowedRoles = [], 
  allowedDepartments = [], 
  allowedModules = [], 
  allowSuperAdmin = true 
} = {}) {
  const { session, error } = await requireSession();
  if (error) return { session: null, error };
  const user = session.user;

  if (allowSuperAdmin && user.role === "superAdmin") {
    return { session, user, error: null };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { session, error: NextResponse.json({ error: `Forbidden: Requires role ${allowedRoles.join(' or ')}` }, { status: 403 }) };
  }

  if (allowedDepartments.length > 0 && !allowedDepartments.includes(user.department)) {
    return { session, error: NextResponse.json({ error: `Forbidden: Requires department ${allowedDepartments.join(' or ')}` }, { status: 403 }) };
  }

  if (allowedModules.length > 0) {
    const hasModule = allowedModules.some(m => (user.accessModules || []).includes(m));
    if (!hasModule) {
      return { session, error: NextResponse.json({ error: `Forbidden: Missing required module access` }, { status: 403 }) };
    }
  }

  return { session, user, error: null };
}

export function verifyStudioLogSecret(req) {
  const secret = process.env.STUDIO_LOG_SECRET;
  if (!secret) return true;

  const provided =
    req.headers.get("x-studio-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return provided === secret;
}
