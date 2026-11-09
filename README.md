# Tio Patinhas

Meu assessor de gastos pessoais: um app instalável no celular (PWA) para registrar gastos e entradas de forma rápida.

## Como usar

Escreva (ou dite pelo microfone do teclado) frases como:

- `salgado 8,50 pix`
- `gasolina 200 crédito`
- `mercado 312,47 débito`
- `tênis 600 em 3x` (vira 3 parcelas mensais)
- `recebi salário 3500`
- `pizza 60 pix ontem`

O app identifica item, valor, forma de pagamento e categoria. Se você corrigir uma categoria, ele aprende para a próxima vez.

Telas:

- **Início**: resumo do mês, registro rápido, foto do cupom, extrato, revisar ontem e hoje.
- **Lançamentos**: todos os registros do mês por dia, com busca, filtro por categoria e importação de extrato.
- **Painel**: para onde foi o dinheiro, comparação com o mês anterior, gastos dos últimos 6 meses, dicas de economia, semana passada e parcelas futuras.
- **Metas**: limite por categoria e metas de economia.

Aparência: Claro, Escuro ou Automático (toque no seu avatar, no canto de cima).

## Extratos e cupons

- **CSV e OFX** (Nubank, Inter, Itaú e outros): lidos na hora, no próprio celular. Você revisa antes de importar e nada é importado duas vezes.
- **Foto de cupom, PDF ou print**: vão para a caixa de entrada e a rotina diária do Claude lê de madrugada (veja `ROTINA.md`).

## Categorias

Refeições, Alimentação geral, Carro, Namorada, Viagens, Outros. Entradas: Salário, Outras entradas.

## Estado atual

Os dados ficam no Supabase, com login. Cada pessoa só vê os próprios registros (veja `supabase/schema.sql`). Ao atualizar o app, rode de novo o `schema.sql` no SQL Editor do Supabase (com “Primary Database” selecionado): ele é seguro para rodar várias vezes.

## Desenvolvimento

Sem build: HTML, CSS e JavaScript puros.

```bash
python3 -m http.server 8000   # abre em http://localhost:8000
npm test                      # testes (frases, extratos e análises)
```
