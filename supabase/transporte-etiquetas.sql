-- Etiquetas nas categorias e "Metrô" vira "Transporte" (com a etiqueta "Transporte público").
-- Cole no SQL Editor do Supabase (com "Primary Database" selecionado) e clique em "Run".
-- Pode rodar mais de uma vez.
begin;

-- Coluna nova: etiqueta dentro da categoria (Namorada › Viagem, Transporte › Uber...)
alter table public.registros add column if not exists etiqueta text;

-- Lançamentos de Metrô passam para Transporte › Transporte público
update public.registros set etiqueta = 'Transporte público' where categoria = 'Metrô' and etiqueta is null;
update public.registros set categoria = 'Transporte' where categoria = 'Metrô';

-- Regras aprendidas, o que foi aprendido no extrato e contas fixas
update public.regras set categoria = 'Transporte' where categoria = 'Metrô';
update public.estabelecimentos set categoria = 'Transporte' where categoria = 'Metrô';
update public.contas_fixas set categoria = 'Transporte' where categoria = 'Metrô';

-- Limites: se havia limite nas duas, o do Transporte passa a ser a soma
insert into public.orcamentos (user_id, categoria, limite)
  select user_id, 'Transporte', limite from public.orcamentos where categoria = 'Metrô'
  on conflict (user_id, categoria) do update set limite = public.orcamentos.limite + excluded.limite;
delete from public.orcamentos where categoria = 'Metrô';

commit;
