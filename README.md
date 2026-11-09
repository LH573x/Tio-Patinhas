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

Abas:

- **Registrar**: novo registro e lista de hoje.
- **Ontem**: revisar e corrigir os registros do dia anterior.
- **Mês**: gastos, entradas, saldo, gastos por categoria e parcelas futuras.

## Categorias

Refeições, Alimentação geral, Carro, Namorada, Viagens, Outros. Entradas: Salário, Outras entradas.

## Estado atual

Etapa 2 do plano. Os dados ficam salvos **só neste aparelho** por enquanto. A próxima etapa liga o app ao Supabase (login e sincronização) e depois adiciona fotos de cupom e extratos.

## Desenvolvimento

Sem build: HTML, CSS e JavaScript puros.

```bash
python3 -m http.server 8000   # abre em http://localhost:8000
npm test                      # testes do interpretador de frases
```
