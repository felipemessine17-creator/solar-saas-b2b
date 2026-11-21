/* ==========================================================================
 * ARQUIVO 7 de 17: app/api/checkout/route.ts   [ARQUIVO NOVO]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── app/
 *         └── api/
 *              └── checkout/   (pasta NOVA: crie)
 *                   └── route.ts   <── ESTE ARQUIVO (NOVO)
 *
 * ATENÇÃO: Existem vários arquivos route.ts no projeto: este é o da pasta "checkout".
 *
 * PASSO A PASSO:
 *   1. Crie a pasta: botão direito na pasta "app/api" > New Folder > digite checkout > Enter.
 *   2. Confira: a pasta nova "checkout" deve aparecer DENTRO de "app/api".
 *   3. Clique com o botão direito na pasta "app/api/checkout" > New File > digite route.ts
 *   4. Cole TODO o conteúdo deste arquivo (inclusive este comentário) > Ctrl+S.
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
import { createClient } from "@/lib/supabase/server";
import {
  createCheckoutPreference,
  getSiteUrl,
  getSupportWhatsapp,
  isMercadoPagoConfigured,
} from "@/lib/mercadopago";
import { isPlanType, PLANS } from "@/lib/subscription";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * POST /api/checkout  { plan: "mensal" | "anual", userId?: string }
 * O usuário é sempre identificado pela SESSÃO (cookie), nunca só pelo body:
 * assim ninguém consegue gerar pagamento para a conta de outra pessoa.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`checkout:${ip}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Faça login para assinar." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { plan?: unknown; userId?: unknown } | null;
  const plan = body?.plan;

  if (!isPlanType(plan)) {
    return NextResponse.json({ error: "Plano inválido." }, { status: 400 });
  }

  if (typeof body?.userId === "string" && body.userId !== user.id) {
    return NextResponse.json({ error: "Usuário inválido." }, { status: 403 });
  }

  // Fallback: Mercado Pago ainda não configurado → ativação manual pelo WhatsApp
  if (!isMercadoPagoConfigured()) {
    const support = getSupportWhatsapp();
    const text = `Olá! Quero assinar o SolarSim — ${PLANS[plan].name} (${PLANS[plan].price.toFixed(2).replace(".", ",")}). Meu e-mail de cadastro: ${user.email ?? ""}`;
    return NextResponse.json({
      fallback: true,
      message:
        "O pagamento online está sendo configurado. Fale com a gente pelo WhatsApp que ativamos sua assinatura na hora.",
      whatsappUrl: support ? `https://wa.me/${support}?text=${encodeURIComponent(text)}` : null,
    });
  }

  try {
    const preference = await createCheckoutPreference({
      userId: user.id,
      email: user.email ?? undefined,
      plan,
      siteUrl: getSiteUrl(request),
    });
    return NextResponse.json({ url: preference.url });
  } catch (error) {
    console.error("[api/checkout]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Não foi possível abrir o pagamento agora. Tente novamente em instantes." },
      { status: 502 }
    );
  }
}