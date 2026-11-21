/* ==========================================================================
 * ARQUIVO 4 de 17: lib/subscription.ts   [ARQUIVO NOVO]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── lib/
 *         └── subscription.ts   <── ESTE ARQUIVO (NOVO)
 *
 * PASSO A PASSO:
 *   1. Clique com o botão direito na pasta "lib" > New File > digite subscription.ts
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

// Regras de assinatura do SolarSim (usado no servidor e no navegador).

export type SubscriptionStatus = "trial" | "active" | "expired" | "canceled";
export type PlanType = "mensal" | "anual";

export interface Plan {
  id: PlanType;
  name: string;
  price: number;
  periodLabel: string;
  periodDays: number;
  monthlyEquivalent: number;
  description: string;
}

export const PLANS: Record<PlanType, Plan> = {
  mensal: {
    id: "mensal",
    name: "Plano Mensal",
    price: 97.99,
    periodLabel: "/mês",
    periodDays: 30,
    monthlyEquivalent: 97.99,
    description: "Flexibilidade total, renove mês a mês.",
  },
  anual: {
    id: "anual",
    name: "Plano Anual",
    price: 959.88,
    periodLabel: "/ano",
    periodDays: 365,
    monthlyEquivalent: 79.99,
    description: "O melhor custo-benefício: equivale a 2 meses grátis.",
  },
};

/** Quanto o plano anual economiza em relação a 12 meses do mensal. */
export const ANNUAL_SAVINGS = Math.round((PLANS.mensal.price * 12 - PLANS.anual.price) * 100) / 100;

export const PLAN_FEATURES = [
  "Link de simulação com a sua marca",
  "Leads ilimitados no CRM (quente, morno e frio)",
  "Assistente de vendas com IA 24h",
  "Proposta comercial em PDF personalizada",
  "Botão de WhatsApp com resumo da simulação",
  "Suporte por WhatsApp",
];

export function isPlanType(value: unknown): value is PlanType {
  return value === "mensal" || value === "anual";
}

export interface SubscriptionFields {
  subscription_status: string | null;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
}

/**
 * true se a conta pode usar o sistema:
 * - assinatura ativa e ainda não vencida, OU
 * - em teste grátis e dentro do prazo.
 */
export function isProfileActive(profile: SubscriptionFields | null | undefined, now: Date = new Date()): boolean {
  if (!profile) return false;

  if (profile.subscription_status === "active") {
    if (!profile.subscription_ends_at) return true;
    return now < new Date(profile.subscription_ends_at);
  }

  if (profile.subscription_status === "trial") {
    if (!profile.trial_ends_at) return false;
    return now < new Date(profile.trial_ends_at);
  }

  return false;
}

/** Dias restantes (arredonda para cima). 0 se já venceu ou não houver data. */
export function daysLeft(isoDate: string | null | undefined, now: Date = new Date()): number {
  if (!isoDate) return 0;
  const diff = new Date(isoDate).getTime() - now.getTime();
  return diff > 0 ? Math.ceil(diff / (24 * 60 * 60 * 1000)) : 0;
}

export type AccessState =
  | { kind: "trial"; daysLeft: number }
  | { kind: "active"; daysLeft: number | null; plan: string | null }
  | { kind: "expired"; reason: "trial" | "subscription" };

/** Resumo do estado da conta, para montar banners e telas. */
export function getAccessState(
  profile: SubscriptionFields & { plan_type?: string | null },
  now: Date = new Date()
): AccessState {
  if (isProfileActive(profile, now)) {
    if (profile.subscription_status === "trial") {
      return { kind: "trial", daysLeft: daysLeft(profile.trial_ends_at, now) };
    }
    return {
      kind: "active",
      daysLeft: profile.subscription_ends_at ? daysLeft(profile.subscription_ends_at, now) : null,
      plan: profile.plan_type ?? null,
    };
  }
  return {
    kind: "expired",
    reason: profile.subscription_status === "trial" ? "trial" : "subscription",
  };
}