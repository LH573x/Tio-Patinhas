-- Etiquetas de Transporte (Uber / Transporte público) que não foram gravadas enquanto o banco
-- não tinha a coluna "etiqueta": preenche pelas palavras do item, como o app faz.
-- Só mexe em gastos de Transporte que estão sem etiqueta. Pode rodar mais de uma vez.
-- Rode depois do schema.sql.
update public.registros set etiqueta = 'Uber'
 where categoria = 'Transporte' and etiqueta is null
   and coalesce(item, '') || ' ' || coalesce(texto_original, '') ~* '\m(uber|t[aá]xi|99 ?pop|99 ?t[aá]xi|cabify|indrive|corrida)\M';
update public.registros set etiqueta = 'Transporte público'
 where categoria = 'Transporte' and etiqueta is null
   and coalesce(item, '') || ' ' || coalesce(texto_original, '') ~* '\m(metr[oô]|cptm|trem|[oô]nibus|bilhete [uú]nico|recarga do bilhete|cart[aã]o top|sptrans|brt|vlt)\M';
