/* ==========================================================================
 * ARQUIVO 10 de 17: app/api/ai/chat/route.ts   [ARQUIVO ALTERADO (substituir)]
 * Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
 *
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 * solar-saas/   (pasta raiz do projeto)
 *    └── app/
 *         └── api/
 *              └── ai/
 *                   └── chat/
 *                        └── route.ts   <── ESTE ARQUIVO
 *
 * ATENÇÃO: Existem vários arquivos route.ts no projeto: este é o da pasta "ai/chat".
 *
 * PASSO A PASSO:
 *   1. No painel EXPLORER (Ctrl+Shift+E), abra a pasta "app/api/ai/chat" e dê dois cliques em route.ts.
 *   2. Clique dentro do arquivo, aperte Ctrl+A e depois Delete (apaga o conteúdo antigo).
 *   3. Cole TODO o conteúdo deste arquivo (inclusive este comentário) > Ctrl+S.
 *
 * PARA NÃO QUEBRAR O PROJETO:
 *   - Instale os 17 arquivos JUNTOS (eles dependem um do outro):
 *    1. supabase/billing.sql  (NOVO)
 *    2. .env.local.example
 *    3. lib/types.ts
 *    4. lib/subscription.ts  (NOVO)
 *    5. lib/mercadopago.ts  (NOVO)
 *    6. lib/supabase/admin.ts  (NOVO)
 *    7. app/api/checkout/route.ts  (NOVO)
 *    8. app/api/webhooks/mercadopago/route.ts  (NOVO)
 *    9. app/api/leads/route.ts
 *   10. app/api/ai/chat/route.ts
 *   11. app/api/ai/proposal/route.ts
 *   12. app/dashboard/page.tsx
 *   13. app/dashboard/assinatura/page.tsx  (NOVO)
 *   14. app/[slug]/page.tsx
 *   15. components/billing/PricingPlans.tsx  (NOVO)
 *   16. components/billing/SubscriptionExpired.tsx  (NOVO)
 *   17. components/dashboard/DashboardShell.tsx
 *   - Não use arquivos com nome trocado pelo navegador, como "route (1).ts":
 *     copie o conteúdo e cole no arquivo com o nome certo.
 *   - No fim, pare o servidor (Ctrl+C no terminal) e rode: npm run dev
 * ========================================================================== */

import { NextResponse } from "next/server";
import { askClaude, type ChatMessage } from "@/lib/ai";
import {
  buildChatSystemPrompt,
  fallbackChatAnswer,
  sanitizeChatReply,
  type SimulationContext,
} from "@/lib/ai-content";
import { fetchPublicProfile } from "@/lib/profiles";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { calculateSimulation, paramsFromProfile } from "@/lib/solar";
import { isProfileActive } from "@/lib/subscription";
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

  // Conta com teste/assinatura vencida: não gasta IA
  if (!isProfileActive(profile)) {
    return NextResponse.json(
      { reply: "Este atendimento está temporariamente indisponível. Entre em contato diretamente com a empresa.", source: "inactive" },
      { status: 403 }
    );
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

  // Filtro de saída: se a IA citar/copiar o material interno do empresário,
  // a resposta é descartada e o cliente recebe a resposta segura (fallback).
  const safeReply = aiReply ? sanitizeChatReply(aiReply, profile) : null;
  if (aiReply && !safeReply) {
    console.warn("[api/ai/chat] resposta da IA bloqueada por possível vazamento de conteúdo interno");
  }

  if (safeReply) {
    return NextResponse.json({ reply: safeReply, source: "ai" });
  }

  return NextResponse.json({
    reply: fallbackChatAnswer(lastMessage.content, profile),
    source: "fallback",
  });
}