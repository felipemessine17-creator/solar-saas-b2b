/* ==========================================================================
 * ARQUIVO 3 de 17: lib/types.ts   [ARQUIVO ALTERADO (substituir)]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── lib/
 *         └── types.ts   <── ESTE ARQUIVO
 *
 * PASSO A PASSO:
 *   1. No painel EXPLORER (Ctrl+Shift+E), abra a pasta "lib" e dê dois cliques em types.ts.
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

export type LeadStatus = "novo" | "em_contato" | "visita_agendada" | "fechado" | "perdido";
export type LeadTemperature = "quente" | "morno" | "frio";

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "em_contato", label: "Em Contato" },
  { value: "visita_agendada", label: "Visita Agendada" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
];

export interface Profile {
  id: string;
  slug: string;
  company_name: string;
  consultant_name: string;
  whatsapp: string;
  primary_color: string;
  logo_url: string | null;
  panel_power_w: number;
  generation_kwh_per_kwp: number;
  price_per_kwp: number;
  tariff_kwh: number;
  monthly_interest_rate: number;
  max_installments: number;
  faq_rules: string;
  // Assinatura (ver supabase/billing.sql)
  subscription_status: "trial" | "active" | "expired" | "canceled";
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
  plan_type: "mensal" | "anual" | null;
  created_at: string;
  updated_at: string;
}

/** Campos do perfil que podem ir para a página pública. */
export type PublicProfile = Pick<
  Profile,
  | "id"
  | "slug"
  | "company_name"
  | "consultant_name"
  | "whatsapp"
  | "primary_color"
  | "logo_url"
  | "panel_power_w"
  | "generation_kwh_per_kwp"
  | "price_per_kwp"
  | "tariff_kwh"
  | "monthly_interest_rate"
  | "max_installments"
  | "faq_rules"
  | "subscription_status"
  | "trial_ends_at"
  | "subscription_ends_at"
>;

export const PUBLIC_PROFILE_FIELDS =
  "id, slug, company_name, consultant_name, whatsapp, primary_color, logo_url, panel_power_w, generation_kwh_per_kwp, price_per_kwp, tariff_kwh, monthly_interest_rate, max_installments, faq_rules, subscription_status, trial_ends_at, subscription_ends_at";

export interface LeadNote {
  text: string;
  created_at: string;
}

export interface Lead {
  id: string;
  profile_id: string;
  name: string;
  whatsapp: string;
  bill_value: number;
  city: string;
  state: string;
  property_type: string;
  roof_type: string;
  system_kwp: number | null;
  panels_count: number | null;
  monthly_savings: number | null;
  estimated_price: number | null;
  installments: number | null;
  installment_value: number | null;
  temperature: LeadTemperature;
  status: LeadStatus;
  notes: LeadNote[];
  created_at: string;
  updated_at: string;
}