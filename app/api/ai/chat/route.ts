import { NextResponse } from "next/server";
import { askClaude, type ChatMessage } from "@/lib/ai";
import {
  buildChatSystemPrompt,
  fallbackChatAnswer,
  type SimulationContext,
} from "@/lib/ai-content";
import { fetchPublicProfile } from "@/lib/profiles";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { calculateSimulation, paramsFromProfile } from "@/lib/solar";
import { cleanText, parseSimulationPayload } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

function sanitizeHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];

  const messages: ChatMessage[] = [];
  for (const item of raw.slice(-12)) {
    if (!item || typeof item !== "object") continue;
    const { role, content } = item as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    const text = content.trim().slice(0, 1000);
    if (!text) continue;

    // A API exige alternância user/assistant: junta mensagens seguidas do mesmo papel
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content += `\n${text}`;
    else messages.push({ role, content: text });
  }

  // A conversa precisa começar com o usuário (remove a saudação inicial do bot)
  while (messages.length && messages[0].role !== "user") messages.shift();
  return messages;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!rateLimit(`chat:${ip}`, 30, 10 * 60_000)) {
    return NextResponse.json(
      { reply: "Você enviou muitas perguntas em sequência. Aguarde alguns minutos ou fale com a gente pelo WhatsApp.", source: "limit" },
      { status: 429 }
    );
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = cleanText(body?.slug, 60);
  const messages = sanitizeHistory(body?.messages);
  const lastMessage = messages[messages.length - 1];

  if (!slug || !lastMessage || lastMessage.role !== "user") {
    return NextResponse.json({ reply: "Não entendi a pergunta, pode repetir?", source: "error" }, { status: 400 });
  }

  const profile = await fetchPublicProfile(slug);
  if (!profile) {
    return NextResponse.json({ reply: "Empresa não encontrada.", source: "error" }, { status: 404 });
  }

  // Contexto opcional da simulação (recalculado no servidor)
  let context: SimulationContext | undefined;
  const simulation = parseSimulationPayload(body?.simulation);
  if (simulation) {
    context = {
      ...simulation,
      result: calculateSimulation(simulation, paramsFromProfile(profile)),
    };
  }

  const aiReply = await askClaude({
    system: buildChatSystemPrompt(profile, context),
    messages,
    maxTokens: 400,
    temperature: 0.4,
  });

  if (aiReply) {
    return NextResponse.json({ reply: aiReply, source: "ai" });
  }

  return NextResponse.json({
    reply: fallbackChatAnswer(lastMessage.content, profile),
    source: "fallback",
  });
}
