/* ==========================================================================
 * ARQUIVO 12 de 17: app/dashboard/page.tsx   [ARQUIVO ALTERADO (substituir)]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── app/
 *         └── dashboard/
 *              └── page.tsx   <── ESTE ARQUIVO
 *
 * ATENÇÃO: Existem vários page.tsx: este é o que fica DIRETO dentro de app/dashboard.
 *
 * PASSO A PASSO:
 *   1. No painel EXPLORER (Ctrl+Shift+E), abra a pasta "app/dashboard" e dê dois cliques em page.tsx.
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

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/dashboard/DashboardShell";
import SubscriptionExpired from "@/components/billing/SubscriptionExpired";
import { getSupportWhatsapp } from "@/lib/mercadopago";
import { getAccessState } from "@/lib/subscription";
import type { Lead, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Painel — SolarSim" };

type PageProps = { searchParams: Promise<{ pagamento?: string | string[] }> };

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const rawPayment = Array.isArray(params.pagamento) ? params.pagamento[0] : params.pagamento;
  const paymentStatus = rawPayment && ["sucesso", "pendente", "falhou"].includes(rawPayment) ? rawPayment : null;

  const [profileRes, leadsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("leads")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  if (!profileRes.data) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-bold">Perfil não encontrado</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sua conta existe, mas o perfil da empresa ainda não foi criado. Rode o script{" "}
            <code className="rounded bg-slate-100 px-1">supabase/schema.sql</code> no SQL Editor do
            Supabase (ele cria perfis para contas já existentes) e recarregue esta página.
          </p>
          {profileRes.error && (
            <p className="mt-3 text-xs text-red-600">Detalhe: {profileRes.error.message}</p>
          )}
        </div>
      </main>
    );
  }

  const profile = profileRes.data as Profile;
  const leads = (leadsRes.data ?? []) as Lead[];
  const access = getAccessState(profile);

  // Teste/assinatura vencidos: bloqueia CRM e configurações e mostra os planos
  if (access.kind === "expired") {
    return (
      <SubscriptionExpired
        userId={user.id}
        userEmail={user.email ?? ""}
        companyName={profile.company_name}
        reason={access.reason}
        leadCount={leads.length}
        paymentStatus={paymentStatus}
        supportWhatsapp={getSupportWhatsapp()}
      />
    );
  }

  return (
    <DashboardShell
      initialProfile={profile}
      initialLeads={leads}
      userEmail={user.email ?? ""}
      access={access}
      paymentStatus={paymentStatus}
    />
  );
}