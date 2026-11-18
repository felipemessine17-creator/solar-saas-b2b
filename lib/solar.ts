import type { LeadTemperature, PublicProfile } from "./types";

export const PROPERTY_TYPES = ["Residencial", "Comercial", "Rural", "Industrial"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const ROOF_TYPES = ["Cerâmico", "Fibrocimento", "Metálico", "Laje", "Solo"] as const;
export type RoofType = (typeof ROOF_TYPES)[number];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

/**
 * Premissas do cálculo. Ajuste aqui se quiser outro comportamento.
 * - savingsRate: parte da conta que é efetivamente economizada (o restante
 *   cobre custo de disponibilidade / taxa mínima / Fio B).
 * - co2TonsPerMWh: fator médio de emissão do grid brasileiro (SIN). Varia
 *   ano a ano conforme a matriz; confira o valor oficial mais recente do MCTI.
 * - treeKgCo2PerYear: absorção média aproximada de uma árvore por ano.
 */
export const ASSUMPTIONS = {
  savingsRate: 0.85,
  tariffIncreasePerYear: 0.06,
  degradationPerYear: 0.005,
  years: 25,
  co2TonsPerMWh: 0.0426,
  treeKgCo2PerYear: 22,
} as const;

/** Ajuste de custo de estrutura conforme o telhado. */
const ROOF_COST_FACTOR: Record<RoofType, number> = {
  "Cerâmico": 1,
  Fibrocimento: 1,
  "Metálico": 0.97,
  Laje: 1.06,
  Solo: 1.1,
};

export interface SolarParams {
  panelPowerW: number;
  generationKwhPerKwp: number;
  pricePerKwp: number;
  tariffKwh: number;
  monthlyInterestRate: number;
  maxInstallments: number;
}

export interface SimulationInput {
  billValue: number;
  roofType: RoofType;
  propertyType: PropertyType;
}

export interface SimulationResult {
  monthlyKwh: number;
  systemKwp: number;
  panelsCount: number;
  panelPowerW: number;
  monthlyGenerationKwh: number;
  monthlySavings: number;
  savings25y: number;
  estimatedPrice: number;
  installments: number;
  installmentValue: number;
  paybackYears: number | null;
  co2Tons25y: number;
  treesEquivalent: number;
}

export function paramsFromProfile(p: PublicProfile): SolarParams {
  return {
    panelPowerW: Number(p.panel_power_w),
    generationKwhPerKwp: Number(p.generation_kwh_per_kwp),
    pricePerKwp: Number(p.price_per_kwp),
    tariffKwh: Number(p.tariff_kwh),
    monthlyInterestRate: Number(p.monthly_interest_rate),
    maxInstallments: Number(p.max_installments),
  };
}

/** Parcela pela Tabela Price. ratePercent = juros ao mês em %. */
export function pmt(presentValue: number, ratePercent: number, periods: number): number {
  const i = ratePercent / 100;
  if (periods <= 0) return presentValue;
  if (i <= 0) return presentValue / periods;
  return (presentValue * i) / (1 - Math.pow(1 + i, -periods));
}

export function getTemperature(billValue: number): LeadTemperature {
  if (billValue >= 800) return "quente";
  if (billValue >= 400) return "morno";
  return "frio";
}

export function isPropertyType(v: unknown): v is PropertyType {
  return typeof v === "string" && (PROPERTY_TYPES as readonly string[]).includes(v);
}

export function isRoofType(v: unknown): v is RoofType {
  return typeof v === "string" && (ROOF_TYPES as readonly string[]).includes(v);
}

export function isUF(v: unknown): v is (typeof UFS)[number] {
  return typeof v === "string" && (UFS as readonly string[]).includes(v);
}

export function calculateSimulation(input: SimulationInput, params: SolarParams): SimulationResult {
  const bill = Math.max(0, Number(input.billValue) || 0);
  const tariff = params.tariffKwh > 0 ? params.tariffKwh : 0.95;
  const generation = params.generationKwhPerKwp > 0 ? params.generationKwhPerKwp : 120;
  const panelW = params.panelPowerW > 0 ? params.panelPowerW : 550;
  const pricePerKwp = params.pricePerKwp > 0 ? params.pricePerKwp : 3500;

  const monthlyKwh = bill / tariff;
  const neededKwp = monthlyKwh / generation;
  const panelsCount = Math.max(1, Math.ceil((neededKwp * 1000) / panelW));
  const systemKwp = (panelsCount * panelW) / 1000;
  const monthlyGenerationKwh = systemKwp * generation;

  const monthlySavings = Math.min(bill, monthlyGenerationKwh * tariff) * ASSUMPTIONS.savingsRate;

  const roofFactor = ROOF_COST_FACTOR[input.roofType] ?? 1;
  const estimatedPrice = systemKwp * pricePerKwp * roofFactor;

  const installments = Math.max(1, Math.round(params.maxInstallments || 1));
  const installmentValue = pmt(estimatedPrice, params.monthlyInterestRate, installments);

  // Economia acumulada com reajuste da tarifa e degradação dos módulos
  let cumulative = 0;
  let paybackYears: number | null = null;
  let totalGenerationKwh = 0;

  for (let y = 0; y < ASSUMPTIONS.years; y++) {
    const degradation = Math.pow(1 - ASSUMPTIONS.degradationPerYear, y);
    const annualSavings =
      monthlySavings * 12 * Math.pow(1 + ASSUMPTIONS.tariffIncreasePerYear, y) * degradation;

    if (
      paybackYears === null &&
      estimatedPrice > 0 &&
      annualSavings > 0 &&
      cumulative + annualSavings >= estimatedPrice
    ) {
      paybackYears = y + (estimatedPrice - cumulative) / annualSavings;
    }

    cumulative += annualSavings;
    totalGenerationKwh += monthlyGenerationKwh * 12 * degradation;
  }

  const co2Tons25y = (totalGenerationKwh / 1000) * ASSUMPTIONS.co2TonsPerMWh;
  const treesEquivalent = Math.max(
    1,
    Math.round((co2Tons25y * 1000) / (ASSUMPTIONS.treeKgCo2PerYear * ASSUMPTIONS.years))
  );

  return {
    monthlyKwh,
    systemKwp,
    panelsCount,
    panelPowerW: panelW,
    monthlyGenerationKwh,
    monthlySavings,
    savings25y: cumulative,
    estimatedPrice,
    installments,
    installmentValue,
    paybackYears,
    co2Tons25y,
    treesEquivalent,
  };
}
