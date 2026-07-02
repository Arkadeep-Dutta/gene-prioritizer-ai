import { NextResponse } from "next/server";

import { getSecurityHeaders } from "@/lib/security/headers";

export function middleware() {
  const response = NextResponse.next();
  Object.entries(getSecurityHeaders()).forEach(([name, value]) =>
    response.headers.set(name, value),
  );
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
