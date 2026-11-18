"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LoaderCircle, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "entrar" | "cadastro";

function translateError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar (veja sua caixa de entrada).";
  if (m.includes("user already registered")) return "Este e-mail já está cadastrado. Faça login.";
  if (m.includes("password should be at least")) return "A senha deve ter pelo menos 6 caracteres.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
  if (m.includes("unable to validate email")) return "E-mail inválido.";
  return message;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [consultantName, setConsultantName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("modo") === "cadastro") setMode("cadastro");
    if (params.get("erro") === "confirmacao") {
      setError("O link de confirmação é inválido ou expirou. Tente entrar ou cadastre-se novamente.");
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "entrar") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      if (companyName.trim().length < 2) {
        throw new Error("Informe o nome da empresa.");
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            company_name: companyName.trim(),
            consultant_name: consultantName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) throw signUpError;

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setInfo("Conta criada! Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, é só entrar.");
      setMode("entrar");
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : "Erro inesperado."));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100";

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-slate-950 to-slate-800 p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400 text-slate-900">
            <Sun className="h-5 w-5" />
          </span>
          SolarSim
        </Link>
        <div>
          <h2 className="text-4xl font-bold leading-tight">
            Seu simulador solar com a sua marca, captando leads 24h.
          </h2>
          <p className="mt-4 max-w-md text-slate-300">
            Configure seus preços uma vez, compartilhe seu link e acompanhe cada cliente no CRM.
          </p>
        </div>
        <p className="text-sm text-slate-400">© {new Date().getFullYear()} SolarSim</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 font-semibold lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400 text-slate-900">
              <Sun className="h-5 w-5" />
            </span>
            SolarSim
          </Link>

          <h1 className="text-2xl font-bold text-slate-900">
            {mode === "entrar" ? "Entrar no painel" : "Criar sua conta"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {mode === "entrar"
              ? "Acesse seu CRM e as configurações da sua empresa."
              : "Leva menos de 1 minuto. Seu link público é criado automaticamente."}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
            {(["entrar", "cadastro"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setInfo(null);
                }}
                className={`rounded-lg py-2 transition ${
                  mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "cadastro" && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Nome da empresa</label>
                  <input
                    className={inputClass}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex.: João Solar"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Seu nome (consultor)</label>
                  <input
                    className={inputClass}
                    value={consultantName}
                    onChange={(e) => setConsultantName(e.target.value)}
                    placeholder="Ex.: João Pereira"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
              <input
                className={inputClass}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com.br"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
              <div className="relative">
                <input
                  className={`${inputClass} pr-12`}
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "entrar" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
            )}
            {info && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {loading && <LoaderCircle className="h-5 w-5 animate-spin" />}
              {mode === "entrar" ? "Entrar" : "Criar conta e acessar"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
