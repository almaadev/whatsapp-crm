import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function requireSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { session, error: null };
}

export function isAdminUser(user) {
  return (
    user?.role === "superAdmin" ||
    (user?.role === "sales" && user?.department === "admin") ||
    (user?.role === "doctor" && user?.department === "admin")
  );
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

export function verifyStudioLogSecret(req) {
  const secret = process.env.STUDIO_LOG_SECRET;
  if (!secret) return true;

  const provided =
    req.headers.get("x-studio-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return provided === secret;
}
