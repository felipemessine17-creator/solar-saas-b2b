/* ==========================================================================
 * ARQUIVO 9 de 17: app/api/leads/route.ts   [ARQUIVO ALTERADO (substituir)]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── app/
 *         └── api/
 *              └── leads/
 *                   └── route.ts   <── ESTE ARQUIVO
 *
 * ATENÇÃO: Existem vários arquivos route.ts no projeto: este é o da pasta "leads".
 *
 * PASSO A PASSO:
 *   1. No painel EXPLORER (Ctrl+Shift+E), abra a pasta "app/api/leads" e dê dois cliques em route.ts.
 *   2. Clique dentro do arquivo, aperte Ctrl+A e depois Delete (apaga o conteúdo antigo).
 *   3. Cole TODO o conteúdo deste arquivo (inclusive este comentário) > Ctrl+S.
 *
 * PARA NÃO QUEBRAR O PROJETO:
 *   - Instale os 17 arquivos JUNTOS (eles dependem um do outro):
 *    1. supabase/billing.sql  (NOVO)
 *    2. .env.local.example
 *    3. lib/types.ts
 *    4. lib/subscription.ts  (NOVO)
 *    5. lib/mercadopago.ts  (NOVO)
 *    6. lib/supabase/admin.ts  (NOVO)
 *    7. app/api/checkout/route.ts  (NOVO)
 *    8. app/api/webhooks/mercadopago/route.ts  (NOVO)
 *    9. app/api/leads/route.ts
 *   10. app/api/ai/chat/route.ts
 *   11. app/api/ai/proposal/route.ts
 *   12. app/dashboard/page.tsx
 *   13. app/dashboard/assinatura/page.tsx  (NOVO)
 *   14. app/[slug]/page.tsx
 *   15. components/billing/PricingPlans.tsx  (NOVO)
 *   16. components/billing/SubscriptionExpired.tsx  (NOVO)
 *   17. components/dashboard/DashboardShell.tsx
 *   - Não use arquivos com nome trocado pelo navegador, como "route (1).ts":
 *     copie o conteúdo e cole no arquivo com o nome certo.
 *   - No fim, pare o servidor (Ctrl+C no terminal) e rode: npm run dev
 * ========================================================================== */

import { NextResponse } from "next/server";
import { fetchPublicProfile } from "@/lib/profiles";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { calculateSimulation, paramsFromProfile } from "@/lib/solar";
import { createPublicClient } from "@/lib/supabase/public";
import { cleanText, parseSimulationPayload } from "@/lib/validation";
import { onlyDigits } from "@/lib/format";
import { isProfileActive } from "@/lib/subscription";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`leads:${ip}`, 10, 10 * 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Muitas simulações em sequência. Tente novamente em alguns minutos." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  // Honeypot anti-bot: campo invisível que humanos não preenchem
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const slug = cleanText(body.slug, 60);
  const name = cleanText(body.name, 120);
  const whatsapp = onlyDigits(typeof body.whatsapp === "string" ? body.whatsapp : "");
  const simulation = parseSimulationPayload(body);

  if (!slug || name.length < 2 || whatsapp.length < 10 || whatsapp.length > 13 || !simulation) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  const profile = await fetchPublicProfile(slug);
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Empresa não encontrada." }, { status: 404 });
  }

  // Conta com teste/assinatura vencida: simulador indisponível
  if (!isProfileActive(profile)) {
    return NextResponse.json({ ok: false, error: "Simulador indisponível." }, { status: 403 });
  }

  // Recalcula no servidor: o CRM guarda números confiáveis, não os do navegador
  const result = calculateSimulation(simulation, paramsFromProfile(profile));

  const supabase = createPublicClient();
  const { error } = await supabase.from("leads").insert({
    profile_id: profile.id,
    name,
    whatsapp,
    bill_value: simulation.billValue,
    city: simulation.city,
    state: simulation.state,
    property_type: simulation.propertyType,
    roof_type: simulation.roofType,
    system_kwp: Math.round(result.systemKwp * 100) / 100,
    panels_count: result.panelsCount,
    monthly_savings: Math.round(result.monthlySavings * 100) / 100,
    estimated_price: Math.round(result.estimatedPrice * 100) / 100,
    installments: result.installments,
    installment_value: Math.round(result.installmentValue * 100) / 100,
  });

  if (error) {
    console.error("[api/leads] erro ao salvar lead:", error.message);
    return NextResponse.json({ ok: false, error: "Não foi possível salvar agora." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}