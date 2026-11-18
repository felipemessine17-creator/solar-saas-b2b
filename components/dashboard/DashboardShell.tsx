"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Copy, ExternalLink, LogOut, Sun, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { readableTextColor, safeColor } from "@/lib/format";
import type { Lead, Profile } from "@/lib/types";
import CompanySettings from "./CompanySettings";
import LeadsCRM from "./LeadsCRM";

type Tab = "empresa" | "crm";

interface Props {
  initialProfile: Profile;
  initialLeads: Lead[];
  userEmail: string;
}

export default function DashboardShell({ initialProfile, initialLeads, userEmail }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [tab, setTab] = useState<Tab>(initialLeads.length > 0 ? "crm" : "empresa");
  const [leadCount, setLeadCount] = useState(initialLeads.length);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="min-h-screen bg-slate-50">
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
