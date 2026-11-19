/* =============================================================================
 * ARQUIVO: app/api/ai/proposal/route.ts
 * -----------------------------------------------------------------------------
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 *
 *   solar-saas/
 *    ├── app/
 *    │    ├── api/
 *    │    │    ├── ai/
 *    │    │    │    ├── chat/
 *    │    │    │    │    └── route.ts   (NÃO é este! é o da pasta "chat")
 *    │    │    │    └── proposal/
 *    │    │    │         └── route.ts   <── ESTE ARQUIVO
 *    │    │    └── leads/
 *    │    └── ...
 *    ├── components/
 *    └── lib/
 *
 * COMO SUBSTITUIR (passo a passo):
 *   1. No VS Code, abra o painel EXPLORER (Ctrl+Shift+E).
 *   2. Abra a pasta "app", depois "api", depois "ai" e por fim "proposal".
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
import { askClaude } from "@/lib/ai";
import {
  buildProposalPrompt,
  fallbackProposalText,
  sanitizeProposalText,
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

    // Só vai para o PDF o texto comercial limpo. Se vier instrução, rótulos
    // ou trechos internos, usamos o template profissional.
    const safeText = aiText ? sanitizeProposalText(aiText, profile) : null;
    if (aiText && !safeText) {
      console.warn("[api/ai/proposal] texto da IA descartado (formato inválido ou conteúdo interno)");
    }

    if (safeText) {
      return NextResponse.json({ text: safeText, source: "ai" });
    }
  }

  return NextResponse.json({ text: fallbackProposalText(profile, context), source: "template" });
}