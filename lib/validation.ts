import { isPropertyType, isRoofType, isUF, type PropertyType, type RoofType } from "./solar";

export interface SimulationPayload {
  billValue: number;
  city: string;
  state: string;
  propertyType: PropertyType;
  roofType: RoofType;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Valida os dados da simulação vindos do navegador. Retorna null se inválido. */
export function parseSimulationPayload(raw: unknown): SimulationPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;

  const billValue = Number(data.billValue);
  if (!Number.isFinite(billValue) || billValue < 30 || billValue > 200000) return null;

  const propertyType = data.propertyType;
  const roofType = data.roofType;
  if (!isPropertyType(propertyType) || !isRoofType(roofType)) return null;

  const state = cleanText(data.state, 2).toUpperCase();

  return {
    billValue: Math.round(billValue * 100) / 100,
    city: cleanText(data.city, 80),
    state: isUF(state) ? state : "",
    propertyType,
    roofType,
  };
}

export { cleanText };
