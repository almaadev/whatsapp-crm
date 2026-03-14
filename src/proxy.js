import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) { 
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Strict Admin Protection for /dashboard/admin
    if (path.startsWith("/dashboard/admin") && token?.role !== "admin") {
      // If a non-admin tries to access admin panel, kick them to chat
      return NextResponse.redirect(new URL("/dashboard/chat", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token, // Only allow if logged in
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"],
};