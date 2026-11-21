-- ==========================================================================
-- ARQUIVO 1 de 17: supabase/billing.sql   [ARQUIVO NOVO]
-- Recurso: teste grátis de 7 dias + bloqueio + Mercado Pago
--
-- ONDE FICA NO SEU PROJETO (painel EXPLORER do VS Code, à esquerda):
-- solar-saas/   (pasta raiz do projeto)
--    └── supabase/
--         └── billing.sql   <── ESTE ARQUIVO (NOVO)
--
-- ATENÇÃO: Este é um script SQL: além de salvar, RODE no Supabase (passo a passo abaixo).
--
-- PASSO A PASSO:
--   1. No VS Code: clique com o botão direito na pasta "supabase" > New File >
--   2. digite billing.sql > cole todo este conteúdo > Ctrl+S.
--   3. DEPOIS, no navegador: Supabase > SQL Editor > New query >
--   4. cole todo este conteúdo > clique em Run. (Pode rodar mais de uma vez.)
--
-- PARA NÃO QUEBRAR O PROJETO:
--   - Instale os 17 arquivos JUNTOS (eles dependem um do outro):
--    1. supabase/billing.sql  (NOVO)
--    2. .env.local.example
--    3. lib/types.ts
--    4. lib/subscription.ts  (NOVO)
--    5. lib/mercadopago.ts  (NOVO)
--    6. lib/supabase/admin.ts  (NOVO)
--    7. app/api/checkout/route.ts  (NOVO)
--    8. app/api/webhooks/mercadopago/route.ts  (NOVO)
--    9. app/api/leads/route.ts
--   10. app/api/ai/chat/route.ts
--   11. app/api/ai/proposal/route.ts
--   12. app/dashboard/page.tsx
--   13. app/dashboard/assinatura/page.tsx  (NOVO)
--   14. app/[slug]/page.tsx
--   15. components/billing/PricingPlans.tsx  (NOVO)
--   16. components/billing/SubscriptionExpired.tsx  (NOVO)
--   17. components/dashboard/DashboardShell.tsx
--   - Não use arquivos com nome trocado pelo navegador, como "route (1).ts":
--     copie o conteúdo e cole no arquivo com o nome certo.
--   - No fim, pare o servidor (Ctrl+C no terminal) e rode: npm run dev
-- ==========================================================================

-- =====================================================================
--  SOLARSIM — Assinaturas (teste grátis de 7 dias + Mercado Pago)
--  Cole no SQL Editor do Supabase e clique em Run.
--  Pode rodar mais de uma vez (não apaga nada).
-- =====================================================================

-- 1) Colunas de assinatura (as que você já criou são mantidas)
alter table public.profiles add column if not exists subscription_status  text;
alter table public.profiles add column if not exists trial_ends_at        timestamptz;
alter table public.profiles add column if not exists subscription_ends_at timestamptz;
alter table public.profiles add column if not exists plan_type            text;
alter table public.profiles add column if not exists mp_last_payment_id   text;

-- 2) Padrões: todo novo cadastro começa em teste grátis de 7 dias
alter table public.profiles alter column subscription_status set default 'trial';
alter table public.profiles alter column trial_ends_at set default (now() + interval '7 days');

-- 3) Contas antigas sem dados de assinatura ganham 7 dias a partir de agora
update public.profiles
   set subscription_status = coalesce(subscription_status, 'trial'),
       trial_ends_at       = coalesce(trial_ends_at, now() + interval '7 days')
 where subscription_status is null or trial_ends_at is null;

alter table public.profiles alter column subscription_status set not null;

-- 4) Valores permitidos
alter table public.profiles drop constraint if exists profiles_subscription_status_values;
alter table public.profiles add constraint profiles_subscription_status_values
  check (subscription_status in ('trial', 'active', 'expired', 'canceled'));

alter table public.profiles drop constraint if exists profiles_plan_type_values;
alter table public.profiles add constraint profiles_plan_type_values
  check (plan_type is null or plan_type in ('mensal', 'anual'));

-- 5) SEGURANÇA: o empresário NÃO pode se "auto-ativar" pelo navegador.
--    Só o servidor (webhook com service_role) ou você no SQL Editor
--    podem alterar as colunas de assinatura.
create or replace function public.protect_billing_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.subscription_status  := old.subscription_status;
    new.trial_ends_at        := old.trial_ends_at;
    new.subscription_ends_at := old.subscription_ends_at;
    new.plan_type            := old.plan_type;
    new.mp_last_payment_id   := old.mp_last_payment_id;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_billing on public.profiles;
create trigger profiles_protect_billing
  before update on public.profiles
  for each row execute function public.protect_billing_columns();

-- 6) Ativação via webhook (chamada pelo servidor com a service_role).
--    Soma o período ao vencimento atual se a assinatura ainda estiver ativa
--    e ignora o mesmo pagamento recebido duas vezes.
create or replace function public.activate_subscription(
  p_user_id    uuid,
  p_plan       text,
  p_payment_id text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_base    timestamptz;
  v_ends    timestamptz;
begin
  if p_plan not in ('mensal', 'anual') then
    raise exception 'Plano inválido: %', p_plan;
  end if;

  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Perfil não encontrado: %', p_user_id;
  end if;

  -- Mesmo pagamento já processado: não soma de novo
  if v_profile.mp_last_payment_id = p_payment_id then
    return v_profile.subscription_ends_at;
  end if;

  v_base := now();
  if v_profile.subscription_status = 'active'
     and v_profile.subscription_ends_at is not null
     and v_profile.subscription_ends_at > now() then
    v_base := v_profile.subscription_ends_at;
  end if;

  v_ends := v_base + case when p_plan = 'anual' then interval '365 days' else interval '30 days' end;

  update public.profiles
     set subscription_status  = 'active',
         plan_type            = p_plan,
         subscription_ends_at = v_ends,
         mp_last_payment_id   = p_payment_id
   where id = p_user_id;

  return v_ends;
end;
$$;

-- Só o servidor (service_role) pode chamar a ativação
revoke all on function public.activate_subscription(uuid, text, text) from public, anon, authenticated;
grant execute on function public.activate_subscription(uuid, text, text) to service_role;

-- =====================================================================
-- ATIVAÇÃO MANUAL (quando o cliente pagar por Pix/WhatsApp, por exemplo)
-- Troque o e-mail e rode só o bloco abaixo:
--
--   update public.profiles
--      set subscription_status  = 'active',
--          plan_type            = 'mensal',          -- ou 'anual'
--          subscription_ends_at = now() + interval '30 days'   -- ou '365 days'
--    where id = (select id from auth.users where email = 'cliente@email.com');
--
-- Para dar mais dias de teste:
--   update public.profiles set subscription_status = 'trial',
--          trial_ends_at = now() + interval '7 days'
--    where id = (select id from auth.users where email = 'cliente@email.com');
-- =====================================================================