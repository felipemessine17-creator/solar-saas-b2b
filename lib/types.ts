export type LeadStatus = "novo" | "em_contato" | "visita_agendada" | "fechado" | "perdido";
export type LeadTemperature = "quente" | "morno" | "frio";

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "em_contato", label: "Em Contato" },
  { value: "visita_agendada", label: "Visita Agendada" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
];

export interface Profile {
  id: string;
  slug: string;
  company_name: string;
  consultant_name: string;
  whatsapp: string;
  primary_color: string;
  logo_url: string | null;
  panel_power_w: number;
  generation_kwh_per_kwp: number;
  price_per_kwp: number;
  tariff_kwh: number;
  monthly_interest_rate: number;
  max_installments: number;
  faq_rules: string;
  created_at: string;
  updated_at: string;
}

/** Campos do perfil que podem ir para a página pública. */
export type PublicProfile = Pick<
  Profile,
  | "id"
  | "slug"
  | "company_name"
  | "consultant_name"
  | "whatsapp"
  | "primary_color"
  | "logo_url"
  | "panel_power_w"
  | "generation_kwh_per_kwp"
  | "price_per_kwp"
  | "tariff_kwh"
  | "monthly_interest_rate"
  | "max_installments"
  | "faq_rules"
>;

export const PUBLIC_PROFILE_FIELDS =
  "id, slug, company_name, consultant_name, whatsapp, primary_color, logo_url, panel_power_w, generation_kwh_per_kwp, price_per_kwp, tariff_kwh, monthly_interest_rate, max_installments, faq_rules";

export interface LeadNote {
  text: string;
  created_at: string;
}

export interface Lead {
  id: string;
  profile_id: string;
  name: string;
  whatsapp: string;
  bill_value: number;
  city: string;
  state: string;
  property_type: string;
  roof_type: string;
  system_kwp: number | null;
  panels_count: number | null;
  monthly_savings: number | null;
  estimated_price: number | null;
  installments: number | null;
  installment_value: number | null;
  temperature: LeadTemperature;
  status: LeadStatus;
  notes: LeadNote[];
  created_at: string;
  updated_at: string;
}
