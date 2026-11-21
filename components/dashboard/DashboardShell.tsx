"use client";

/* ==========================================================================
 * ARQUIVO 17 de 17: components/dashboard/DashboardShell.tsx   [ARQUIVO ALTERADO (substituir)]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── components/
 *         └── dashboard/
 *              └── DashboardShell.tsx   <── ESTE ARQUIVO
 *
 * PASSO A PASSO:
 *   1. No painel EXPLORER (Ctrl+Shift+E), abra a pasta "components/dashboard" e dê dois cliques em DashboardShell.tsx.
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

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck,
  Building2,
  Check,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  LogOut,
  Sun,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, readableTextColor, safeColor } from "@/lib/format";
import { PLANS, type AccessState } from "@/lib/subscription";
import type { Lead, Profile } from "@/lib/types";
import CompanySettings from "./CompanySettings";
import LeadsCRM from "./LeadsCRM";

type Tab = "empresa" | "crm";

interface Props {
  initialProfile: Profile;
  initialLeads: Lead[];
  userEmail: string;
  /** Calculado no servidor (evita diferença de horário entre servidor e navegador) */
  access: Exclude<AccessState, { kind: "expired" }>;
  paymentStatus: string | null;
}

export default function DashboardShell({ initialProfile, initialLeads, userEmail, access, paymentStatus }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [tab, setTab] = useState<Tab>(initialLeads.length > 0 ? "crm" : "empresa");
  const [leadCount, setLeadCount] = useState(initialLeads.length);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPaymentNotice, setShowPaymentNotice] = useState(Boolean(paymentStatus));

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const publicUrl = `${origin}/${profile.slug}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Navegador sem permissão de clipboard: o usuário pode copiar manualmente
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const tabs: { id: Tab; label: string; icon: typeof Users; badge?: number }[] = [
    { id: "crm", label: "CRM & Leads", icon: Users, badge: leadCount },
    { id: "empresa", label: "Minha Empresa & Preços", icon: Building2 },
  ];

  const plural = (n: number) => (n === 1 ? "resta 1 dia" : `restam ${n} dias`);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Barra de teste grátis / vencimento próximo */}
      {access.kind === "trial" && (
        <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 ring-1 ring-amber-200">
          <Clock className="mr-1.5 inline h-4 w-4 -translate-y-px" />
          Você está no período de teste grátis ({plural(access.daysLeft)}).{" "}
          <Link href="/dashboard/assinatura" className="font-semibold underline underline-offset-2 hover:text-amber-700">
            Assinar agora
          </Link>
        </div>
      )}
      {access.kind === "active" && access.daysLeft !== null && access.daysLeft <= 7 && (
        <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 ring-1 ring-amber-200">
          <Clock className="mr-1.5 inline h-4 w-4 -translate-y-px" />
          Sua assinatura vence em breve ({plural(access.daysLeft)}).{" "}
          <Link href="/dashboard/assinatura" className="font-semibold underline underline-offset-2 hover:text-amber-700">
            Renovar agora
          </Link>
        </div>
      )}

      {/* Retorno do Mercado Pago */}
      {showPaymentNotice && paymentStatus && (
        <div
          className={`flex items-center justify-center gap-3 px-4 py-2.5 text-sm ${
            paymentStatus === "sucesso"
              ? "bg-emerald-50 text-emerald-800"
              : paymentStatus === "pendente"
                ? "bg-amber-50 text-amber-900"
                : "bg-red-50 text-red-700"
          }`}
        >
          <span>
            {paymentStatus === "sucesso" &&
              (access.kind === "active"
                ? `Pagamento confirmado! Sua assinatura${access.plan ? ` ${access.plan === "anual" ? "anual" : "mensal"}` : ""} está ativa${
                    profile.subscription_ends_at ? ` até ${formatDate(new Date(profile.subscription_ends_at))}` : ""
                  }.`
                : "Pagamento recebido! A confirmação do Mercado Pago pode levar alguns minutos.")}
            {paymentStatus === "pendente" && "Pagamento pendente. Assim que for aprovado, sua assinatura é ativada automaticamente."}
            {paymentStatus === "falhou" && "O pagamento não foi concluído. Você pode tentar novamente na página de planos."}
          </span>
          <button
            onClick={() => {
              setShowPaymentNotice(false);
              router.replace("/dashboard");
            }}
            className="rounded-full p-1 hover:bg-black/5"
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {profile.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.logo_url}
                alt={profile.company_name}
                className="h-10 w-10 rounded-xl object-contain ring-1 ring-slate-200"
              />
            ) : (
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{
                  backgroundColor: safeColor(profile.primary_color),
                  color: readableTextColor(safeColor(profile.primary_color)),
                }}
              >
                <Sun className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{profile.company_name}</p>
              <p className="truncate text-xs text-slate-500">{userEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 py-1 pl-3 pr-1 text-sm md:flex">
              <span className="max-w-[280px] truncate text-slate-600">{publicUrl}</span>
              <button
                onClick={copyLink}
                className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-slate-700 hover:bg-white"
                title="Copiar link"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <a
              href={`/${profile.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Ver meu link</span>
            </a>
            <button
              onClick={copyLink}
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 md:hidden"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
            <Link
              href="/dashboard/assinatura"
              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              title={access.kind === "active" ? "Minha assinatura" : "Ver planos"}
            >
              {access.kind === "active" ? (
                <BadgeCheck className="h-4 w-4 text-emerald-600" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              <span className="hidden lg:inline">
                {access.kind === "active"
                  ? access.plan && (access.plan === "mensal" || access.plan === "anual")
                    ? PLANS[access.plan].name
                    : "Assinatura"
                  : "Planos"}
              </span>
            </Link>
            <button
              onClick={signOut}
              className="flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
          {tabs.map(({ id, label, icon: Icon, badge }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${
                tab === id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {typeof badge === "number" && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{badge}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* As duas abas ficam montadas para não perder edições/estado ao alternar */}
        <div className={tab === "empresa" ? "block" : "hidden"}>
          <CompanySettings profile={profile} onSaved={setProfile} />
        </div>
        <div className={tab === "crm" ? "block" : "hidden"}>
          <LeadsCRM profile={profile} initialLeads={initialLeads} onCountChange={setLeadCount} />
        </div>
      </main>
    </div>
  );
}