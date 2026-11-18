import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/dashboard/DashboardShell";
import type { Lead, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Painel — SolarSim" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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

  return (
    <DashboardShell
      initialProfile={profileRes.data as Profile}
      initialLeads={(leadsRes.data ?? []) as Lead[]}
      userEmail={user.email ?? ""}
    />
  );
}
