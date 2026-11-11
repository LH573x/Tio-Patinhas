-- Confere se o banco está em dia com o app. Só lê, não muda nada.
-- Cole no SQL Editor do Supabase (com "Primary Database" selecionado) e clique em "Run".
-- Cada linha que aparecer é algo que falta. Nenhuma linha = está tudo em dia.
with esperado (tabela, coluna) as (values
  ('registros', 'ref_externa'), ('registros', 'local'), ('registros', 'hora'),
  ('registros', 'cartao_id'), ('registros', 'estabelecimento'), ('registros', 'etiqueta'),
  ('regras', 'termo'), ('orcamentos', 'limite'), ('metas', 'valor_alvo'), ('caixa_entrada', 'caminho'),
  ('contas_fixas', 'dia_vencimento'), ('cartoes', 'dia_fechamento'),
  ('estabelecimentos', 'chave'), ('estabelecimentos', 'apelido')
)
select e.tabela, e.coluna as o_que_falta, 'rode o schema.sql' as como_resolver
  from esperado e
 where not exists (select 1 from information_schema.columns c
                    where c.table_schema = 'public' and c.table_name = e.tabela and c.column_name = e.coluna)
union all
select 'estabelecimentos', 'poder deixar "' || column_name || '" vazio', 'rode o schema.sql'
  from information_schema.columns
 where table_schema = 'public' and table_name = 'estabelecimentos' and column_name in ('item', 'categoria') and is_nullable = 'NO'
union all
select 'storage', 'pasta de arquivos "anexos"', 'rode o schema.sql'
 where not exists (select 1 from storage.buckets where id = 'anexos')
union all
select 'registros', count(*) || ' lançamentos ainda em "' || categoria || '"',
       case categoria when 'Álcool' then 'rode o juntar-alcool-role.sql' else 'rode o transporte-etiquetas.sql' end
  from public.registros where categoria in ('Álcool', 'Metrô') group by categoria;
