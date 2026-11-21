"use client";

/* ==========================================================================
 * ARQUIVO 15 de 17: components/billing/PricingPlans.tsx   [ARQUIVO NOVO]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── components/
 *         └── billing/   (pasta NOVA: crie)
 *              └── PricingPlans.tsx   <── ESTE ARQUIVO (NOVO)
 *
 * PASSO A PASSO:
 *   1. Crie a pasta (se ainda não criou no arquivo anterior): botão direito na pasta "components" > New Folder > digite billing > Enter.
 *   2. Confira: a pasta nova "billing" deve aparecer DENTRO de "components".
 *   3. Clique com o botão direito na pasta "components/billing" > New File > digite PricingPlans.tsx
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

import { useState } from "react";
import { Check, LoaderCircle, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { ANNUAL_SAVINGS, PLAN_FEATURES, PLANS, type PlanType } from "@/lib/subscription";

interface Props {
  userId: string;
  userEmail?: string;
  supportWhatsapp?: string;
}

type Notice = { message: string; whatsappUrl: string | null } | null;

export default function PricingPlans({ userId, userEmail, supportWhatsapp }: Props) {
  const [loadingPlan, setLoadingPlan] = useState<PlanType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function subscribe(plan: PlanType) {
    setLoadingPlan(plan);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        fallback?: boolean;
        message?: string;
        whatsappUrl?: string | null;
        error?: string;
      };

      if (data.url) {
        window.location.href = data.url; // abre o Checkout Pro do Mercado Pago
        return;
      }

      if (data.fallback) {
        const fallbackUrl =
          data.whatsappUrl ||
          (supportWhatsapp
            ? `https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(
                `Olá! Quero assinar o SolarSim — ${PLANS[plan].name}. Meu e-mail: ${userEmail ?? ""}`
              )}`
            : null);
        setNotice({ message: data.message ?? "Fale com a gente para ativar sua assinatura.", whatsappUrl: fallbackUrl });
        setLoadingPlan(null);
        return;
      }

      throw new Error(data.error || "Não foi possível abrir o pagamento.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setLoadingPlan(null);
    }
  }

  const plans: { plan: (typeof PLANS)[PlanType]; highlight: boolean }[] = [
    { plan: PLANS.mensal, highlight: false },
    { plan: PLANS.anual, highlight: true },
  ];

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-2">
        {plans.map(({ plan, highlight }) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-3xl bg-white p-6 shadow-sm sm:p-7 ${
              highlight ? "ring-2 ring-amber-400 shadow-amber-100" : "ring-1 ring-slate-200"
            }`}
          >
            {highlight && (
              <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900">
                <Sparkles className="h-3.5 w-3.5" /> Mais vantajoso · 2 meses grátis
              </span>
            )}

            <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{plan.description}</p>

            <div className="mt-5 flex items-end gap-1">
              <span className="text-4xl font-extrabold tracking-tight text-slate-900">{formatBRL(plan.price)}</span>
              <span className="pb-1 text-sm font-medium text-slate-500">{plan.periodLabel}</span>
            </div>

            {plan.id === "anual" ? (
              <p className="mt-1 text-sm">
                <span className="font-semibold text-slate-800">Equivale a {formatBRL(plan.monthlyEquivalent)}/mês</span>
                <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  Economize {formatBRL(ANNUAL_SAVINGS)}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Cobrança a cada 30 dias</p>
            )}

            <ul className="mt-6 flex-1 space-y-2.5 text-sm text-slate-700">
              {PLAN_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {feature}
                </li>
              ))}
              {plan.id === "anual" && (
                <li className="flex items-start gap-2 font-medium text-slate-900">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  Parcele em até 12x no cartão
                </li>
              )}
            </ul>

            <button
              type="button"
              onClick={() => subscribe(plan.id)}
              disabled={loadingPlan !== null}
              className={`mt-7 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold transition disabled:opacity-60 ${
                highlight
                  ? "bg-amber-400 text-slate-900 hover:bg-amber-300"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {loadingPlan === plan.id && <LoaderCircle className="h-5 w-5 animate-spin" />}
              {loadingPlan === plan.id ? "Abrindo pagamento..." : `Assinar ${plan.id === "anual" ? "plano anual" : "plano mensal"}`}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
      )}

      {notice && (
        <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <p>{notice.message}</p>
          {notice.whatsappUrl ? (
            <a
              href={notice.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white hover:bg-emerald-600"
            >
              <MessageCircle className="h-4 w-4" /> Ativar pelo WhatsApp
            </a>
          ) : (
            <p className="mt-2 text-xs text-amber-800">Entre em contato com o suporte do SolarSim para ativar sua conta.</p>
          )}
        </div>
      )}

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-500">
        <ShieldCheck className="h-4 w-4" /> Pagamento seguro pelo Mercado Pago · Pix, cartão ou boleto · Sem fidelidade
      </p>
    </div>
  );
}