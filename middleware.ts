import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Roda só onde há login envolvido (a página pública /[slug] não paga esse custo).
export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
