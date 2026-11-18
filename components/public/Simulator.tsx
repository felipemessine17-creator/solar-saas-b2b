"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  CreditCard,
  Factory,
  FileDown,
  House,
  LayoutGrid,
  Leaf,
  LoaderCircle,
  Lock,
  MessageCircle,
  PiggyBank,
  RotateCcw,
  Sun,
  Tractor,
  TreePine,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  calculateSimulation,
  paramsFromProfile,
  PROPERTY_TYPES,
  ROOF_TYPES,
  UFS,
  type PropertyType,
  type RoofType,
} from "@/lib/solar";
import {
  formatBRL,
  formatBRLShort,
  formatNumber,
  formatPhoneBR,
  onlyDigits,
  readableTextColor,
  safeColor,
  whatsappLink,
} from "@/lib/format";
import type { PublicProfile } from "@/lib/types";
import ChatWidget from "./ChatWidget";
import ProposalPrint from "./ProposalPrint";

type Step = 1 | 2 | 3;

const PROPERTY_ICONS: Record<PropertyType, typeof House> = {
  Residencial: House,
  Comercial: Building2,
  Rural: Tractor,
  Industrial: Factory,
};

const SLIDER_MIN = 100;
const SLIDER_MAX = 5000;

export default function Simulator({ profile }: { profile: PublicProfile }) {
  const brand = safeColor(profile.primary_color);
  const brandText = readableTextColor(brand);
  const params = useMemo(() => paramsFromProfile(profile), [profile]);

  const [step, setStep] = useState<Step>(1);
  const [bill, setBill] = useState(450);
  const [billInput, setBillInput] = useState("450");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("Residencial");
  const [roofType, setRoofType] = useState<RoofType>("Cerâmico");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // honeypot anti-bot
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [proposalText, setProposalText] = useState<string | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [printRequested, setPrintRequested] = useState(false);

  const result = useMemo(
    () => calculateSimulation({ billValue: bill, roofType, propertyType }, params),
    [bill, roofType, propertyType, params]
  );

  const simulationPayload = useMemo(
    () => ({ billValue: bill, city: city.trim(), state: uf, propertyType, roofType }),
    [bill, city, uf, propertyType, roofType]
  );

  // Abre a janela de impressão depois que o texto da proposta foi renderizado
  useEffect(() => {
    if (!printRequested || !proposalText) return;
    const timer = setTimeout(() => {
      const previousTitle = document.title;
      document.title = `Proposta ${profile.company_name} - ${name.trim() || "Cliente"}`;
      window.print();
      document.title = previousTitle;
      setPrintRequested(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [printRequested, proposalText, profile.company_name, name]);

  // Se o cliente mudar algum dado, a proposta precisa ser regerada
  useEffect(() => {
    setProposalText(null);
  }, [bill, roofType, propertyType, city, uf, name]);

  function updateBillFromInput(value: string) {
    const digits = value.replace(/[^\d]/g, "").slice(0, 6);
    setBillInput(digits);
    const n = Number(digits);
    if (Number.isFinite(n) && n > 0) setBill(n);
  }

  function updateBillFromSlider(value: number) {
    setBill(value);
    setBillInput(String(value));
  }

  const step1Valid = bill >= 50 && city.trim().length >= 2 && uf !== "";
  const phoneDigits = onlyDigits(phone);
  const step2Valid = name.trim().length >= 2 && phoneDigits.length >= 10 && phoneDigits.length <= 11;

  async function goToResult() {
    if (!step2Valid) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: profile.slug,
          name: name.trim(),
          whatsapp: phoneDigits,
          website,
          ...simulationPayload,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        console.warn("Lead não salvo:", data.error);
      }
    } catch (err) {
      // Nunca bloqueia o cliente de ver o resultado
      console.warn("Falha ao salvar lead", err);
    } finally {
      setSaving(false);
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleDownloadPdf() {
    if (proposalText) {
      setPrintRequested(true);
      return;
    }
    setProposalLoading(true);
    try {
      const res = await fetch("/api/ai/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: profile.slug, clientName: name.trim(), ...simulationPayload }),
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string };
      setProposalText(
        data.text ||
          `${name.trim().split(" ")[0] || "Olá"}, preparamos esta proposta com base na sua conta de luz. O sistema de ${formatNumber(
            result.systemKwp
          )} kWp pode reduzir sua conta em cerca de ${formatBRL(result.monthlySavings)} por mês. Vamos agendar uma visita técnica para validar o projeto?`
      );
      setPrintRequested(true);
    } catch {
      setError("Não foi possível gerar a proposta agora. Tente novamente.");
    } finally {
      setProposalLoading(false);
    }
  }

  const consultant = profile.consultant_name || "equipe";
  const whatsappSummary = [
    `Olá${profile.consultant_name ? `, ${profile.consultant_name}` : ""}! Fiz a simulação de energia solar no site da ${profile.company_name}:`,
    "",
    `👤 Nome: ${name.trim()}`,
    `📍 Cidade: ${city.trim()}/${uf}`,
    `🏠 Imóvel: ${propertyType} | Telhado: ${roofType}`,
    `💡 Conta de luz: ${formatBRL(bill)}/mês`,
    `☀️ Sistema: ${formatNumber(result.systemKwp)} kWp (${result.panelsCount} placas de ${result.panelPowerW} W)`,
    `💰 Economia estimada: ${formatBRL(result.monthlySavings)}/mês | ${formatBRLShort(result.savings25y)} em 25 anos`,
    `💳 Investimento: ${formatBRL(result.estimatedPrice)} à vista ou ${result.installments}x de ${formatBRL(result.installmentValue)}`,
    `🌱 CO2 evitado: ${formatNumber(result.co2Tons25y, 1)} t em 25 anos`,
    "",
    "Gostaria de receber a proposta oficial!",
  ].join("\n");

  const cssVars = { "--brand": brand, "--brand-contrast": brandText } as React.CSSProperties;

  const primaryBtn =
    "flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold shadow-lg transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50";
  const label = "mb-1.5 block text-sm font-medium text-slate-700";
  const input =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-4 focus:ring-slate-100";

  return (
    <div style={cssVars} className="min-h-screen bg-slate-50">
      <div className="print:hidden">
        {/* Topo com a marca */}
        <header
          className="relative overflow-hidden px-5 pb-24 pt-6"
          style={{ background: `linear-gradient(135deg, ${brand} 0%, ${brand}cc 60%, #0f172a 140%)`, color: brandText }}
        >
          <div className="mx-auto flex max-w-xl items-center gap-3">
            {profile.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.logo_url}
                alt={profile.company_name}
                className="h-11 w-11 rounded-xl bg-white object-contain p-1 shadow"
              />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/20">
                <Sun className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{profile.company_name}</p>
              <p className="text-xs opacity-80">Simulador de energia solar</p>
            </div>
          </div>
          <div className="mx-auto mt-6 max-w-xl">
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              {step === 3 ? "Sua simulação está pronta! ☀️" : "Descubra quanto você economiza com energia solar"}
            </h1>
            <p className="mt-1 text-sm opacity-85">
              {step === 3 ? "Valores estimados com base na sua conta de luz." : "Leva menos de 1 minuto. Sem compromisso."}
            </p>
          </div>
        </header>

        <main className="relative z-10 mx-auto -mt-16 max-w-xl px-4 pb-32">
          {/* Progresso */}
          <div className="mb-3 flex items-center gap-2 px-1">
            {[1, 2, 3].map((s) => (
              <div key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/60">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: step >= s ? "100%" : "0%", backgroundColor: step >= s ? brand : "transparent" }}
                />
              </div>
            ))}
          </div>

          {/* PASSO 1 */}
          {step === 1 && (
            <section className="animate-fade-up space-y-6 rounded-3xl bg-white p-5 shadow-xl shadow-slate-200/60 ring-1 ring-slate-100 sm:p-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Passo 1 de 3</p>
                <h2 className="text-lg font-bold text-slate-900">Sobre a sua conta de luz</h2>
              </div>

              <div>
                <label className={label}>Valor médio da conta de luz</label>
                <div className="flex items-center gap-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <span className="text-xl font-semibold text-slate-500">R$</span>
                  <input
                    inputMode="numeric"
                    value={billInput}
                    onChange={(e) => updateBillFromInput(e.target.value)}
                    className="w-full bg-transparent text-3xl font-bold text-slate-900 outline-none"
                    aria-label="Valor da conta de luz"
                  />
                  <span className="text-sm text-slate-400">/mês</span>
                </div>
                <input
                  type="range"
                  min={SLIDER_MIN}
                  max={SLIDER_MAX}
                  step={10}
                  value={Math.min(Math.max(bill, SLIDER_MIN), SLIDER_MAX)}
                  onChange={(e) => updateBillFromSlider(Number(e.target.value))}
                  className="brand-range mt-4 w-full cursor-pointer"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>{formatBRLShort(SLIDER_MIN)}</span>
                  <span>{formatBRLShort(SLIDER_MAX)}+</span>
                </div>
                {bill < 50 && <p className="mt-2 text-xs text-red-600">Informe um valor a partir de R$ 50.</p>}
              </div>

              <div className="grid grid-cols-[1fr_96px] gap-3">
                <div>
                  <label className={label}>Cidade</label>
                  <input
                    className={input}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex.: Campinas"
                    autoComplete="address-level2"
                  />
                </div>
                <div>
                  <label className={label}>UF</label>
                  <select className={input} value={uf} onChange={(e) => setUf(e.target.value)}>
                    <option value="">--</option>
                    {UFS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <span className={label}>Tipo de imóvel</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PROPERTY_TYPES.map((t) => {
                    const Icon = PROPERTY_ICONS[t];
                    const active = propertyType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPropertyType(t)}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-sm font-medium transition ${
                          active ? "border-[var(--brand)] bg-slate-50 text-slate-900" : "border-slate-100 text-slate-500 hover:border-slate-200"
                        }`}
                      >
                        <Icon className="h-5 w-5" style={active ? { color: brand } : undefined} />
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className={label}>Tipo de telhado</span>
                <div className="flex flex-wrap gap-2">
                  {ROOF_TYPES.map((t) => {
                    const active = roofType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRoofType(t)}
                        className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition ${
                          active ? "border-[var(--brand)] bg-slate-50 text-slate-900" : "border-slate-100 text-slate-500 hover:border-slate-200"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                className={primaryBtn}
                style={{ backgroundColor: brand, color: brandText }}
              >
                Continuar <ArrowRight className="h-5 w-5" />
              </button>
              {!step1Valid && (
                <p className="-mt-3 text-center text-xs text-slate-400">Preencha o valor da conta, cidade e UF.</p>
              )}
            </section>
          )}

          {/* PASSO 2 */}
          {step === 2 && (
            <section className="animate-fade-up space-y-5 rounded-3xl bg-white p-5 shadow-xl shadow-slate-200/60 ring-1 ring-slate-100 sm:p-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Passo 2 de 3</p>
                <h2 className="text-lg font-bold text-slate-900">Para onde enviamos o seu resultado?</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Seu sistema estimado é de <strong className="text-slate-800">{formatNumber(result.systemKwp)} kWp</strong>.
                  Informe seus dados para ver a economia completa.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  goToResult();
                }}
                className="space-y-4"
              >
                <div>
                  <label className={label}>Seu nome</label>
                  <input
                    className={input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome e sobrenome"
                    autoComplete="name"
                    required
                  />
                </div>
                <div>
                  <label className={label}>WhatsApp</label>
                  <input
                    className={input}
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneBR(e.target.value))}
                    placeholder="(11) 91234-5678"
                    inputMode="tel"
                    autoComplete="tel-national"
                    required
                  />
                </div>

                {/* Honeypot: invisível para humanos */}
                <input
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  aria-hidden="true"
                  name="website"
                />

                <button
                  type="submit"
                  disabled={!step2Valid || saving}
                  className={primaryBtn}
                  style={{ backgroundColor: brand, color: brandText }}
                >
                  {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                  Ver minha economia
                </button>

                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
                  <Lock className="h-3.5 w-3.5" /> Seus dados são usados apenas para o contato da {profile.company_name}.
                </p>
              </form>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
            </section>
          )}

          {/* PASSO 3 — RESULTADO */}
          {step === 3 && (
            <section className="animate-fade-up space-y-4">
              <div className="rounded-3xl bg-white p-6 text-center shadow-xl shadow-slate-200/60 ring-1 ring-slate-100">
                <p className="text-sm font-medium text-slate-500">
                  {name.trim().split(" ")[0]}, sua economia estimada é de
                </p>
                <p className="mt-1 text-4xl font-extrabold tracking-tight" style={{ color: brand }}>
                  {formatBRL(result.monthlySavings)}
                  <span className="text-lg font-semibold text-slate-400">/mês</span>
                </p>
                <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  <TrendingUp className="h-4 w-4" />
                  {formatBRLShort(result.savings25y)} em 25 anos
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ResultCard icon={LayoutGrid} label="Quantidade de placas" value={`${result.panelsCount}`} sub={`de ${result.panelPowerW} W`} brand={brand} />
                <ResultCard icon={Zap} label="Potência do sistema" value={`${formatNumber(result.systemKwp)} kWp`} sub={`≈ ${formatNumber(result.monthlyGenerationKwh, 0)} kWh/mês`} brand={brand} />
                <ResultCard icon={PiggyBank} label="Investimento à vista" value={formatBRLShort(result.estimatedPrice)} sub="estimado" brand={brand} />
                <ResultCard icon={CreditCard} label="Parcela estimada" value={formatBRL(result.installmentValue)} sub={`em ${result.installments}x`} brand={brand} />
                <ResultCard
                  icon={CalendarClock}
                  label="Retorno do investimento"
                  value={result.paybackYears ? `${formatNumber(result.paybackYears, 1)} anos` : "—"}
                  sub="payback estimado"
                  brand={brand}
                />
                <ResultCard icon={Leaf} label="CO2 evitado" value={`${formatNumber(result.co2Tons25y, 1)} t`} sub="em 25 anos" brand="#16a34a" />
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                <TreePine className="h-8 w-8 shrink-0 text-emerald-600" />
                <p className="text-sm text-emerald-800">
                  Isso equivale a plantar cerca de <strong>{result.treesEquivalent} árvores</strong>. Você economiza e ainda
                  ajuda o planeta. 🌱
                </p>
              </div>

              {result.installmentValue <= bill && (
                <p className="rounded-2xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-100">
                  💡 A parcela estimada (<strong>{formatBRL(result.installmentValue)}</strong>) é menor que a sua conta de luz
                  atual (<strong>{formatBRL(bill)}</strong>). Você troca a conta pela parcela e, depois de quitado, a economia fica toda com você.
                </p>
              )}

              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={proposalLoading || printRequested}
                  className={primaryBtn}
                  style={{ backgroundColor: brand, color: brandText }}
                >
                  {proposalLoading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
                  {proposalLoading ? "Gerando sua proposta..." : "Baixar Proposta Oficial em PDF"}
                </button>
                <a
                  href={whatsappLink(profile.whatsapp, whatsappSummary)}
                  target="_blank"
                  rel="noreferrer"
                  className={`${primaryBtn} bg-emerald-500 text-white hover:bg-emerald-600`}
                >
                  <MessageCircle className="h-5 w-5" />
                  Falar com {consultant} no WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
                >
                  <RotateCcw className="h-4 w-4" /> Refazer simulação
                </button>
              </div>

              <p className="px-2 text-center text-[11px] leading-relaxed text-slate-400">
                Valores estimados com base na tarifa média de {formatBRL(params.tariffKwh)}/kWh, geração média de{" "}
                {formatNumber(params.generationKwhPerKwp, 0)} kWh/kWp/mês, reajuste de tarifa de 6% ao ano e degradação de 0,5%
                ao ano. A proposta final depende de visita técnica.
              </p>
            </section>
          )}
        </main>

        {step === 3 && (
          <ChatWidget
            slug={profile.slug}
            companyName={profile.company_name}
            consultantName={profile.consultant_name}
            brand={brand}
            brandText={brandText}
            simulation={simulationPayload}
          />
        )}
      </div>

      {/* Versão de impressão (só aparece no PDF) */}
      {step === 3 && proposalText && (
        <ProposalPrint
          profile={profile}
          clientName={name.trim()}
          clientPhone={phone}
          city={city.trim()}
          state={uf}
          propertyType={propertyType}
          roofType={roofType}
          billValue={bill}
          result={result}
          text={proposalText}
          tariffKwh={params.tariffKwh}
        />
      )}
    </div>
  );
}

function ResultCard({
  icon: Icon,
  label,
  value,
  sub,
  brand,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  sub?: string;
  brand: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <span
        className="mb-2 grid h-9 w-9 place-items-center rounded-xl"
        style={{ backgroundColor: `${brand}1a`, color: brand }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold leading-tight text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
