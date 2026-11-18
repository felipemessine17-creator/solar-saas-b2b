"use client";

import { Leaf, Sun } from "lucide-react";
import { formatBRL, formatDate, formatNumber, formatPhoneBR, readableTextColor, safeColor } from "@/lib/format";
import { ASSUMPTIONS, type SimulationResult } from "@/lib/solar";
import type { PublicProfile } from "@/lib/types";

interface Props {
  profile: PublicProfile;
  clientName: string;
  clientPhone: string;
  city: string;
  state: string;
  propertyType: string;
  roofType: string;
  billValue: number;
  result: SimulationResult;
  text: string;
  tariffKwh: number;
}

/**
 * Layout da proposta comercial. Fica oculto na tela (hidden) e aparece
 * apenas na impressão (print:block) — o cliente salva como PDF.
 */
export default function ProposalPrint({
  profile,
  clientName,
  clientPhone,
  city,
  state,
  propertyType,
  roofType,
  billValue,
  result,
  text,
  tariffKwh,
}: Props) {
  const brand = safeColor(profile.primary_color);
  const brandText = readableTextColor(brand);
  const today = new Date();
  const validUntil = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
  const proposalNumber = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
    today.getDate()
  ).padStart(2, "0")}-${String(today.getHours()).padStart(2, "0")}${String(today.getMinutes()).padStart(2, "0")}`;

  const rows: [string, string][] = [
    ["Potência do sistema", `${formatNumber(result.systemKwp)} kWp`],
    ["Módulos fotovoltaicos", `${result.panelsCount} placas de ${result.panelPowerW} W`],
    ["Geração média estimada", `${formatNumber(result.monthlyGenerationKwh, 0)} kWh/mês`],
    ["Consumo estimado atual", `${formatNumber(result.monthlyKwh, 0)} kWh/mês`],
    ["Tipo de imóvel / telhado", `${propertyType} · ${roofType}`],
  ];

  const finance: [string, string][] = [
    ["Conta de luz atual", `${formatBRL(billValue)}/mês`],
    ["Economia mensal estimada", formatBRL(result.monthlySavings)],
    ["Economia em 25 anos", formatBRL(result.savings25y)],
    ["Investimento à vista", formatBRL(result.estimatedPrice)],
    ["Financiamento estimado", `${result.installments}x de ${formatBRL(result.installmentValue)}`],
    ["Retorno do investimento", result.paybackYears ? `${formatNumber(result.paybackYears, 1)} anos` : "—"],
  ];

  return (
    <div className="hidden bg-white text-slate-900 print:block">
      <div className="mx-auto max-w-[190mm] text-[12px] leading-relaxed">
        {/* Cabeçalho */}
        <header className="flex items-center justify-between border-b-4 pb-4" style={{ borderColor: brand }}>
          <div className="flex items-center gap-3">
            {profile.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logo_url} alt={profile.company_name} className="h-14 w-14 object-contain" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-xl" style={{ backgroundColor: brand, color: brandText }}>
                <Sun className="h-8 w-8" />
              </span>
            )}
            <div>
              <p className="text-lg font-bold">{profile.company_name}</p>
              <p className="text-slate-500">
                {profile.consultant_name ? `Consultor: ${profile.consultant_name}` : "Energia Solar Fotovoltaica"}
                {profile.whatsapp ? ` · WhatsApp ${formatPhoneBR(profile.whatsapp.replace(/^55(?=\d{10,11}$)/, ""))}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Proposta comercial</p>
            <p className="font-semibold">Nº {proposalNumber}</p>
            <p className="text-slate-500">{formatDate(today)}</p>
          </div>
        </header>

        {/* Cliente */}
        <section className="avoid-break mt-5 grid grid-cols-3 gap-4 rounded-lg bg-slate-50 p-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Cliente</p>
            <p className="font-semibold">{clientName || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Contato</p>
            <p className="font-semibold">{clientPhone || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Local da instalação</p>
            <p className="font-semibold">
              {city || "—"}
              {state ? `/${state}` : ""}
            </p>
          </div>
        </section>

        {/* Destaque */}
        <section className="avoid-break mt-5 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg p-4" style={{ backgroundColor: brand, color: brandText }}>
            <p className="text-[10px] uppercase tracking-wide opacity-90">Economia mensal</p>
            <p className="text-xl font-bold">{formatBRL(result.monthlySavings)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Economia em 25 anos</p>
            <p className="text-xl font-bold">{formatBRL(result.savings25y)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Payback</p>
            <p className="text-xl font-bold">
              {result.paybackYears ? `${formatNumber(result.paybackYears, 1)} anos` : "—"}
            </p>
          </div>
        </section>

        {/* Texto personalizado */}
        <section className="avoid-break mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: brand }}>
            Apresentação
          </h2>
          {text
            .split(/\n{2,}|\n/)
            .filter((p) => p.trim())
            .map((paragraph, i) => (
              <p key={i} className="mb-2 text-justify text-[12.5px]">
                {paragraph.trim()}
              </p>
            ))}
        </section>

        {/* Tabelas */}
        <section className="mt-5 grid grid-cols-2 gap-5">
          <div className="avoid-break">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: brand }}>
              Sistema proposto
            </h2>
            <table className="w-full border-collapse">
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-500">{k}</td>
                    <td className="py-1.5 text-right font-semibold">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="avoid-break">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: brand }}>
              Investimento e retorno
            </h2>
            <table className="w-full border-collapse">
              <tbody>
                {finance.map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 text-slate-500">{k}</td>
                    <td className="py-1.5 text-right font-semibold">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ambiental */}
        <section className="avoid-break mt-5 flex items-center gap-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <Leaf className="h-8 w-8 shrink-0 text-emerald-600" />
          <p className="text-emerald-900">
            Em 25 anos, seu sistema evitará a emissão de aproximadamente{" "}
            <strong>{formatNumber(result.co2Tons25y, 1)} toneladas de CO2</strong>, o equivalente a{" "}
            <strong>{result.treesEquivalent} árvores</strong>.
          </p>
        </section>

        {/* Condições */}
        {profile.faq_rules?.trim() && (
          <section className="avoid-break mt-5">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: brand }}>
              Condições e informações da empresa
            </h2>
            <p className="whitespace-pre-wrap text-[11.5px] text-slate-700">{profile.faq_rules.trim()}</p>
          </section>
        )}

        {/* Rodapé */}
        <footer className="avoid-break mt-6 border-t border-slate-200 pt-4 text-[10px] text-slate-500">
          <p>
            Proposta válida até {formatDate(validUntil)}. Valores estimados com base em tarifa média de{" "}
            {formatBRL(tariffKwh)}/kWh, reajuste tarifário de {formatNumber(ASSUMPTIONS.tariffIncreasePerYear * 100, 0)}% ao ano e
            degradação dos módulos de {formatNumber(ASSUMPTIONS.degradationPerYear * 100, 1)}% ao ano. Dimensionamento,
            preço e condições de pagamento serão confirmados após visita técnica e análise de crédito.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-10 text-center text-[11px] text-slate-700">
            <div className="border-t border-slate-400 pt-1">
              {profile.consultant_name || profile.company_name}
              <br />
              <span className="text-slate-500">{profile.company_name}</span>
            </div>
            <div className="border-t border-slate-400 pt-1">
              {clientName || "Cliente"}
              <br />
              <span className="text-slate-500">Cliente</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
