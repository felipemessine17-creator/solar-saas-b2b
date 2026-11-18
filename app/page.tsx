import Link from "next/link";
import { Bot, FileDown, Link2, Sun, Users } from "lucide-react";

const FEATURES = [
  {
    icon: Link2,
    title: "Seu link de simulação",
    text: "Seu cliente calcula economia, placas e parcela pelo celular, com a sua marca.",
  },
  {
    icon: Users,
    title: "CRM de leads",
    text: "Cada simulação vira um lead classificado como quente, morno ou frio.",
  },
  {
    icon: Bot,
    title: "Assistente com IA",
    text: "Responde dúvidas 24h usando as regras e condições da sua empresa.",
  },
  {
    icon: FileDown,
    title: "Proposta em PDF",
    text: "Texto comercial personalizado para cada cliente, pronto para enviar.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400 text-slate-900">
            <Sun className="h-5 w-5" />
          </span>
          SolarSim
        </div>
        <Link
          href="/login"
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10"
        >
          Entrar
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12 text-center md:pt-20">
        <p className="mx-auto mb-4 inline-flex rounded-full bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-400/30">
          Para integradores e vendedores de energia solar
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          Transforme cada simulação em uma venda de energia solar
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
          Um link com a sua marca que calcula o sistema ideal, captura o contato do cliente e
          organiza tudo em um CRM simples, com IA e proposta em PDF.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login?modo=cadastro"
            className="w-full rounded-xl bg-amber-400 px-6 py-3 font-semibold text-slate-900 shadow-lg shadow-amber-500/20 hover:bg-amber-300 sm:w-auto"
          >
            Criar conta grátis
          </Link>
          <Link
            href="/login"
            className="w-full rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/10 sm:w-auto"
          >
            Já tenho conta
          </Link>
        </div>

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <Icon className="mb-3 h-6 w-6 text-amber-300" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-slate-300">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
