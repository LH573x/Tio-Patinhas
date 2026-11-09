-- Tio Patinhas: estrutura do banco de dados.
-- Cole tudo isto no SQL Editor do Supabase (com o banco "Primary Database"
-- selecionado, não "Logs") e clique em "Run".
-- É um único bloco e pode rodar quantas vezes quiser: só cria o que falta.
do $$
begin
  ---------------------------------------------------------------------------
  -- Registros: cada gasto ou entrada (uma parcela = um registro).
  ---------------------------------------------------------------------------
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
  -- Identificador da transação no extrato do banco, para não importar duas vezes.
  alter table public.registros add column if not exists ref_externa text;
  create unique index if not exists registros_ref_externa
    on public.registros (user_id, ref_externa) where ref_externa is not null;

  ---------------------------------------------------------------------------
  -- Regras aprendidas: "posto shell" => "Carro".
  ---------------------------------------------------------------------------
  create table if not exists public.regras (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    termo text not null,
    categoria text not null,
    criado_em timestamptz not null default now(),
    unique (user_id, termo)
  );

  ---------------------------------------------------------------------------
  -- Limite mensal de gastos por categoria.
  ---------------------------------------------------------------------------
  create table if not exists public.orcamentos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    categoria text not null,
    limite numeric(12, 2) not null check (limite >= 0),
    unique (user_id, categoria)
  );

  ---------------------------------------------------------------------------
  -- Metas de economia (ex.: "Viagem de férias", R$ 3.000 até dezembro).
  ---------------------------------------------------------------------------
  create table if not exists public.metas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    nome text not null,
    valor_alvo numeric(12, 2) not null check (valor_alvo > 0),
    valor_atual numeric(12, 2) not null default 0 check (valor_atual >= 0),
    prazo date,
    criado_em timestamptz not null default now()
  );

  ---------------------------------------------------------------------------
  -- Caixa de entrada: fotos de cupom e extratos em PDF/imagem que a rotina
  -- diária do Claude lê e transforma em registros.
  ---------------------------------------------------------------------------
  create table if not exists public.caixa_entrada (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    tipo text not null check (tipo in ('cupom', 'extrato')),
    caminho text not null,
    nome_arquivo text,
    observacao text,
    status text not null default 'pendente' check (status in ('pendente', 'processado', 'erro')),
    mensagem text,
    registros_criados integer not null default 0,
    criado_em timestamptz not null default now(),
    processado_em timestamptz
  );
  create index if not exists caixa_entrada_status on public.caixa_entrada (status, criado_em);

  ---------------------------------------------------------------------------
  -- Segurança: cada pessoa só vê e mexe nos próprios dados.
  ---------------------------------------------------------------------------
  alter table public.registros enable row level security;
  alter table public.regras enable row level security;
  alter table public.orcamentos enable row level security;
  alter table public.metas enable row level security;
  alter table public.caixa_entrada enable row level security;

  drop policy if exists "registros do dono" on public.registros;
  create policy "registros do dono" on public.registros for all to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

  drop policy if exists "regras do dono" on public.regras;
  create policy "regras do dono" on public.regras for all to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

  drop policy if exists "orcamentos do dono" on public.orcamentos;
  create policy "orcamentos do dono" on public.orcamentos for all to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

  drop policy if exists "metas do dono" on public.metas;
  create policy "metas do dono" on public.metas for all to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

  drop policy if exists "caixa do dono" on public.caixa_entrada;
  create policy "caixa do dono" on public.caixa_entrada for all to authenticated
    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

  ---------------------------------------------------------------------------
  -- Arquivos (fotos e PDFs): pasta privada "anexos", uma subpasta por pessoa.
  ---------------------------------------------------------------------------
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('anexos', 'anexos', false, 10485760,
          array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
  on conflict (id) do nothing;

  drop policy if exists "anexos: enviar" on storage.objects;
  create policy "anexos: enviar" on storage.objects for insert to authenticated
    with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text);

  drop policy if exists "anexos: ver" on storage.objects;
  create policy "anexos: ver" on storage.objects for select to authenticated
    using (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text);

  drop policy if exists "anexos: apagar" on storage.objects;
  create policy "anexos: apagar" on storage.objects for delete to authenticated
    using (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text);
end
$$;
