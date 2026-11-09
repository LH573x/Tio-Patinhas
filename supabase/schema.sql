-- Tio Patinhas: estrutura do banco de dados.
-- Cole tudo isto no SQL Editor do Supabase e clique em "Run".
-- Pode rodar mais de uma vez sem problema.

-- Registros: cada gasto ou entrada (uma parcela = um registro).
create table if not exists public.registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('gasto', 'entrada')),
  item text not null,
  valor numeric(12, 2) not null check (valor >= 0),
  metodo text,
  categoria text not null,
  data date not null,
  parcela text,
  origem text not null default 'texto',
  texto_original text,
  criado_em timestamptz not null default now()
);

create index if not exists registros_user_data on public.registros (user_id, data desc);

-- Regras aprendidas: "posto shell" => "Carro".
create table if not exists public.regras (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  termo text not null,
  categoria text not null,
  criado_em timestamptz not null default now(),
  unique (user_id, termo)
);

-- Segurança: cada pessoa só vê e mexe nos próprios dados.
alter table public.registros enable row level security;
alter table public.regras enable row level security;

drop policy if exists "registros do dono" on public.registros;
create policy "registros do dono" on public.registros
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "regras do dono" on public.regras;
create policy "regras do dono" on public.regras
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
