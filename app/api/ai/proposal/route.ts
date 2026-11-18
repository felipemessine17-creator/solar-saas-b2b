import { NextResponse } from "next/server";
import { askClaude } from "@/lib/ai";
import {
  buildProposalPrompt,
  fallbackProposalText,
  type SimulationContext,
} from "@/lib/ai-content";
import { fetchPublicProfile } from "@/lib/profiles";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { calculateSimulation, paramsFromProfile } from "@/lib/solar";
import { cleanText, parseSimulationPayload } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = cleanText(body?.slug, 60);
  const clientName = cleanText(body?.clientName, 120);
  const simulation = parseSimulationPayload(body);

  if (!slug || !simulation) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const profile = await fetchPublicProfile(slug);
  if (!profile) {
    return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
  }

  const context: SimulationContext = {
    ...simulation,
    clientName,
    result: calculateSimulation(simulation, paramsFromProfile(profile)),
  };

  const ip = getClientIp(request);
  const allowedAI = rateLimit(`proposal:${ip}`, 8, 10 * 60_000);

  if (allowedAI) {
    const { system, user } = buildProposalPrompt(profile, context);
    const aiText = await askClaude({
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 450,
      temperature: 0.7,
    });

    if (aiText) {
      return NextResponse.json({ text: aiText, source: "ai" });
    }
  }

  return NextResponse.json({ text: fallbackProposalText(profile, context), source: "template" });
}
