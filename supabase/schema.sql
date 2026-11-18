-- =====================================================================
--  SOLAR SAAS — Script completo do banco (cole no SQL Editor do Supabase)
--  Cria: profiles, leads, triggers, RLS, bucket de logos e políticas.
--  Pode ser executado mais de uma vez (idempotente).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Função utilitária: slugify (sem depender da extensão unaccent)
-- ---------------------------------------------------------------------
create or replace function public.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(value, ''),
      'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
      'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN')),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- ---------------------------------------------------------------------
-- 2) Função utilitária: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 3) Tabela PROFILES (uma por empresário / integrador)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                      uuid primary key references auth.users (id) on delete cascade,
  slug                    text not null unique,
  company_name            text not null default 'Minha Empresa Solar',
  consultant_name         text not null default '',
  whatsapp                text not null default '',
  primary_color           text not null default '#F59E0B',
  logo_url                text,
  panel_power_w           integer not null default 550,
  generation_kwh_per_kwp  numeric(6,2) not null default 120,
  price_per_kwp           numeric(10,2) not null default 3500,
  tariff_kwh              numeric(6,3) not null default 0.95,
  monthly_interest_rate   numeric(5,2) not null default 1.49,
  max_installments        integer not null default 84,
  faq_rules               text not null default '',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint profiles_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 50
  ),
  constraint profiles_slug_reserved check (
    slug not in ('login','dashboard','api','auth','admin','app','www','static','public','_next','favicon-ico')
  ),
  constraint profiles_color_format check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint profiles_panel_power check (panel_power_w between 100 and 1000),
  constraint profiles_generation check (generation_kwh_per_kwp between 50 and 250),
  constraint profiles_price check (price_per_kwp between 500 and 50000),
  constraint profiles_tariff check (tariff_kwh between 0.1 and 5),
  constraint profiles_interest check (monthly_interest_rate between 0 and 10),
  constraint profiles_installments check (max_installments between 1 and 240),
  constraint profiles_faq_size check (char_length(faq_rules) <= 8000)
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4) Tabela LEADS (clientes que simularam no link público)
-- ---------------------------------------------------------------------
create table if not exists public.leads (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.profiles (id) on delete cascade,
  name               text not null,
  whatsapp           text not null,
  bill_value         numeric(10,2) not null,
  city               text not null default '',
  state              text not null default '',
  property_type      text not null default 'Residencial',
  roof_type          text not null default 'Cerâmico',
  system_kwp         numeric(8,2),
  panels_count       integer,
  monthly_savings    numeric(10,2),
  estimated_price    numeric(12,2),
  installments       integer,
  installment_value  numeric(10,2),
  temperature        text generated always as (
                       case
                         when bill_value >= 800 then 'quente'
                         when bill_value >= 400 then 'morno'
                         else 'frio'
                       end
                     ) stored,
  status             text not null default 'novo',
  notes              jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint leads_name_len check (char_length(name) between 2 and 120),
  constraint leads_whatsapp_len check (char_length(whatsapp) between 10 and 20),
  constraint leads_bill_range check (bill_value between 30 and 200000),
  constraint leads_city_len check (char_length(city) <= 80),
  constraint leads_state_format check (state = '' or state ~ '^[A-Z]{2}$'),
  constraint leads_status_values check (
    status in ('novo','em_contato','visita_agendada','fechado','perdido')
  ),
  constraint leads_notes_array check (jsonb_typeof(notes) = 'array')
);

create index if not exists leads_profile_created_idx
  on public.leads (profile_id, created_at desc);

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5) Trigger: cria o perfil automaticamente no cadastro (auth.users)
--    Usa raw_user_meta_data.company_name / consultant_name enviados no signUp
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company    text;
  v_consultant text;
  v_base       text;
  v_slug       text;
begin
  v_company    := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');
  v_consultant := trim(coalesce(new.raw_user_meta_data ->> 'consultant_name', ''));

  v_base := public.slugify(coalesce(v_company, split_part(coalesce(new.email, ''), '@', 1)));
  v_base := trim(both '-' from left(v_base, 40));

  if v_base is null or char_length(v_base) < 3 then
    v_base := 'solar-' || coalesce(nullif(v_base, ''), substr(md5(new.id::text), 1, 4));
  end if;

  if v_base in ('login','dashboard','api','auth','admin','app','www','static','public','_next','favicon-ico') then
    v_base := v_base || '-solar';
  end if;

  v_slug := v_base;
  while exists (select 1 from public.profiles p where p.slug = v_slug) loop
    v_slug := v_base || '-' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, slug, company_name, consultant_name)
  values (new.id, v_slug, coalesce(v_company, 'Minha Empresa Solar'), v_consultant)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: cria perfil para usuários que já existiam antes deste script
insert into public.profiles (id, slug, company_name)
select u.id,
       'empresa-' || substr(replace(u.id::text, '-', ''), 1, 8),
       'Minha Empresa Solar'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 6) Permissões (grants) + Row Level Security
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;
grant insert on public.leads to anon, authenticated;
grant select, update, delete on public.leads to authenticated;

alter table public.profiles enable row level security;
alter table public.leads    enable row level security;

-- PROFILES -------------------------------------------------------------
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "profiles_owner_update" on public.profiles;
create policy "profiles_owner_update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- LEADS ----------------------------------------------------------------
drop policy if exists "leads_public_insert" on public.leads;
create policy "leads_public_insert"
  on public.leads for insert
  to anon, authenticated
  with check (
    status = 'novo'
    and notes = '[]'::jsonb
    and exists (select 1 from public.profiles p where p.id = profile_id)
  );

drop policy if exists "leads_owner_select" on public.leads;
create policy "leads_owner_select"
  on public.leads for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "leads_owner_update" on public.leads;
create policy "leads_owner_update"
  on public.leads for update
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

drop policy if exists "leads_owner_delete" on public.leads;
create policy "leads_owner_delete"
  on public.leads for delete
  to authenticated
  using ((select auth.uid()) = profile_id);

-- ---------------------------------------------------------------------
-- 7) Storage: bucket público "logos" (upload simples da logo)
--    Cada empresário só grava dentro da pasta com o próprio user id.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152,
        array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do nothing;

drop policy if exists "logos_public_read" on storage.objects;
create policy "logos_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'logos');

drop policy if exists "logos_owner_insert" on storage.objects;
create policy "logos_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "logos_owner_update" on storage.objects;
create policy "logos_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "logos_owner_delete" on storage.objects;
create policy "logos_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Pronto! Crie uma conta em /login e o perfil será gerado automaticamente.
