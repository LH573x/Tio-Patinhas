-- Junta a categoria "Álcool" em "Rolê".
-- Cole no SQL Editor do Supabase e clique em "Run". Pode rodar mais de uma vez.
-- (As entradas novas "Caixa 2 VR", "Caixa 2" e "Poker" não precisam de nada no banco.)
begin;

-- Lançamentos
update public.registros set categoria = 'Rolê' where categoria = 'Álcool';

-- Regras aprendidas ("bar do zé" => Álcool) e o que foi aprendido no extrato
-- (estabelecimento e estabelecimento + valor)
update public.regras set categoria = 'Rolê' where categoria = 'Álcool';
update public.estabelecimentos set categoria = 'Rolê' where categoria = 'Álcool';

-- Contas fixas
update public.contas_fixas set categoria = 'Rolê' where categoria = 'Álcool';

-- Limites: se havia limite nas duas, o do Rolê passa a ser a soma
insert into public.orcamentos (user_id, categoria, limite)
  select user_id, 'Rolê', limite from public.orcamentos where categoria = 'Álcool'
  on conflict (user_id, categoria) do update set limite = public.orcamentos.limite + excluded.limite;
delete from public.orcamentos where categoria = 'Álcool';

commit;
