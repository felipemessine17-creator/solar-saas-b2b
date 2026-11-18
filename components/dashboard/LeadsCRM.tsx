"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Inbox,
  LoaderCircle,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  StickyNote,
  Trash2,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatBRL, formatDateTime, formatNumber, formatPhoneBR, whatsappLink } from "@/lib/format";
import {
  LEAD_STATUSES,
  type Lead,
  type LeadNote,
  type LeadStatus,
  type LeadTemperature,
  type Profile,
} from "@/lib/types";

const TEMP_META: Record<LeadTemperature, { label: string; emoji: string; badge: string; card: string }> = {
  quente: {
    label: "Quente",
    emoji: "🔥",
    badge: "bg-red-50 text-red-700 ring-red-200",
    card: "border-l-red-500",
  },
  morno: {
    label: "Morno",
    emoji: "☀️",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    card: "border-l-amber-400",
  },
  frio: {
    label: "Frio",
    emoji: "❄️",
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
    card: "border-l-sky-400",
  },
};

const STATUS_STYLE: Record<LeadStatus, string> = {
  novo: "bg-slate-100 text-slate-700",
  em_contato: "bg-blue-50 text-blue-700",
  visita_agendada: "bg-violet-50 text-violet-700",
  fechado: "bg-emerald-50 text-emerald-700",
  perdido: "bg-rose-50 text-rose-700",
};

type TempFilter = "todos" | LeadTemperature;
type StatusFilter = "todos" | LeadStatus;

interface Props {
  profile: Profile;
  initialLeads: Lead[];
  onCountChange?: (count: number) => void;
}

function normalizeLead(raw: Lead): Lead {
  return {
    ...raw,
    bill_value: Number(raw.bill_value),
    notes: Array.isArray(raw.notes) ? raw.notes : [],
  };
}

export default function LeadsCRM({ profile, initialLeads, onCountChange }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [leads, setLeads] = useState<Lead[]>(() => initialLeads.map(normalizeLead));
  const [tempFilter, setTempFilter] = useState<TempFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCountChange?.(leads.length);
  }, [leads.length, onCountChange]);

  const counts = useMemo(() => {
    const c = { quente: 0, morno: 0, frio: 0, fechado: 0, pipeline: 0 };
    for (const l of leads) {
      c[l.temperature] += 1;
      if (l.status === "fechado") c.fechado += 1;
      if (l.status !== "fechado" && l.status !== "perdido") c.pipeline += Number(l.estimated_price ?? 0);
    }
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (tempFilter !== "todos" && l.temperature !== tempFilter) return false;
      if (statusFilter !== "todos" && l.status !== statusFilter) return false;
      if (q) {
        const hay = `${l.name} ${l.city} ${l.state} ${l.whatsapp}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, tempFilter, statusFilter, search]);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("leads")
      .select("*")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(1000);
    setRefreshing(false);
    if (err) {
      setError(`Erro ao atualizar: ${err.message}`);
      return;
    }
    setLeads(((data ?? []) as Lead[]).map(normalizeLead));
  }

  async function updateLead(id: string, patch: Partial<Pick<Lead, "status" | "notes">>) {
    const previous = leads;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    const { error: err } = await supabase.from("leads").update(patch).eq("id", id);
    if (err) {
      setLeads(previous);
      setError(`Não foi possível salvar: ${err.message}`);
      return false;
    }
    return true;
  }

  async function deleteLead(id: string) {
    if (!window.confirm("Excluir este lead definitivamente?")) return;
    const previous = leads;
    setLeads((ls) => ls.filter((l) => l.id !== id));
    const { error: err } = await supabase.from("leads").delete().eq("id", id);
    if (err) {
      setLeads(previous);
      setError(`Não foi possível excluir: ${err.message}`);
    }
  }

  const statCard = "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 text-left transition";

  return (
    <div className="space-y-5">
      {/* Resumo / filtros por temperatura */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <button
          onClick={() => setTempFilter("todos")}
          className={`${statCard} ${tempFilter === "todos" ? "ring-2 ring-slate-900" : "hover:ring-slate-300"}`}
        >
          <p className="text-xs font-medium text-slate-500">Total de leads</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{leads.length}</p>
        </button>
        {(Object.keys(TEMP_META) as LeadTemperature[]).map((t) => (
          <button
            key={t}
            onClick={() => setTempFilter(tempFilter === t ? "todos" : t)}
            className={`${statCard} ${tempFilter === t ? "ring-2 ring-slate-900" : "hover:ring-slate-300"}`}
          >
            <p className="text-xs font-medium text-slate-500">
              {TEMP_META[t].emoji} Lead {TEMP_META[t].label}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{counts[t]}</p>
          </button>
        ))}
        <div className={`${statCard} col-span-2 md:col-span-1`}>
          <p className="text-xs font-medium text-slate-500">Pipeline em aberto</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{formatBRL(counts.pipeline)}</p>
          <p className="text-xs text-emerald-600">{counts.fechado} fechado(s)</p>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, cidade ou telefone"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={tempFilter}
            onChange={(e) => setTempFilter(e.target.value as TempFilter)}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none sm:flex-none"
          >
            <option value="todos">Todas as temperaturas</option>
            <option value="quente">🔥 Quente (≥ R$ 800)</option>
            <option value="morno">☀️ Morno (R$ 400–799)</option>
            <option value="frio">❄️ Frio (&lt; R$ 400)</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none sm:flex-none"
          >
            <option value="todos">Todos os status</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="grid w-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            title="Atualizar lista"
          >
            {refreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-200">
          <Inbox className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-700">
            {leads.length === 0 ? "Nenhum lead ainda" : "Nenhum lead com esses filtros"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {leads.length === 0
              ? "Compartilhe seu link público no WhatsApp, Instagram e Google para começar a receber simulações."
              : "Ajuste a busca ou os filtros acima."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              profile={profile}
              onStatus={(status) => updateLead(lead.id, { status })}
              onAddNote={(text) =>
                updateLead(lead.id, {
                  notes: [...lead.notes, { text, created_at: new Date().toISOString() }],
                })
              }
              onDeleteNote={(index) =>
                updateLead(lead.id, { notes: lead.notes.filter((_, i) => i !== index) })
              }
              onDelete={() => deleteLead(lead.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface CardProps {
  lead: Lead;
  profile: Profile;
  onStatus: (status: LeadStatus) => void;
  onAddNote: (text: string) => Promise<boolean>;
  onDeleteNote: (index: number) => void;
  onDelete: () => void;
}

function LeadCard({ lead, profile, onStatus, onAddNote, onDeleteNote, onDelete }: CardProps) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const temp = TEMP_META[lead.temperature];

  const firstName = lead.name.split(" ")[0];
  const consultant = profile.consultant_name || profile.company_name;
  const waText = `Olá, ${firstName}! Aqui é ${consultant}, da ${profile.company_name}. Vi a sua simulação de energia solar (conta de ${formatBRL(
    lead.bill_value
  )}/mês)${
    lead.monthly_savings ? ` com economia estimada de ${formatBRL(Number(lead.monthly_savings))} por mês` : ""
  }. Posso te ajudar a montar a proposta definitiva?`;

  async function submitNote(e: React.FormEvent) {
    e.preventDefault();
    const text = note.trim();
    if (!text) return;
    setSavingNote(true);
    const ok = await onAddNote(text.slice(0, 1000));
    setSavingNote(false);
    if (ok) setNote("");
  }

  return (
    <article
      className={`flex flex-col rounded-2xl border-l-4 bg-white p-4 shadow-sm ring-1 ring-slate-200 ${temp.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{lead.name}</h3>
          <p className="text-sm text-slate-500">{formatPhoneBR(lead.whatsapp.replace(/^55(?=\d{10,11}$)/, ""))}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${temp.badge}`}>
          {temp.emoji} {temp.label}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Conta de luz</dt>
          <dd className="font-semibold text-slate-900">{formatBRL(lead.bill_value)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Sistema</dt>
          <dd className="flex items-center gap-1 font-semibold text-slate-900">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            {lead.system_kwp ? `${formatNumber(Number(lead.system_kwp))} kWp` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Investimento</dt>
          <dd className="font-medium text-slate-800">
            {lead.estimated_price ? formatBRL(Number(lead.estimated_price)) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Imóvel / telhado</dt>
          <dd className="truncate font-medium text-slate-800">
            {lead.property_type} · {lead.roof_type}
          </dd>
        </div>
      </dl>

      <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
        <MapPin className="h-3.5 w-3.5" />
        {lead.city || "Cidade não informada"}
        {lead.state ? `/${lead.state}` : ""} · {formatDateTime(lead.created_at)}
      </p>

      <div className="mt-4 flex gap-2">
        <select
          value={lead.status}
          onChange={(e) => onStatus(e.target.value as LeadStatus)}
          className={`flex-1 rounded-xl border-0 px-3 py-2 text-sm font-medium outline-none ring-1 ring-slate-200 ${STATUS_STYLE[lead.status]}`}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <a
          href={whatsappLink(lead.whatsapp, waText)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-3 flex items-center justify-between rounded-lg px-1 py-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <span className="flex items-center gap-1.5">
          <StickyNote className="h-4 w-4" />
          Histórico e notas ({lead.notes.length})
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-3">
          {lead.notes.length === 0 && <p className="text-xs text-slate-400">Nenhuma nota ainda.</p>}
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {lead.notes.map((n: LeadNote, i: number) => (
              <li key={`${n.created_at}-${i}`} className="group rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap text-slate-700">{n.text}</p>
                  <button
                    onClick={() => onDeleteNote(i)}
                    className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                    title="Remover nota"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">{formatDateTime(n.created_at)}</p>
              </li>
            ))}
          </ul>
          <form onSubmit={submitNote} className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: Ligou, pediu visita sábado"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
            <button
              type="submit"
              disabled={savingNote || !note.trim()}
              className="grid w-10 place-items-center rounded-xl bg-slate-900 text-white disabled:opacity-40"
              title="Adicionar nota"
            >
              {savingNote ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 pt-1 text-xs text-slate-400 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir lead
          </button>
        </div>
      )}
    </article>
  );
}
