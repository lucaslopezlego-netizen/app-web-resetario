-- Eco Menú — Esquema de Supabase
-- Ejecuta este archivo una vez en Supabase → SQL Editor → New query → Run.
-- Crea las tablas de preferencias y menús guardados, con seguridad por filas:
-- cada persona solo puede ver y cambiar sus propios datos.

-- Preferencias del asistente (presupuesto, días, comidas, gustos, alergias) y menú abierto
create table if not exists public.preferencias (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  datos       jsonb not null default '{}'::jsonb,
  menu_actual text,
  actualizado timestamptz not null default now()
);

-- Menús generados ("Mis menús")
create table if not exists public.menus (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id          text not null,
  datos       jsonb not null,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists menus_user_creado_idx on public.menus (user_id, creado desc);

alter table public.preferencias enable row level security;
alter table public.menus enable row level security;

drop policy if exists "preferencias_propias" on public.preferencias;
create policy "preferencias_propias" on public.preferencias
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "menus_propios" on public.menus;
create policy "menus_propios" on public.menus
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
