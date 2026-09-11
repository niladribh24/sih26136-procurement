import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const roleCookie = request.cookies.get("samarth_session_role")?.value;
  const fullTarget = pathname + (request.nextUrl.search || "");

  // Intercept root dashboard paths
  if (pathname === "/startup" || pathname === "/startup/") {
    if (roleCookie === "startup") {
      return NextResponse.redirect(new URL("/startup/problems", request.url));
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", "/startup/problems");
    loginUrl.searchParams.set("error", "startup_role_required");
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/gov" || pathname === "/gov/") {
    if (roleCookie === "govt_officer" || roleCookie === "evaluator" || roleCookie === "admin") {
      return NextResponse.redirect(new URL("/gov/problems", request.url));
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", "/gov/problems");
    loginUrl.searchParams.set("error", "gov_role_required");
    return NextResponse.redirect(loginUrl);
  }

  // Protect Startup routes
  if (pathname.startsWith("/startup")) {
    if (roleCookie !== "startup") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", fullTarget);
      loginUrl.searchParams.set("error", "startup_role_required");
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect Government & Evaluator routes
  if (pathname.startsWith("/gov")) {
    if (roleCookie !== "govt_officer" && roleCookie !== "evaluator" && roleCookie !== "admin") {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", fullTarget);
      loginUrl.searchParams.set("error", "gov_role_required");
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/startup", "/startup/:path*", "/gov", "/gov/:path*"],
};
