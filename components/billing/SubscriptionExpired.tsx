"use client";

/* ==========================================================================
 * ARQUIVO 16 de 17: components/billing/SubscriptionExpired.tsx   [ARQUIVO NOVO]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── components/
 *         └── billing/   (pasta NOVA: crie)
 *              └── SubscriptionExpired.tsx   <── ESTE ARQUIVO (NOVO)
 *
 * PASSO A PASSO:
 *   1. Crie a pasta (se ainda não criou no arquivo anterior): botão direito na pasta "components" > New Folder > digite billing > Enter.
 *   2. Confira: a pasta nova "billing" deve aparecer DENTRO de "components".
 *   3. Clique com o botão direito na pasta "components/billing" > New File > digite SubscriptionExpired.tsx
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

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Clock, Database, LogOut, RefreshCw, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PricingPlans from "./PricingPlans";

interface Props {
  userId: string;
  userEmail: string;
  companyName: string;
  reason: "trial" | "subscription";
  leadCount: number;
  paymentStatus: string | null;
  supportWhatsapp: string;
}

/** Tela exibida no /dashboard quando o teste ou a assinatura venceu. */
export default function SubscriptionExpired({
  userId,
  userEmail,
  companyName,
  reason,
  leadCount,
  paymentStatus,
  supportWhatsapp,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const title = reason === "trial" ? "Seu teste grátis de 7 dias encerrou" : "Sua assinatura venceu";
  const subtitle =
    reason === "trial"
      ? "Gostou de ver suas simulações virando leads? Escolha um plano e continue vendendo mais energia solar."
      : "Renove para reativar seu link de simulação, o CRM e o assistente com IA.";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400 text-slate-900">
            <Sun className="h-5 w-5" />
          </span>
          SolarSim
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        {paymentStatus === "sucesso" && (
          <div className="mb-6 flex flex-col gap-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200 sm:flex-row sm:items-center sm:justify-between">
            <p>
              <strong>Pagamento recebido!</strong> A confirmação do Mercado Pago pode levar alguns minutos. Clique em
              atualizar em instantes.
            </p>
            <button
              onClick={() => router.refresh()}
              className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
            >
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
          </div>
        )}
        {paymentStatus === "pendente" && (
          <p className="mb-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
            Seu pagamento está <strong>pendente</strong> (boleto ou Pix em processamento). Assim que for aprovado, sua
            conta é liberada automaticamente.
          </p>
        )}
        {paymentStatus === "falhou" && (
          <p className="mb-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
            O pagamento não foi concluído. Você pode tentar novamente com outra forma de pagamento.
          </p>
        )}

        <section className="mx-auto max-w-2xl text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-600">
            <Clock className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
          <p className="mt-3 text-base text-slate-600">{subtitle}</p>
          <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-600 ring-1 ring-slate-200">
            <Database className="h-4 w-4 text-slate-400" />
            Os dados da <strong className="text-slate-800">{companyName}</strong> estão salvos
            {leadCount > 0 ? ` — incluindo ${leadCount} lead${leadCount > 1 ? "s" : ""}` : ""}.
          </p>
        </section>

        <div className="mx-auto mt-10 max-w-4xl">
          <PricingPlans userId={userId} userEmail={userEmail} supportWhatsapp={supportWhatsapp} />
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Enquanto a conta estiver inativa, seu link público mostra uma mensagem de indisponibilidade para os visitantes.
        </p>
      </main>
    </div>
  );
}