import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isRouteAuthorized, isAPIAuthorized } from "./shared/utils/auth";

export default withAuth(
  function proxy(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Public APIs
    if (
      path.startsWith("/api/auth") ||
      path.startsWith("/api/webhook")
    ) {
      return NextResponse.next();
    }

    const session = {
      user: {
        id: token?.id,
        role: token?.role,
        department: token?.department,
        accessModules: token?.accessModules || [],
      },
    };

    // Protect APIs
    if (path.startsWith("/api/")) {
      if (!isAPIAuthorized(session, path)) {
        return NextResponse.json(
          {
            success: false,
            code: "ACCESS_DENIED",
            message: "You do not have permission to access this API.",
          },
          { status: 403 }
        );
      }

      const response = NextResponse.next();

      response.headers.set("X-Frame-Options", "DENY");
      response.headers.set("X-Content-Type-Options", "nosniff");
      response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

      return response;
    }

    // Protect CRM routes
    if (!isRouteAuthorized(session, path)) {
      return NextResponse.redirect(new URL("/crm", req.url));
    }

    const response = NextResponse.next();

    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return response;
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const path = req.nextUrl.pathname;

        if (
          path.startsWith("/api/auth") ||
          path.startsWith("/api/webhook")
        ) {
          return true;
        }

        if (process.env.NODE_ENV === "development") {
          if (
            req.headers.get("x-mock-role") &&
            req.headers.get("x-mock-department")
          ) {
            return true;
          }
        }

        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/crm/:path*", "/api/:path*"],
};