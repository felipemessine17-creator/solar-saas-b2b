/* ==========================================================================
 * ARQUIVO 13 de 17: app/dashboard/assinatura/page.tsx   [ARQUIVO NOVO]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── app/
 *         └── dashboard/
 *              └── assinatura/   (pasta NOVA: crie)
 *                   └── page.tsx   <── ESTE ARQUIVO (NOVO)
 *
 * ATENÇÃO: Existem vários page.tsx: este fica dentro da pasta NOVA app/dashboard/assinatura.
 *
 * PASSO A PASSO:
 *   1. Crie a pasta: botão direito na pasta "app/dashboard" > New Folder > digite assinatura > Enter.
 *   2. Confira: a pasta nova "assinatura" deve aparecer DENTRO de "app/dashboard".
 *   3. Clique com o botão direito na pasta "app/dashboard/assinatura" > New File > digite page.tsx
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BadgeCheck, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PricingPlans from "@/components/billing/PricingPlans";
import { formatDate } from "@/lib/format";
import { getSupportWhatsapp } from "@/lib/mercadopago";
import { getAccessState, PLANS } from "@/lib/subscription";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Planos e assinatura — SolarSim" };

export default async function AssinaturaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!data) redirect("/dashboard");

  const profile = data as Profile;
  const access = getAccessState(profile);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <main className="mx-auto max-w-5xl px-5 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel
        </Link>

        <section className="mx-auto mt-6 max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {access.kind === "active" ? "Sua assinatura" : "Escolha seu plano"}
          </h1>
          <p className="mt-3 text-slate-600">
            Mantenha seu link de simulação no ar, capture leads todos os dias e feche mais vendas de energia solar.
          </p>

          {access.kind === "trial" && (
            <p className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
              <Clock className="h-4 w-4" />
              Teste grátis: {access.daysLeft === 1 ? "resta 1 dia" : `restam ${access.daysLeft} dias`}. Assine agora e
              não perca nenhum lead.
            </p>
          )}

          {access.kind === "active" && (
            <p className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
              <BadgeCheck className="h-4 w-4" />
              {profile.plan_type ? PLANS[profile.plan_type].name : "Assinatura"} ativa
              {profile.subscription_ends_at ? ` até ${formatDate(new Date(profile.subscription_ends_at))}` : ""}. Se
              pagar de novo, o novo período é somado ao atual.
            </p>
          )}

          {access.kind === "expired" && (
            <p className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm text-red-700 ring-1 ring-red-200">
              <Clock className="h-4 w-4" />
              {access.reason === "trial" ? "Seu teste grátis encerrou." : "Sua assinatura venceu."} Escolha um plano para
              reativar.
            </p>
          )}
        </section>

        <div className="mx-auto mt-10 max-w-4xl">
          <PricingPlans userId={user.id} userEmail={user.email ?? ""} supportWhatsapp={getSupportWhatsapp()} />
        </div>
      </main>
    </div>
  );
}