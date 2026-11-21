/* ==========================================================================
 * ARQUIVO 5 de 17: lib/mercadopago.ts   [ARQUIVO NOVO]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── lib/
 *         └── mercadopago.ts   <── ESTE ARQUIVO (NOVO)
 *
 * PASSO A PASSO:
 *   1. Clique com o botão direito na pasta "lib" > New File > digite mercadopago.ts
 *   2. Cole TODO o conteúdo deste arquivo (inclusive este comentário) > Ctrl+S.
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

import { createHmac, timingSafeEqual } from "crypto";
import { PLANS, type PlanType } from "./subscription";

/**
 * Integração com o Mercado Pago (Checkout Pro) via API REST.
 * Não precisa instalar o SDK: usamos fetch direto.
 * Docs: https://www.mercadopago.com.br/developers/pt/docs/checkout-pro
 */
const MP_API = "https://api.mercadopago.com";

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN);
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/** Formato do external_reference: "<userId>:<plano>" */
export function buildExternalReference(userId: string, plan: PlanType): string {
  return `${userId}:${plan}`;
}

export function parseExternalReference(ref: string | null | undefined): { userId: string; plan: PlanType } | null {
  if (!ref) return null;
  const [userId, plan] = ref.split(":");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!userId || !uuid.test(userId)) return null;
  if (plan !== "mensal" && plan !== "anual") return null;
  return { userId, plan };
}

export interface CreatePreferenceInput {
  userId: string;
  email?: string;
  plan: PlanType;
  siteUrl: string;
}

/** Cria a preferência de pagamento e devolve o link do checkout. */
export async function createCheckoutPreference(input: CreatePreferenceInput): Promise<{ id: string; url: string }> {
  const plan = PLANS[input.plan];
  const site = input.siteUrl.replace(/\/+$/, "");
  const isPublicHttps = site.startsWith("https://");

  const body: Record<string, unknown> = {
    items: [
      {
        id: `solarsim-${plan.id}`,
        title: `SolarSim — ${plan.name}`,
        description: plan.description,
        quantity: 1,
        currency_id: "BRL",
        unit_price: plan.price,
      },
    ],
    external_reference: buildExternalReference(input.userId, plan.id),
    metadata: { user_id: input.userId, plan: plan.id },
    back_urls: {
      success: `${site}/dashboard?pagamento=sucesso`,
      pending: `${site}/dashboard?pagamento=pendente`,
      failure: `${site}/dashboard?pagamento=falhou`,
    },
    statement_descriptor: "SOLARSIM",
    payment_methods: { installments: plan.id === "anual" ? 12 : 1 },
  };

  if (input.email) body.payer = { email: input.email };

  // O Mercado Pago só aceita retorno automático e webhook em URL pública (https).
  // Em localhost o pagamento funciona, mas a ativação depende do webhook em produção
  // (ou de um túnel como o ngrok) — veja o comentário no topo de /api/webhooks/mercadopago.
  if (isPublicHttps) {
    body.auto_return = "approved";
    body.notification_url = `${site}/api/webhooks/mercadopago`;
  }

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: { ...authHeaders(), "X-Idempotency-Key": `${input.userId}-${plan.id}-${Date.now()}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; init_point?: string; message?: string };

  if (!res.ok || !data.init_point || !data.id) {
    throw new Error(`Mercado Pago recusou a preferência (${res.status}): ${data.message ?? "sem detalhes"}`);
  }

  return { id: data.id, url: data.init_point };
}

export interface MercadoPagoPayment {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string | null;
  metadata?: { user_id?: string; plan?: string } | null;
  transaction_amount?: number;
  currency_id?: string;
}

/** Busca o pagamento direto na API do Mercado Pago (fonte da verdade). */
export async function getPayment(paymentId: string): Promise<MercadoPagoPayment | null> {
  const res = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Erro ao consultar pagamento ${paymentId}: HTTP ${res.status}`);
  return (await res.json()) as MercadoPagoPayment;
}

/**
 * Valida a assinatura do webhook (header x-signature), se você configurou
 * MERCADOPAGO_WEBHOOK_SECRET. Sem o segredo, retorna true — continua seguro
 * porque o pagamento é sempre conferido na API do Mercado Pago.
 */
export function verifyWebhookSignature(params: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!params.signatureHeader) return false;

  const parts = Object.fromEntries(
    params.signatureHeader.split(",").map((part) => {
      const [k, ...v] = part.trim().split("=");
      return [k, v.join("=")];
    })
  ) as Record<string, string>;

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const dataId = params.dataId && /^[a-z0-9]+$/i.test(params.dataId) ? params.dataId.toLowerCase() : params.dataId;

  let manifest = "";
  if (dataId) manifest += `id:${dataId};`;
  if (params.requestId) manifest += `request-id:${params.requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
  } catch {
    return false;
  }
}

/** URL pública do site (usada nos links de retorno e no webhook). */
export function getSiteUrl(request: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

/** WhatsApp do suporte do SolarSim para ativação manual. */
export function getSupportWhatsapp(): string {
  let digits = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`; // adiciona o código do Brasil
  return digits;
}