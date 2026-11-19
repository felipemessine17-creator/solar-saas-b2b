const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://hsgqrbohxerubeiwabhw.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_FdK7Tt31uEMvRgIZ1vbr3A_qEvoR7iF";

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseEnv(): { url: string; anonKey: string } {
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}