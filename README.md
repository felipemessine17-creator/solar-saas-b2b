# SolarSim — Micro-SaaS para Integradores de Energia Solar

Next.js 15 (App Router) + TypeScript + Tailwind + Supabase + Claude (Anthropic).

- `/login` — cadastro/login do empresário (cria o perfil e o slug automaticamente)
- `/dashboard` — **Minha Empresa & Preços** + **CRM & Leads** (quente / morno / frio, status, notas, WhatsApp)
- `/[slug]` — simulador público mobile-first em 3 passos, com chat de IA, proposta em PDF e botão de WhatsApp

---

## 1. Banco de dados (Supabase)

1. Crie um projeto em https://supabase.com
2. Abra **SQL Editor → New query**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
   - Cria `profiles`, `leads`, o trigger de criação automática de perfil, as políticas de RLS e o bucket público `logos`.
   - Pode rodar de novo sem problema (o script é idempotente).
3. Em **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000` (em produção, o domínio real)
   - **Redirect URLs:** adicione `http://localhost:3000/auth/callback` (e depois `https://seudominio.com/auth/callback`)
4. (Opcional, para testar mais rápido) **Authentication → Sign In / Providers → Email**: desligue **Confirm email**. Assim o cadastro já entra direto no painel.

## 2. Instalação

```bash
# 1) Criar o projeto Next.js 15 com Tailwind
npx create-next-app@15 solar-saas --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --turbopack
cd solar-saas

# 2) Instalar as dependências do projeto
npm install @supabase/ssr @supabase/supabase-js @anthropic-ai/sdk lucide-react
```

3) Copie **todas as pastas e arquivos deste pacote** para dentro de `solar-saas/`, substituindo quando perguntar
(`app/layout.tsx`, `app/page.tsx` e `app/globals.css` serão sobrescritos de propósito).

4) Crie o arquivo `.env.local` na raiz (modelo em `.env.local.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-ou-publishable
ANTHROPIC_API_KEY=sk-ant-...        # opcional
ANTHROPIC_MODEL=claude-haiku-4-5    # opcional
```

As chaves do Supabase ficam em **Project Settings → API Keys** (use a `anon` ou a nova `publishable`; **nunca** a `service_role`).

5) Rode:

```bash
npm run dev
```

Abra http://localhost:3000/login, crie a conta, configure a empresa no painel e abra seu link em `http://localhost:3000/seu-slug`.

## 3. Estrutura

```
supabase/schema.sql                  # Script completo do banco
middleware.ts                        # Renova sessão e protege /dashboard
lib/
  supabase/client.ts                 # Cliente do navegador
  supabase/server.ts                 # Cliente de servidor (cookies)
  supabase/middleware.ts             # Lógica do middleware
  supabase/public.ts                 # Cliente anônimo (página pública / leads)
  supabase/env.ts                    # Validação das variáveis de ambiente
  solar.ts                           # Motor de cálculo (kWp, placas, payback, CO2, parcela)
  ai.ts                              # SDK Anthropic com fallback automático
  ai-content.ts                      # Prompts + respostas/template de fallback
  format.ts, validation.ts, rate-limit.ts, profiles.ts, profiles-shared.ts, types.ts
app/
  page.tsx                           # Landing
  login/page.tsx                     # Entrar / Criar conta
  auth/callback/route.ts             # Confirmação de e-mail
  dashboard/page.tsx                 # Painel (protegido)
  [slug]/page.tsx                    # Simulador público
  api/leads/route.ts                 # Salva o lead (recalcula no servidor)
  api/ai/chat/route.ts               # Chatbot
  api/ai/proposal/route.ts           # Texto da proposta
components/
  dashboard/DashboardShell.tsx, CompanySettings.tsx, LeadsCRM.tsx
  public/Simulator.tsx, ChatWidget.tsx, ProposalPrint.tsx
```

## 4. Como funciona

**Cálculo** (`lib/solar.ts`): conta ÷ tarifa = consumo kWh → ÷ geração kWh/kWp = kWp necessário → arredonda para placas inteiras.
Preço = kWp × preço/kWp × ajuste de telhado (laje +6%, solo +10%, metálico −3%). Parcela pela Tabela Price com os juros e o prazo do painel.
Economia em 25 anos considera reajuste de tarifa de 6% a.a. e degradação de 0,5% a.a. Todas as premissas ficam em `ASSUMPTIONS`, fáceis de ajustar
(incluindo o fator de CO2 do grid brasileiro, que muda todo ano; confira o valor oficial mais recente do MCTI).

**Temperatura do lead** é uma coluna gerada no banco: ≥ R$ 800 🔥 quente · R$ 400–799 ☀️ morno · < R$ 400 ❄️ frio.

**IA**: as rotas `/api/ai/*` rodam só no servidor (a chave nunca vai para o navegador). Sem `ANTHROPIC_API_KEY`, ou se a API falhar,
o chat responde com base em palavras-chave + as regras/FAQ da empresa, e a proposta usa um template dinâmico por tipo de imóvel. O sistema nunca quebra.

**PDF**: o botão gera o texto, monta um layout de proposta que só aparece na impressão (`print:block`) e abre a janela de impressão.
O cliente escolhe **Salvar como PDF**.

**Segurança**: RLS garante que cada empresário só vê/edita os próprios leads; visitantes só conseguem *inserir* lead com status `novo`.
A rota de leads tem honeypot anti-bot e rate limit; os números salvos no CRM são recalculados no servidor.

## 5. Deploy (Vercel)

1. Suba o projeto para o GitHub e importe na Vercel.
2. Cadastre as mesmas variáveis do `.env.local` em **Settings → Environment Variables**.
3. No Supabase, troque **Site URL** pelo domínio e adicione `https://seudominio.com/auth/callback` nas Redirect URLs.

> O rate limit é em memória (por instância). Para produção com tráfego alto, troque por Upstash Redis.

## 6. Problemas comuns

| Sintoma | Solução |
| --- | --- |
| "Supabase não configurado" | Confira o `.env.local` e reinicie o `npm run dev`. |
| "Perfil não encontrado" no painel | Rode o `schema.sql` de novo (ele cria perfis para contas antigas). |
| Cadastro não entra no painel | A confirmação de e-mail está ligada: confirme pelo link ou desligue a opção no Supabase. |
| Upload de logo falha | Confirme que o bucket `logos` foi criado pelo script (Storage). Limite: 2 MB. |
| Chat responde sempre igual | Sem `ANTHROPIC_API_KEY` o fallback é usado. Coloque a chave e reinicie. |
| Usando Next.js 16 | `middleware.ts` ainda funciona, mas pode renomear para `proxy.ts` e a função para `proxy`. |
