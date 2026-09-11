import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const roleCookie = request.cookies.get("samarth_session_role")?.value;

  // Protect Startup routes
  if (pathname.startsWith("/startup")) {
    if (roleCookie !== "startup") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("error", "startup_role_required");
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect Government & Evaluator routes
  if (pathname.startsWith("/gov")) {
    if (roleCookie !== "govt_officer" && roleCookie !== "evaluator" && roleCookie !== "admin") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      loginUrl.searchParams.set("error", "gov_role_required");
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/startup/:path*", "/gov/:path*"],
};
