import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth pages, static files, and API routes
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.match(/\.(ico|png|jpg|svg|json|js|css|xml)$/)
  ) {
    return NextResponse.next();
  }

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured, allow access (mock data mode)
  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl === "your_supabase_url_here" ||
    supabaseKey === "your_supabase_anon_key_here"
  ) {
    return NextResponse.next();
  }

  // Verify session
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: { session } } = await supabase.auth.getSession();

  // Not authenticated → redirect to login
  if (!session) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
