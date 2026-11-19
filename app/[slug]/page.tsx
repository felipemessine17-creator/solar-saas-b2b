/* =============================================================================
 * ARQUIVO: app/[slug]/page.tsx
 * -----------------------------------------------------------------------------
 * ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
 *
 *   solar-saas/
 *    ├── app/
 *    │    ├── [slug]/              <── pasta com COLCHETES no nome
 *    │    │    ├── not-found.tsx
 *    │    │    └── page.tsx        <── ESTE ARQUIVO
 *    │    ├── dashboard/
 *    │    │    └── page.tsx        (NÃO é este!)
 *    │    ├── login/
 *    │    │    └── page.tsx        (NÃO é este!)
 *    │    ├── page.tsx             (NÃO é este! é o da raiz de "app")
 *    │    └── ...
 *    ├── components/
 *    └── lib/
 *
 * COMO SUBSTITUIR (passo a passo):
 *   1. No VS Code, abra o painel EXPLORER (Ctrl+Shift+E).
 *   2. Abra a pasta "app" e depois a pasta "[slug]" (o nome tem colchetes mesmo).
 *   3. Dê dois cliques no arquivo "page.tsx" para abri-lo.
 *   4. Clique dentro do arquivo e aperte Ctrl+A (seleciona tudo).
 *   5. Aperte Delete para apagar todo o conteúdo antigo.
 *   6. Copie TODO o conteúdo deste arquivo novo (inclusive este comentário)
 *      e cole lá com Ctrl+V.
 *   7. Salve com Ctrl+S.
 *
 * IMPORTANTE (para não quebrar o projeto):
 *   - NÃO crie um arquivo novo e NÃO arraste o arquivo baixado para outra pasta.
 *     Só substitua o conteúdo do arquivo que já existe, no caminho acima.
 *   - Se o navegador baixou com outro nome (ex.: "page (1).tsx"),
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

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Simulator from "@/components/public/Simulator";
import { getPublicProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) return { title: "Simulador não encontrado" };

  const title = `Simule sua economia com energia solar | ${profile.company_name}`;
  const description = `Descubra em 1 minuto quanto você pode economizar na conta de luz com a ${profile.company_name}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: profile.logo_url ? [{ url: profile.logo_url }] : undefined,
    },
  };
}

export default async function PublicSimulatorPage({ params }: PageProps) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();

  // As regras/FAQ são material interno da IA: ficam só no servidor
  // (rotas /api/ai/*) e nunca são enviadas ao navegador do cliente.
  return <Simulator profile={{ ...profile, faq_rules: "" }} />;
}