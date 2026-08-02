import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return (
    supabaseUrl.length > 0 &&
    supabaseUrl !== "your_supabase_url_here" &&
    supabaseAnonKey.length > 0 &&
    supabaseAnonKey !== "your_supabase_anon_key_here"
  );
};

// Cache the real client; fall back to a placeholder for build safety
let _client: SupabaseClient | null = null;

function createRealClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

// Export as a getter so it's not evaluated at module import time during build
export const supabase: SupabaseClient = new Proxy({} as unknown as SupabaseClient, {
  get(_target, prop: string) {
    if (!_client) {
      _client = isSupabaseConfigured()
        ? createRealClient()
        : createClient("https://placeholder.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder");
    }
    const val = (_client as unknown as Record<string, unknown>)[prop];
    return typeof val === "function" ? val.bind(_client) : val;
  },
}) as SupabaseClient;
