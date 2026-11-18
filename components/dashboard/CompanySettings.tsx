"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bot,
  Calculator,
  ImageUp,
  LoaderCircle,
  Palette,
  Save,
  Store,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isValidSlug, RESERVED_SLUGS } from "@/lib/profiles-shared";
import { calculateSimulation } from "@/lib/solar";
import { formatBRL, formatNumber, formatPhoneBR, onlyDigits, readableTextColor, safeColor } from "@/lib/format";
import type { Profile } from "@/lib/types";

interface Props {
  profile: Profile;
  onSaved: (profile: Profile) => void;
}

type FormState = {
  company_name: string;
  consultant_name: string;
  whatsapp: string;
  slug: string;
  primary_color: string;
  logo_url: string;
  panel_power_w: string;
  generation_kwh_per_kwp: string;
  price_per_kwp: string;
  tariff_kwh: string;
  monthly_interest_rate: string;
  max_installments: string;
  faq_rules: string;
};

const COLOR_PRESETS = ["#F59E0B", "#EA580C", "#16A34A", "#0EA5E9", "#2563EB", "#7C3AED", "#DB2777", "#0F172A"];

const FAQ_PLACEHOLDER = `Exemplo:
- Prazo de instalação: até 30 dias após a assinatura do contrato.
- Garantia: 25 anos de performance nos módulos, 10 anos no inversor e 1 ano na instalação.
- Formas de pagamento: à vista com 5% de desconto, financiamento em até 84x ou cartão em até 18x.
- Atendemos toda a região metropolitana e interior do estado.
- A visita técnica é gratuita e sem compromisso.
- Homologação na distribuidora inclusa no projeto.`;

function toForm(p: Profile): FormState {
  return {
    company_name: p.company_name ?? "",
    consultant_name: p.consultant_name ?? "",
    whatsapp: formatPhoneBR(p.whatsapp ?? ""),
    slug: p.slug ?? "",
    primary_color: p.primary_color ?? "#F59E0B",
    logo_url: p.logo_url ?? "",
    panel_power_w: String(p.panel_power_w ?? 550),
    generation_kwh_per_kwp: String(p.generation_kwh_per_kwp ?? 120).replace(".", ","),
    price_per_kwp: String(p.price_per_kwp ?? 3500).replace(".", ","),
    tariff_kwh: String(p.tariff_kwh ?? 0.95).replace(".", ","),
    monthly_interest_rate: String(p.monthly_interest_rate ?? 1.49).replace(".", ","),
    max_installments: String(p.max_installments ?? 84),
    faq_rules: p.faq_rules ?? "",
  };
}

function parseNum(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  return Number.parseFloat(normalized);
}

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 50);
}

const NUMBER_RULES: {
  key: keyof FormState;
  label: string;
  min: number;
  max: number;
}[] = [
  { key: "panel_power_w", label: "Potência da placa", min: 100, max: 1000 },
  { key: "generation_kwh_per_kwp", label: "Geração média", min: 50, max: 250 },
  { key: "price_per_kwp", label: "Preço por kWp", min: 500, max: 50000 },
  { key: "tariff_kwh", label: "Tarifa de energia", min: 0.1, max: 5 },
  { key: "monthly_interest_rate", label: "Taxa de juros", min: 0, max: 10 },
  { key: "max_installments", label: "Prazo máximo", min: 1, max: 240 },
];

export default function CompanySettings({ profile, onSaved }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(() => toForm(profile));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const preview = useMemo(() => {
    const params = {
      panelPowerW: parseNum(form.panel_power_w) || 550,
      generationKwhPerKwp: parseNum(form.generation_kwh_per_kwp) || 120,
      pricePerKwp: parseNum(form.price_per_kwp) || 3500,
      tariffKwh: parseNum(form.tariff_kwh) || 0.95,
      monthlyInterestRate: parseNum(form.monthly_interest_rate) || 0,
      maxInstallments: parseNum(form.max_installments) || 1,
    };
    return calculateSimulation({ billValue: 500, roofType: "Cerâmico", propertyType: "Residencial" }, params);
  }, [form]);

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Envie um arquivo de imagem (PNG, JPG, WEBP ou SVG)." });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: "error", text: "A logo deve ter no máximo 2 MB." });
      return;
    }

    setUploading(true);
    setMessage(null);
    const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${profile.id}/logo-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("logos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

    if (error) {
      setUploading(false);
      setMessage({ type: "error", text: `Falha no upload: ${error.message}` });
      return;
    }

    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    set("logo_url", data.publicUrl);
    setUploading(false);
    setMessage({ type: "ok", text: "Logo enviada! Clique em Salvar alterações para aplicar." });
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const slug = sanitizeSlug(form.slug).replace(/^-+|-+$/g, "");
    if (!isValidSlug(slug)) {
      setMessage({
        type: "error",
        text: RESERVED_SLUGS.includes(slug)
          ? "Esse link é reservado pelo sistema. Escolha outro."
          : "O link deve ter de 3 a 50 caracteres: letras minúsculas, números e hífens.",
      });
      return;
    }

    if (form.company_name.trim().length < 2) {
      setMessage({ type: "error", text: "Informe o nome da empresa." });
      return;
    }

    if (!/^#[0-9a-fA-F]{6}$/.test(form.primary_color)) {
      setMessage({ type: "error", text: "Cor principal inválida. Use o formato #RRGGBB." });
      return;
    }

    const whatsappDigits = onlyDigits(form.whatsapp);
    if (whatsappDigits && (whatsappDigits.length < 10 || whatsappDigits.length > 13)) {
      setMessage({ type: "error", text: "WhatsApp inválido. Use DDD + número." });
      return;
    }

    const numbers: Record<string, number> = {};
    for (const rule of NUMBER_RULES) {
      const value = parseNum(form[rule.key]);
      if (!Number.isFinite(value) || value < rule.min || value > rule.max) {
        setMessage({
          type: "error",
          text: `${rule.label}: informe um valor entre ${rule.min} e ${rule.max}.`,
        });
        return;
      }
      numbers[rule.key] = value;
    }

    const logo = form.logo_url.trim();
    if (logo && !/^https?:\/\//i.test(logo)) {
      setMessage({ type: "error", text: "A URL da logo deve começar com http:// ou https://" });
      return;
    }

    setSaving(true);
    const payload = {
      company_name: form.company_name.trim(),
      consultant_name: form.consultant_name.trim(),
      whatsapp: whatsappDigits,
      slug,
      primary_color: form.primary_color.toUpperCase(),
      logo_url: logo || null,
      panel_power_w: Math.round(numbers.panel_power_w),
      generation_kwh_per_kwp: numbers.generation_kwh_per_kwp,
      price_per_kwp: numbers.price_per_kwp,
      tariff_kwh: numbers.tariff_kwh,
      monthly_interest_rate: numbers.monthly_interest_rate,
      max_installments: Math.round(numbers.max_installments),
      faq_rules: form.faq_rules.trim().slice(0, 8000),
    };

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", profile.id)
      .select("*")
      .single();

    setSaving(false);

    if (error) {
      const text =
        error.code === "23505"
          ? "Esse link público já está em uso por outra empresa. Escolha outro."
          : error.code === "23514"
            ? "Algum valor está fora do permitido. Revise os campos."
            : `Erro ao salvar: ${error.message}`;
      setMessage({ type: "error", text });
      return;
    }

    const updated = data as Profile;
    onSaved(updated);
    setForm(toForm(updated));
    setMessage({ type: "ok", text: "Alterações salvas! Seu link público já está atualizado." });
  }

  const label = "mb-1 block text-sm font-medium text-slate-700";
  const input =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100";
  const card = "rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6";
  const hint = "mt-1 text-xs text-slate-500";

  return (
    <form onSubmit={handleSave} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* Identidade */}
        <section className={card}>
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Store className="h-5 w-5 text-slate-500" /> Identidade da empresa
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Nome da empresa</label>
              <input className={input} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
            </div>
            <div>
              <label className={label}>Nome do consultor</label>
              <input className={input} value={form.consultant_name} onChange={(e) => set("consultant_name", e.target.value)} placeholder="Quem atende o cliente" />
            </div>
            <div>
              <label className={label}>WhatsApp (com DDD)</label>
              <input
                className={input}
                inputMode="tel"
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", formatPhoneBR(e.target.value))}
                placeholder="(11) 91234-5678"
              />
              <p className={hint}>Os clientes vão falar com você por esse número.</p>
            </div>
            <div>
              <label className={label}>Link público (slug)</label>
              <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 focus-within:border-slate-400 focus-within:ring-4 focus-within:ring-slate-100">
                <span className="bg-slate-50 px-3 py-2.5 text-sm text-slate-500">/</span>
                <input
                  className="w-full px-2 py-2.5 text-slate-900 outline-none"
                  value={form.slug}
                  onChange={(e) => set("slug", sanitizeSlug(e.target.value))}
                  placeholder="joao-solar"
                />
              </div>
              <p className={hint}>Letras minúsculas, números e hífens.</p>
            </div>
          </div>
        </section>

        {/* Marca */}
        <section className={card}>
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Palette className="h-5 w-5 text-slate-500" /> Marca
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className={label}>Cor principal</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(form.primary_color) ? form.primary_color : "#F59E0B"}
                  onChange={(e) => set("primary_color", e.target.value.toUpperCase())}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                />
                <input
                  className={input}
                  value={form.primary_color}
                  onChange={(e) => set("primary_color", e.target.value.trim())}
                  maxLength={7}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("primary_color", c)}
                    className={`h-7 w-7 rounded-full ring-2 ring-offset-2 transition ${
                      form.primary_color.toUpperCase() === c ? "ring-slate-900" : "ring-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Usar cor ${c}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className={label}>Logo</label>
              <div className="flex items-center gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
                  {form.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <ImageUp className="h-6 w-6 text-slate-400" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                    Enviar imagem
                  </button>
                  {form.logo_url && (
                    <button
                      type="button"
                      onClick={() => set("logo_url", "")}
                      className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remover logo
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
              </div>
              <input
                className={`${input} mt-3`}
                value={form.logo_url}
                onChange={(e) => set("logo_url", e.target.value)}
                placeholder="ou cole a URL da logo (https://...)"
              />
            </div>
          </div>
        </section>

        {/* Parâmetros de cálculo */}
        <section className={card}>
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Calculator className="h-5 w-5 text-slate-500" /> Preços e parâmetros de cálculo
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={label}>Potência da placa (W)</label>
              <input className={input} inputMode="numeric" value={form.panel_power_w} onChange={(e) => set("panel_power_w", e.target.value)} />
              <p className={hint}>Ex.: 550, 585, 610</p>
            </div>
            <div>
              <label className={label}>Geração média (kWh/kWp/mês)</label>
              <input className={input} inputMode="decimal" value={form.generation_kwh_per_kwp} onChange={(e) => set("generation_kwh_per_kwp", e.target.value)} />
              <p className={hint}>Brasil: geralmente entre 100 e 140</p>
            </div>
            <div>
              <label className={label}>Preço médio por kWp (R$)</label>
              <input className={input} inputMode="decimal" value={form.price_per_kwp} onChange={(e) => set("price_per_kwp", e.target.value)} />
              <p className={hint}>Valor do sistema instalado</p>
            </div>
            <div>
              <label className={label}>Tarifa de energia (R$/kWh)</label>
              <input className={input} inputMode="decimal" value={form.tariff_kwh} onChange={(e) => set("tariff_kwh", e.target.value)} />
              <p className={hint}>Usada para converter a conta em kWh</p>
            </div>
            <div>
              <label className={label}>Taxa de juros mensal (%)</label>
              <input className={input} inputMode="decimal" value={form.monthly_interest_rate} onChange={(e) => set("monthly_interest_rate", e.target.value)} />
              <p className={hint}>Do financiamento solar</p>
            </div>
            <div>
              <label className={label}>Prazo máximo (meses)</label>
              <input className={input} inputMode="numeric" value={form.max_installments} onChange={(e) => set("max_installments", e.target.value)} />
              <p className={hint}>Ex.: 60, 72, 84, 120</p>
            </div>
          </div>
        </section>

        {/* Regras para IA */}
        <section className={card}>
          <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
            <Bot className="h-5 w-5 text-slate-500" /> Regras e FAQ da empresa (alimenta a IA)
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            Prazo de instalação, garantias, formas de pagamento, regiões atendidas. O assistente
            virtual usa este texto para responder seus clientes.
          </p>
          <textarea
            className={`${input} min-h-[220px] font-mono text-sm`}
            value={form.faq_rules}
            onChange={(e) => set("faq_rules", e.target.value)}
            placeholder={FAQ_PLACEHOLDER}
            maxLength={8000}
          />
          <p className={hint}>{form.faq_rules.length}/8000 caracteres</p>
        </section>
      </div>

      {/* Coluna lateral */}
      <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
        <div className={card}>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Pré-visualização do cálculo</h3>
          <p className="mb-3 text-xs text-slate-500">Exemplo com conta de R$ 500/mês, telhado cerâmico:</p>
          <dl className="space-y-2 text-sm">
            {[
              ["Sistema", `${formatNumber(preview.systemKwp)} kWp`],
              ["Placas", `${preview.panelsCount} × ${preview.panelPowerW} W`],
              ["Economia/mês", formatBRL(preview.monthlySavings)],
              ["Investimento", formatBRL(preview.estimatedPrice)],
              ["Parcela", `${preview.installments}× ${formatBRL(preview.installmentValue)}`],
              ["Payback", preview.paybackYears ? `${formatNumber(preview.paybackYears, 1)} anos` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          <div
            className="mt-4 rounded-xl px-4 py-3 text-center text-sm font-semibold"
            style={{
              backgroundColor: safeColor(form.primary_color),
              color: readableTextColor(safeColor(form.primary_color)),
            }}
          >
            Prévia da cor do botão
          </div>
        </div>

        {message && (
          <p
            className={`rounded-xl px-4 py-3 text-sm ring-1 ${
              message.type === "ok"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-red-50 text-red-700 ring-red-200"
            }`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Salvar alterações
        </button>
      </aside>
    </form>
  );
}
