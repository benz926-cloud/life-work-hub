import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return (
    supabaseUrl.length > 0 &&
    supabaseUrl !== "your_supabase_url_here" &&
    supabaseAnonKey.length > 0 &&
    supabaseAnonKey !== "your_supabase_anon_key_here"
  );
}

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    if (isSupabaseConfigured()) {
      _client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
    } else {
      // Placeholder — won't make real API calls
      _client = createClient(
        "https://placeholder.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder"
      );
    }
  }
  return _client;
}
