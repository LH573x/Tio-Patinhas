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
- `mercado 200 nubank` (gasto no crédito, na fatura do cartão Nubank)

O app identifica item, valor, forma de pagamento e categoria. Se você corrigir uma categoria, ele aprende para a próxima vez.

Telas:

- **Início**: resumo do mês, card “Seu dia” (contas e faturas vencendo, limites perto de estourar, quanto dá pra gastar por dia), registro rápido, foto do cupom, extrato, revisar ontem e hoje. Ao registrar um gasto que passa de 80% ou 100% do limite, o aviso de confirmação já diz.
- **Lançamentos**: todos os registros do mês por dia, com busca, filtro por categoria e importação de extrato.
- **Painel**: faturas de cada cartão (valor, vencimento e limite usado), para onde foi o dinheiro, comparação com o mês anterior, gastos dos últimos 6 meses, dicas de economia, semana passada e parcelas futuras.
- **Metas**: contas fixas (com botão “Paguei”), cartões de crédito, limite por categoria e metas de economia.

**Tio Patinhas, o assessor**: o mascote do app (um pato idoso e econômico, de cartola e óculos redondos) aparece de vez em quando no Início com um conselho: um alerta de limite, uma dica de economia com os seus números, um elogio quando você gasta menos que no mês passado ou, em alguns dias, um ditado de quem sabe guardar dinheiro. Depois do “Valeu, tio” ele só volta no dia seguinte (ou antes, se surgir um alerta novo) e não repete o mesmo conselho por alguns dias. O desenho é original, feito em SVG (`js/mascote.js`); os ícones saem dele com `node scripts/icones.mjs`.

A previsão do mês soma o ritmo dos gastos do dia a dia com as contas fixas e parcelas pelo valor certo.

Aparência: Claro, Escuro ou Automático (toque no seu avatar, no canto de cima).

## Extratos e cupons

- **CSV e OFX** (Nubank, Inter, Itaú e outros): lidos na hora, no próprio celular. Você revisa antes de importar e nada é importado duas vezes.
- **Foto de cupom, PDF ou print**: vão para a caixa de entrada e a rotina diária do Claude lê de madrugada (veja `ROTINA.md`).

## Categorias

Refeições, Alimentação geral, Carro, Namorada, Viagens, Besteira (o que dava pra evitar: doces, salgadinho, refrigerante), Rolê (saídas, festas, bares), Álcool, Entretenimento (cinema, streaming, shows, jogos), Outros e A definir. Entradas: Salário, Outras entradas.

## Estado atual

Os dados ficam no Supabase, com login. Cada pessoa só vê os próprios registros (veja `supabase/schema.sql`). Ao atualizar o app, rode de novo o `schema.sql` no SQL Editor do Supabase (com “Primary Database” selecionado): ele é seguro para rodar várias vezes.

## Desenvolvimento

Sem build: HTML, CSS e JavaScript puros.

```bash
python3 -m http.server 8000   # abre em http://localhost:8000
npm test                      # testes (frases, extratos e análises)
```
