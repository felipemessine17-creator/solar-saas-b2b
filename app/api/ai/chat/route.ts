/* =============================================================================
 * ARQUIVO: app/api/ai/chat/route.ts
 * -----------------------------------------------------------------------------
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 *
 *   solar-saas/
 *    ├── app/
 *    │    ├── api/
 *    │    │    ├── ai/
 *    │    │    │    ├── chat/
 *    │    │    │    │    └── route.ts   <── ESTE ARQUIVO
 *    │    │    │    └── proposal/
 *    │    │    │         └── route.ts   (NÃO é este! é o da pasta "proposal")
 *    │    │    └── leads/
 *    │    └── ...
 *    ├── components/
 *    └── lib/
 *
 * COMO SUBSTITUIR (passo a passo):
 *   1. No VS Code, abra o painel EXPLORER (Ctrl+Shift+E).
 *   2. Abra a pasta "app", depois "api", depois "ai" e por fim "chat".
 *   3. Dê dois cliques no arquivo "route.ts" para abri-lo.
 *   4. Clique dentro do arquivo e aperte Ctrl+A (seleciona tudo).
 *   5. Aperte Delete para apagar todo o conteúdo antigo.
 *   6. Copie TODO o conteúdo deste arquivo novo (inclusive este comentário)
 *      e cole lá com Ctrl+V.
 *   7. Salve com Ctrl+S.
 *
 * IMPORTANTE (para não quebrar o projeto):
 *   - NÃO crie um arquivo novo e NÃO arraste o arquivo baixado para outra pasta.
 *     Só substitua o conteúdo do arquivo que já existe, no caminho acima.
 *   - Se o navegador baixou com outro nome (ex.: "route (1).ts"),
 *     não use esse arquivo direto: abra, copie o conteúdo e cole no arquivo
 *     original, seguindo os passos acima.
 *   - Substitua os 5 arquivos da correção JUNTOS. Eles dependem um do outro:
 *       lib/ai-content.ts
 *       app/api/ai/chat/route.ts
 *       app/api/ai/proposal/route.ts
 *       components/public/ProposalPrint.tsx
 *       app/[slug]/page.tsx
 *   - Depois de trocar todos, pare o servidor (Ctrl+C no terminal) e rode
 *     de novo: npm run dev
 * ============================================================================= */

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