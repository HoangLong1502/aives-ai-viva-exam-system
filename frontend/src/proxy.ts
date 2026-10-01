import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { homeForRole } from "@/lib/role-home";
import { decodeTokenClaims } from "@/lib/session-token";
import type { Role } from "@/lib/types";

const PUBLIC_PATHS = new Set(["/login"]);

export function proxy(request: NextRequest) {
  const token = request.cookies.get("aives_token")?.value;
  const isAuthed = Boolean(token);
  const { pathname } = request.nextUrl;
  const role = token ? decodeTokenClaims(token)?.role : undefined;

  if (pathname === "/login" && isAuthed && role) {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  if (!PUBLIC_PATHS.has(pathname) && !isAuthed) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthed && role && !allows(pathname, role)) {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  return NextResponse.next();
}

function allows(pathname: string, role: Role) {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return role === "ADMIN";
  if (pathname === "/teacher" || pathname.startsWith("/teacher/")) return role === "EXAMINER";
  if (pathname === "/student" || pathname.startsWith("/student/")) return role === "STUDENT";
  return true;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
