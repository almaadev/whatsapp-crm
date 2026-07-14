import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isRouteAuthorized, isAPIAuthorized } from "./shared/utils/auth";

export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Bypass public API paths from proxy middleware logic
    if (path.startsWith("/api/auth") || path.startsWith("/api/webhook")) {
      return NextResponse.next();
    }

    const session = {
      user: {
        role: token?.role,
        department: token?.department,
        accessModules: token?.accessModules || [],
      },
    };

    if (path.startsWith("/api/")) {
      if (!isAPIAuthorized(session, path)) {
        return NextResponse.json({ error: "Access Denied" }, { status: 403 });
      }
      return NextResponse.next();
    }

    if (!isRouteAuthorized(session, path)) {
      // Redirect to /crm which handles routing dynamically based on role/department
      return NextResponse.redirect(new URL("/crm", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const path = req.nextUrl.pathname;
        if (path.startsWith("/api/auth") || path.startsWith("/api/webhook")) {
          return true;
        }
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/crm/:path*", "/api/:path*"],
};

