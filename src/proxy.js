import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function proxy(req) { 
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // 1. Yaarellam Admin nu check panrom
    const isAdmin = 
        token?.role === "superAdmin" || 
        (token?.role === "sales" && token?.department === "admin") || 
        (token?.role === "doctor" && token?.department === "admin");

    // 2. Entha pages ellam Admin mattum paaka koodiyathu nu set panrom
    const isAdminRoute = 
        path.startsWith("/crm/admin") || 
        path.startsWith("/crm/associate-management");

      
    if (isAdminRoute && !isAdmin) {
      return NextResponse.redirect(new URL("/crm/associate", req.url));
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
  matcher: ["/crm/:path*"],
};