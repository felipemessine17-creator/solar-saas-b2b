/* ==========================================================================
 * ARQUIVO 14 de 17: app/[slug]/page.tsx   [ARQUIVO ALTERADO (substituir)]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── app/
 *         └── [slug]/
 *              └── page.tsx   <── ESTE ARQUIVO
 *
 * ATENÇÃO: Existem vários page.tsx: este é o da pasta [slug] (com colchetes no nome).
 *
 * PASSO A PASSO:
 *   1. No painel EXPLORER (Ctrl+Shift+E), abra a pasta "app/[slug]" e dê dois cliques em page.tsx.
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

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CircleOff } from "lucide-react";
import Simulator from "@/components/public/Simulator";
import { getPublicProfile } from "@/lib/profiles";
import { isProfileActive } from "@/lib/subscription";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) return { title: "Simulador não encontrado" };
  if (!isProfileActive(profile)) return { title: "Simulador indisponível", robots: { index: false } };

  const title = `Simule sua economia com energia solar | ${profile.company_name}`;
  const description = `Descubra em 1 minuto quanto você pode economizar na conta de luz com a ${profile.company_name}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.logo_url ? [{ url: profile.logo_url }] : undefined,
    },
  };
}

export default async function PublicSimulatorPage({ params }: PageProps) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();

  // Teste grátis ou assinatura vencidos: tela neutra, sem simulador
  if (!isProfileActive(profile)) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <CircleOff className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-xl font-bold text-slate-900">Simulador temporariamente indisponível</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Este simulador está temporariamente indisponível. Entre em contato diretamente com a empresa.
          </p>
          <p className="mt-6 text-xs text-slate-400">{profile.company_name}</p>
        </div>
      </main>
    );
  }

  // As regras/FAQ são material interno da IA: ficam só no servidor
  // (rotas /api/ai/*) e nunca são enviadas ao navegador do cliente.
  return <Simulator profile={{ ...profile, faq_rules: "" }} />;
}