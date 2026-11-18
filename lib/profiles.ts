import { cache } from "react";
import { createPublicClient } from "./supabase/public";
import { SLUG_REGEX } from "./profiles-shared";
import { PUBLIC_PROFILE_FIELDS, type PublicProfile } from "./types";

/** Busca os dados públicos do empresário pelo slug do link (uso no servidor). */
export async function fetchPublicProfile(slug: string): Promise<PublicProfile | null> {
  let clean = "";
  try {
    clean = decodeURIComponent(slug || "").trim().toLowerCase();
  } catch {
    return null;
  }
  if (!SLUG_REGEX.test(clean)) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PUBLIC_PROFILE_FIELDS)
    .eq("slug", clean)
    .maybeSingle();

  if (error) {
    console.error("[profiles] erro ao buscar perfil:", error.message);
    return null;
  }

  return (data as unknown as PublicProfile | null) ?? null;
}

/** Versão com cache por request (evita buscar 2x entre metadata e página). */
export const getPublicProfile = cache(fetchPublicProfile);
