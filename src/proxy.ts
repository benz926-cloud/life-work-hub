import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // All auth protection is handled client-side via AuthContext.
  // Server-side cookie-based session check is incompatible with
  // supabase-js's localStorage-based session storage in PWA/SPA mode.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
