/* ==========================================================================
 * ARQUIVO 8 de 17: app/api/webhooks/mercadopago/route.ts   [ARQUIVO NOVO]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── app/
 *         └── api/
 *              └── webhooks/   (pasta NOVA: crie)
 *                   └── mercadopago/   (pasta NOVA: crie)
 *                        └── route.ts   <── ESTE ARQUIVO (NOVO)
 *
 * ATENÇÃO: Existem vários arquivos route.ts no projeto: este é o da pasta "webhooks/mercadopago".
 *
 * PASSO A PASSO:
 *   1. Crie a pasta: botão direito na pasta "app/api" > New Folder > digite webhooks/mercadopago > Enter.
 *   2. (Digitando "webhooks/mercadopago" o VS Code já cria as duas pastas de uma vez.)
 *   3. Clique com o botão direito na pasta "app/api/webhooks/mercadopago" > New File > digite route.ts
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
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPayment,
  isMercadoPagoConfigured,
  parseExternalReference,
  verifyWebhookSignature,
} from "@/lib/mercadopago";
import { isPlanType, PLANS, type PlanType } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook do Mercado Pago.
 * Configure em: Mercado Pago > Suas integrações > (sua aplicação) > Webhooks
 *   URL: https://SEU-DOMINIO/api/webhooks/mercadopago   Evento: "Pagamentos"
 * (A rota /api/checkout também envia essa URL automaticamente em cada pagamento,
 *  quando NEXT_PUBLIC_SITE_URL começa com https://)
 *
 * Fluxo: recebe o aviso → busca o pagamento na API do Mercado Pago →
 * se "approved" e o valor bater com o plano → ativa a assinatura no Supabase.
 */

function extractPaymentId(url: URL, body: Record<string, unknown> | null): string | null {
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? (body?.type as string | undefined);
  if (type && type !== "payment") return null;

  const fromQuery = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const data = body?.data as { id?: string | number } | undefined;
  const fromBody = data?.id != null ? String(data.id) : null;

  const id = fromQuery ?? fromBody;
  return id && /^\d+$/.test(id) ? id : null;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const paymentId = extractPaymentId(url, body);

  // Avisos que não são de pagamento: só confirma o recebimento
  if (!paymentId) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const validSignature = verifyWebhookSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId: url.searchParams.get("data.id") ?? paymentId,
  });
  if (!validSignature) {
    console.warn("[webhook/mercadopago] assinatura inválida para pagamento", paymentId);
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  if (!isMercadoPagoConfigured()) {
    console.error("[webhook/mercadopago] MERCADOPAGO_ACCESS_TOKEN não configurado");
    return NextResponse.json({ error: "Pagamento não configurado." }, { status: 500 });
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error("[webhook/mercadopago] SUPABASE_SERVICE_ROLE_KEY não configurada");
    return NextResponse.json({ error: "Servidor não configurado." }, { status: 500 });
  }

  let payment;
  try {
    payment = await getPayment(paymentId);
  } catch (error) {
    console.error("[webhook/mercadopago]", error instanceof Error ? error.message : error);
    // 500 faz o Mercado Pago tentar de novo mais tarde
    return NextResponse.json({ error: "Falha ao consultar pagamento." }, { status: 500 });
  }

  if (!payment) {
    return NextResponse.json({ received: true, ignored: "pagamento não encontrado" });
  }

  if (payment.status !== "approved") {
    // pending / in_process / rejected: nada a fazer agora (virá outro aviso se aprovar)
    return NextResponse.json({ received: true, status: payment.status });
  }

  // Quem pagou e qual plano: external_reference (principal) ou metadata (reserva)
  let reference = parseExternalReference(payment.external_reference);
  if (!reference && payment.metadata?.user_id && isPlanType(payment.metadata.plan)) {
    reference = parseExternalReference(`${payment.metadata.user_id}:${payment.metadata.plan}`);
  }
  if (!reference) {
    console.warn("[webhook/mercadopago] pagamento sem referência do SolarSim:", paymentId);
    return NextResponse.json({ received: true, ignored: "sem referência" });
  }

  // Confere valor e moeda (evita ativar plano anual pagando o valor do mensal)
  const plan: PlanType = reference.plan;
  const expected = PLANS[plan].price;
  if (payment.currency_id !== "BRL" || Number(payment.transaction_amount ?? 0) + 0.01 < expected) {
    console.warn(
      `[webhook/mercadopago] valor divergente no pagamento ${paymentId}: ${payment.transaction_amount} ${payment.currency_id} (esperado ${expected} BRL)`
    );
    return NextResponse.json({ received: true, ignored: "valor divergente" });
  }

  const { data: endsAt, error } = await admin.rpc("activate_subscription", {
    p_user_id: reference.userId,
    p_plan: plan,
    p_payment_id: String(payment.id),
  });

  if (error) {
    console.error("[webhook/mercadopago] erro ao ativar assinatura:", error.message);
    return NextResponse.json({ error: "Falha ao ativar assinatura." }, { status: 500 });
  }

  console.info(`[webhook/mercadopago] assinatura ${plan} ativada para ${reference.userId} até ${endsAt}`);
  return NextResponse.json({ received: true, activated: true, plan, subscription_ends_at: endsAt });
}

/** O Mercado Pago às vezes testa a URL com GET: responde OK. */
export async function GET() {
  return NextResponse.json({ ok: true });
}