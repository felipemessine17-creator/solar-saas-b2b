import { NextResponse } from "next/server";
import { fetchPublicProfile } from "@/lib/profiles";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { calculateSimulation, paramsFromProfile } from "@/lib/solar";
import { createPublicClient } from "@/lib/supabase/public";
import { cleanText, parseSimulationPayload } from "@/lib/validation";
import { onlyDigits } from "@/lib/format";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`leads:${ip}`, 10, 10 * 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Muitas simulações em sequência. Tente novamente em alguns minutos." },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  // Honeypot anti-bot: campo invisível que humanos não preenchem
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const slug = cleanText(body.slug, 60);
  const name = cleanText(body.name, 120);
  const whatsapp = onlyDigits(typeof body.whatsapp === "string" ? body.whatsapp : "");
  const simulation = parseSimulationPayload(body);

  if (!slug || name.length < 2 || whatsapp.length < 10 || whatsapp.length > 13 || !simulation) {
    return NextResponse.json({ ok: false, error: "Dados inválidos." }, { status: 400 });
  }

  const profile = await fetchPublicProfile(slug);
  if (!profile) {
    return NextResponse.json({ ok: false, error: "Empresa não encontrada." }, { status: 404 });
  }

  // Recalcula no servidor: o CRM guarda números confiáveis, não os do navegador
  const result = calculateSimulation(simulation, paramsFromProfile(profile));

  const supabase = createPublicClient();
  const { error } = await supabase.from("leads").insert({
    profile_id: profile.id,
    name,
    whatsapp,
    bill_value: simulation.billValue,
    city: simulation.city,
    state: simulation.state,
    property_type: simulation.propertyType,
    roof_type: simulation.roofType,
    system_kwp: Math.round(result.systemKwp * 100) / 100,
    panels_count: result.panelsCount,
    monthly_savings: Math.round(result.monthlySavings * 100) / 100,
    estimated_price: Math.round(result.estimatedPrice * 100) / 100,
    installments: result.installments,
    installment_value: Math.round(result.installmentValue * 100) / 100,
  });

  if (error) {
    console.error("[api/leads] erro ao salvar lead:", error.message);
    return NextResponse.json({ ok: false, error: "Não foi possível salvar agora." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
