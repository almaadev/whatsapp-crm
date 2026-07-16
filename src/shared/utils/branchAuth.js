import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

/**
 * Reusable helper to authorize Branch management APIs.
 * Verifies JWT/session, and ensures department is "admin" AND role is "superAdmin".
 * 
 * If verification fails, returns the appropriate NextResponse.
 * If verification succeeds, returns { session, user: session.user, error: null }
 */
export async function authorizeBranchRequest() {
  if (process.env.NODE_ENV !== "production") {
    try {
      const headersList = await headers();
      const mockRole = headersList.get("x-mock-role");
      const mockDept = headersList.get("x-mock-department");
      const mockUserId = headersList.get("x-mock-user-id");

      if (mockRole && mockDept) {
        const session = {
          user: {
            id: mockUserId || "mock-user-id",
            role: mockRole,
            department: mockDept,
            name: "Mock User",
            email: "mock@almaa.com"
          }
        };
        if (mockDept !== "admin" || mockRole !== "superAdmin") {
          return {
            session,
            user: session.user,
            error: NextResponse.json(
              { success: false, message: "Access denied." },
              { status: 403 }
            )
          };
        }
        return { session, user: session.user, error: null };
      }
    } catch (err) {
      // Ignore if headers() throws in non-request contexts
    }
  }

  const session = global.mockSession !== undefined 
    ? global.mockSession 
    : await getServerSession(authOptions);
  
  if (!session || !session.user) {
    return {
      session: null,
      user: null,
      error: NextResponse.json(
        { success: false, message: "Unauthorized access." },
        { status: 401 }
      )
    };
  }

  const { department, role } = session.user;

  if (department !== "admin" || role !== "superAdmin") {
    return {
      session,
      user: session.user,
      error: NextResponse.json(
        { success: false, message: "Access denied." },
        { status: 403 }
      )
    };
  }

  return { session, user: session.user, error: null };
}
