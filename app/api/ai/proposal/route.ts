/* ==========================================================================
 * ARQUIVO 11 de 17: app/api/ai/proposal/route.ts   [ARQUIVO ALTERADO (substituir)]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── app/
 *         └── api/
 *              └── ai/
 *                   └── proposal/
 *                        └── route.ts   <── ESTE ARQUIVO
 *
 * ATENÇÃO: Existem vários arquivos route.ts no projeto: este é o da pasta "ai/proposal".
 *
 * PASSO A PASSO:
 *   1. No painel EXPLORER (Ctrl+Shift+E), abra a pasta "app/api/ai/proposal" e dê dois cliques em route.ts.
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
import { askClaude } from "@/lib/ai";
import {
  buildProposalPrompt,
  fallbackProposalText,
  sanitizeProposalText,
  type SimulationContext,
} from "@/lib/ai-content";
import { fetchPublicProfile } from "@/lib/profiles";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { calculateSimulation, paramsFromProfile } from "@/lib/solar";
import { isProfileActive } from "@/lib/subscription";
import { cleanText, parseSimulationPayload } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = cleanText(body?.slug, 60);
  const clientName = cleanText(body?.clientName, 120);
  const simulation = parseSimulationPayload(body);

  if (!slug || !simulation) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const profile = await fetchPublicProfile(slug);
  if (!profile) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  // Conta com teste/assinatura vencida: não gera proposta
  if (!isProfileActive(profile)) {
    return NextResponse.json({ error: "Simulador indisponível." }, { status: 403 });
  }

  const context: SimulationContext = {
    ...simulation,
    clientName,
    result: calculateSimulation(simulation, paramsFromProfile(profile)),
  };

  const ip = getClientIp(request);
  const allowedAI = rateLimit(`proposal:${ip}`, 8, 10 * 60_000);

  if (allowedAI) {
    const { system, user } = buildProposalPrompt(profile, context);
    const aiText = await askClaude({
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 450,
      temperature: 0.7,
    });

    // Só vai para o PDF o texto comercial limpo. Se vier instrução, rótulos
    // ou trechos internos, usamos o template profissional.
    const safeText = aiText ? sanitizeProposalText(aiText, profile) : null;
    if (aiText && !safeText) {
      console.warn("[api/ai/proposal] texto da IA descartado (formato inválido ou conteúdo interno)");
    }

    if (safeText) {
      return NextResponse.json({ text: safeText, source: "ai" });
    }
  }

  return NextResponse.json({ text: fallbackProposalText(profile, context), source: "template" });
}