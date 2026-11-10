import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoMes, historicoMeses, statusLimites, resumoSemana, dicas, planoMeta, statusContas, rotuloVencimento, previsaoGastos, refConta, faturaDaCompra, faturasCartoes, diaNoMes, cruzouLimite, avisosDoDia, doMes, diasEntre, iso } from '../js/analise.js';

const g = (data, item, valor, categoria, extra = {}) => ({ id: `${data}-${item}-${valor}`, tipo: 'gasto', data, item, valor, categoria, ...extra });
const e = (data, item, valor, categoria = 'Salário') => ({ id: `${data}-${item}`, tipo: 'entrada', data, item, valor, categoria });
const hoje = new Date(2026, 10, 10); // terça, 10/11/2026

const regs = [
  // outubro (mês anterior)
  g('2026-10-03', 'Mercado', 300, 'Alimentação geral'),
  g('2026-10-05', 'Gasolina', 150, 'Carro'),
  g('2026-10-20', 'Gasolina', 150, 'Carro'),
  g('2026-10-08', 'Almoço', 40, 'Refeições'),
  // setembro
  g('2026-09-06', 'Gasolina', 120, 'Carro'),
  g('2026-09-08', 'Almoço', 50, 'Refeições'),
  // novembro
  e('2026-11-05', 'Salário', 3000),
  g('2026-11-01', 'Salgado', 10, 'Refeições'),
  g('2026-11-02', 'Salgado', 10, 'Refeições'),
  g('2026-11-03', 'Salgado', 10, 'Refeições'),
  g('2026-11-04', 'Salgado', 12, 'Refeições'),
  g('2026-11-06', 'Restaurante', 250, 'Refeições'),
  g('2026-11-07', 'Gasolina', 400, 'Carro'),
  g('2026-11-09', 'Mercado', 90, 'Alimentação geral'),
  g('2026-12-10', 'Tênis', 200, 'Outros', { parcela: '2/3' }), // parcela futura
];

test('resumoMes compara com o mês anterior até o mesmo dia e projeta', () => {
  const r = resumoMes(regs, '2026-11', hoje);
  assert.equal(r.gasto, 782);
  assert.equal(r.entrada, 3000);
  assert.equal(r.saldo, 2218);
  assert.equal(r.anteriorMesmoPeriodo, 490); // outubro até dia 10
  assert.equal(r.anteriorTotal, 640);
  assert.equal(r.projecao, Math.round((782 / 10) * 30 * 100) / 100);
  assert.equal(r.categorias[0].categoria, 'Carro');
  assert.equal(r.categorias[0].valor, 400);
});

test('parcelas futuras não entram no mês atual', () => {
  const h = historicoMeses(regs, '2026-11', 3, hoje);
  assert.deepEqual(h.map((x) => x.mes), ['2026-09', '2026-10', '2026-11']);
  assert.equal(h[2].gasto, 782);
});

test('statusLimites', () => {
  const s = statusLimites(regs, [{ categoria: 'Carro', limite: 300 }, { categoria: 'Refeições', limite: 600 }, { categoria: 'Viagens', limite: 500 }], '2026-11', hoje);
  const carro = s.find((x) => x.categoria === 'Carro');
  assert.equal(carro.estado, 'estourou');
  const ref = s.find((x) => x.categoria === 'Refeições');
  assert.equal(ref.gasto, 292);
  assert.equal(ref.estado, 'atencao'); // projeção 876 > 600
  assert.equal(s.find((x) => x.categoria === 'Viagens').estado, 'ok');
});

test('resumoSemana pega a última semana completa (seg a dom)', () => {
  const s = resumoSemana(regs, hoje);
  assert.equal(s.inicio, '2026-11-02');
  assert.equal(s.fim, '2026-11-08');
  assert.equal(s.total, 682);
  assert.equal(s.maiores[0].item, 'Gasolina');
});

test('dicas: limite estourado, categoria em alta e gasto repetido', () => {
  const d = dicas(regs, [{ categoria: 'Carro', limite: 300 }], hoje, 10);
  const titulos = d.map((x) => x.titulo);
  assert.equal(titulos[0], 'Carro passou do limite');
  assert.ok(titulos.some((t) => t.startsWith('Refeições está')), titulos.join(' | '));
  assert.ok(!titulos.includes('Carro está 196% acima do normal')); // não repete a categoria do limite
});

test('dica de gasto repetido aparece com valor relevante', () => {
  const muitos = Array.from({ length: 8 }, (_, i) => g(`2026-11-0${(i % 9) + 1}`, 'Salgado', 9, 'Refeições'));
  const d = dicas(muitos, [], hoje, 10);
  assert.ok(d.some((x) => x.tipo === 'frequente' && x.titulo === 'Salgado: 8 vezes em 30 dias'));
});

test('planoMeta', () => {
  const p = planoMeta({ valor_alvo: 3000, valor_atual: 600, prazo: '2027-05-10' }, hoje);
  assert.equal(p.falta, 2400);
  assert.equal(p.mesesRestantes, 6);
  assert.equal(p.porMes, 400);
  assert.equal(planoMeta({ valor_alvo: 100, valor_atual: 150 }, hoje).concluida, true);
});

test('porLocal junta nomes parecidos e ignora futuro', async () => {
  const { porLocal } = await import('../js/analise.js');
  const regs = [
    { tipo: 'gasto', valor: 10, data: '2026-11-02', categoria: 'Refeições', local: 'Padaria do Zé' },
    { tipo: 'gasto', valor: 5, data: '2026-11-05', categoria: 'Alimentação geral', local: 'padaria do ze' },
    { tipo: 'gasto', valor: 4, data: '2026-11-06', categoria: 'Refeições', local: 'Padaria do Zé' },
    { tipo: 'gasto', valor: 100, data: '2026-11-20', categoria: 'Carro', local: 'Posto' },
    { tipo: 'gasto', valor: 50, data: '2026-11-03', categoria: 'Carro', local: null },
  ];
  const r = porLocal(regs, '2026-11', new Date(2026, 10, 9));
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { local: 'Padaria do Zé', valor: 19, vezes: 3, categoria: 'Refeições' });
});

// ---------------------------------------------------------------- Contas fixas
const contas = [
  { id: 'luz', nome: 'Luz', valor: 180, dia_vencimento: 10, ativa: true },
  { id: 'aluguel', nome: 'Aluguel', valor: 1500, dia_vencimento: 5, ativa: true },
  { id: 'net', nome: 'Internet', valor: 100, dia_vencimento: 13, ativa: true },
  { id: 'agua', nome: 'Água', valor: 80, dia_vencimento: 3, ativa: true },
  { id: 'velha', nome: 'Academia', valor: 90, dia_vencimento: 20, ativa: false },
  { id: 'fev', nome: 'Fim do mês', valor: 50, dia_vencimento: 31, ativa: true },
];

test('statusContas: paga, atrasada, hoje, breve e futura; ignora inativas', () => {
  const pagos = [g('2026-11-05', 'Aluguel', 1500, 'Outros', { refExterna: refConta('aluguel', '2026-11') }),
    g('2026-10-03', 'Água', 80, 'Outros', { refExterna: refConta('agua', '2026-10') })]; // pagou o mês passado, não este
  const s = statusContas(contas, pagos, hoje);
  const por = Object.fromEntries(s.map((x) => [x.conta.id, x]));
  assert.equal(por.aluguel.estado, 'paga');
  assert.equal(por.agua.estado, 'atrasada');
  assert.equal(por.agua.dias, -7);
  assert.equal(por.luz.estado, 'hoje');
  assert.equal(por.net.estado, 'breve');
  assert.equal(por.fev.estado, 'futura');
  assert.equal(por.fev.vencimento, '2026-11-30'); // novembro tem 30 dias
  assert.equal(por.velha, undefined);
  assert.deepEqual(s.map((x) => x.conta.id), ['agua', 'aluguel', 'luz', 'net', 'fev']);
});

test('rotuloVencimento', () => {
  assert.equal(rotuloVencimento(0), 'Vence hoje');
  assert.equal(rotuloVencimento(1), 'Vence amanhã');
  assert.equal(rotuloVencimento(3), 'Em 3 dias');
  assert.equal(rotuloVencimento(12, { diaDoMes: 22 }), 'Dia 22');
  assert.equal(rotuloVencimento(-1), 'Venceu ontem');
  assert.equal(rotuloVencimento(-4), 'Atrasada há 4 dias');
  assert.equal(rotuloVencimento(-4, { pago: true }), 'Paga');
  assert.equal(diaNoMes(31, '2028-02'), '2028-02-29');
});

test('previsão do mês: ritmo do dia a dia + contas fixas e parcelas pelo valor certo', () => {
  const lista = [
    g('2026-11-02', 'Mercado', 100, 'Alimentação geral'),
    g('2026-11-08', 'Almoço', 100, 'Refeições'),
    g('2026-11-05', 'Aluguel', 1500, 'Outros', { refExterna: refConta('aluguel', '2026-11') }),
    g('2026-11-04', 'Tênis', 200, 'Outros', { parcela: '1/3' }),
    g('2026-11-25', 'Curso', 300, 'Outros', { parcela: '2/5' }), // parcela mais tarde no mês
  ];
  const so = [contas[0], contas[1]]; // luz pendente (180) e aluguel pago
  // variáveis: 200 em 10 dias -> 600 no mês; + aluguel 1500 + tênis 200 + curso 300 + luz 180
  assert.equal(previsaoGastos(lista, so, hoje), 2780);
  assert.equal(resumoMes(lista, '2026-11', hoje, { contas: so }).projecao, 2780);
  // sem contas cadastradas: só o ritmo + fixos já lançados
  assert.equal(previsaoGastos(lista, [], hoje), 2600);
});

// ---------------------------------------------------------------- Cartões
const nubank = { id: 'nu', nome: 'Nubank', dia_fechamento: 3, dia_vencimento: 10, limite: 5000 };
const itau = { id: 'it', nome: 'Itaú', dia_fechamento: 25, dia_vencimento: 5, limite: null };

test('faturaDaCompra: fechamento manda a compra para a fatura seguinte', () => {
  assert.deepEqual(faturaDaCompra('2026-11-02', nubank), { fechamento: '2026-11-03', vencimento: '2026-11-10' });
  assert.deepEqual(faturaDaCompra('2026-11-03', nubank), { fechamento: '2026-12-03', vencimento: '2026-12-10' });
  // vencimento antes do fechamento no calendário: vence no mês seguinte ao fechamento
  assert.deepEqual(faturaDaCompra('2026-11-20', itau), { fechamento: '2026-11-25', vencimento: '2026-12-05' });
  assert.deepEqual(faturaDaCompra('2026-11-26', itau), { fechamento: '2026-12-25', vencimento: '2027-01-05' });
});

test('faturasCartoes: fatura atual, próxima, parcelas e limite usado', () => {
  const lista = [
    g('2026-11-01', 'Gasolina', 200, 'Carro', { cartaoId: 'nu' }), // fatura 10/11 (fechada dia 3)
    g('2026-11-06', 'Jantar', 150, 'Refeições', { cartaoId: 'nu' }), // fatura 10/12
    g('2026-11-06', 'Tênis', 100, 'Outros', { cartaoId: 'nu', parcela: '1/3' }),
    g('2026-12-06', 'Tênis', 100, 'Outros', { cartaoId: 'nu', parcela: '2/3' }),
    g('2027-01-06', 'Tênis', 100, 'Outros', { cartaoId: 'nu', parcela: '3/3' }),
    g('2026-10-01', 'Antiga', 999, 'Outros', { cartaoId: 'nu' }), // venceu em 10/10: paga
    g('2026-11-07', 'Pix', 50, 'Outros'), // sem cartão
  ];
  const [nu, it] = faturasCartoes(lista, [nubank, itau], hoje);
  assert.equal(nu.atual.vencimento, '2026-11-10');
  assert.equal(nu.atual.valor, 200);
  assert.equal(nu.atual.fechada, true);
  assert.equal(nu.proxima.vencimento, '2026-12-10');
  assert.equal(nu.proxima.valor, 250);
  assert.equal(nu.proxima.fechada, false);
  assert.equal(nu.usado, 650);
  assert.equal(nu.disponivel, 4350);
  // cartão sem gastos: mostra a fatura que está aberta agora, zerada
  assert.equal(it.atual.valor, 0);
  assert.equal(it.atual.vencimento, '2026-12-05');
  assert.equal(it.disponivel, null);
});

// ---------------------------------------------------------------- Alertas e card do dia
test('cruzouLimite: avisa só quando cruza 80% ou 100%', () => {
  const orc = [{ categoria: 'Refeições', limite: 500 }];
  const antes = [g('2026-11-02', 'Almoço', 350, 'Refeições')];
  assert.deepEqual(cruzouLimite(antes, [g('2026-11-10', 'Pizza', 60, 'Refeições')], orc, hoje),
    [{ categoria: 'Refeições', pct: 0.82, marco: 0.8 }]);
  assert.equal(cruzouLimite(antes, [g('2026-11-10', 'Pizza', 200, 'Refeições')], orc, hoje)[0].marco, 1);
  assert.deepEqual(cruzouLimite(antes, [g('2026-11-10', 'Café', 10, 'Refeições')], orc, hoje), []); // 72%: ainda não
  assert.deepEqual(cruzouLimite(antes, [g('2026-11-10', 'Gasolina', 900, 'Carro')], orc, hoje), []); // sem limite
  // parcela futura não conta no mês de hoje
  assert.deepEqual(cruzouLimite(antes, [g('2026-12-10', 'Jantar', 300, 'Refeições')], orc, hoje), []);
});

test('avisosDoDia: contas e faturas primeiro, depois limites, ritmo e caixa', () => {
  const lista = [
    g('2026-11-02', 'Almoço', 420, 'Refeições'),
    g('2026-11-01', 'Gasolina', 200, 'Carro', { cartaoId: 'nu' }), // fatura do Nubank vence 10/11 (hoje)
  ];
  const avisos = avisosDoDia({ registros: lista, orcamentos: [{ categoria: 'Refeições', limite: 500 }, { categoria: 'Carro', limite: 500 }],
    contas, cartoes: [nubank], caixaPendentes: 2, hoje, maximo: 10 });
  const tipos = avisos.map((a) => a.tipo);
  assert.deepEqual(tipos, ['conta', 'conta', 'conta', 'conta', 'fatura', 'limite', 'ritmo', 'caixa']);
  assert.equal(avisos[0].texto, 'Água venceu há 7 dias');
  assert.equal(avisos[1].texto, 'Aluguel venceu há 5 dias');
  assert.equal(avisos[2].texto, 'Luz vence hoje');
  assert.equal(avisos[3].texto, 'Internet vence em 3 dias');
  assert.equal(avisos[4].texto, 'Fatura do Nubank vence hoje');
  assert.equal(avisos[5].texto, 'Refeições já usou 84% do limite');
  // planejado 1000, gasto 620, 21 dias contando hoje -> R$ 18/dia
  assert.match(avisos[6].texto, /^Dá pra gastar R\$\s?18 por dia/);
  assert.equal(avisos[7].texto, '2 envios esperando a leitura de madrugada');
  assert.equal(avisosDoDia({ registros: [], hoje }).length, 0);
  assert.equal(avisosDoDia({ registros: lista, contas, cartoes: [nubank], hoje }).length, 4); // máximo padrão
});

test('doMes: separa por mês uma vez e acompanha a lista quando ela muda', () => {
  const lista = [g('2026-11-02', 'A', 10, 'Outros'), g('2026-10-30', 'B', 20, 'Outros'), g('2026-11-20', 'C', 5, 'Outros')];
  assert.deepEqual(doMes(lista, '2026-11').map((r) => r.item), ['A', 'C']);
  assert.deepEqual(doMes(lista, '2026-11', 10).map((r) => r.item), ['A']);
  assert.deepEqual(doMes(lista, '2026-09'), []);
  // quem recebe a lista pode mexer nela sem estragar a próxima consulta
  doMes(lista, '2026-11').pop();
  assert.equal(doMes(lista, '2026-11').length, 2);
  // registro novo na mesma lista entra na conta
  lista.push(g('2026-11-25', 'D', 1, 'Outros'));
  assert.deepEqual(doMes(lista, '2026-11').map((r) => r.item), ['A', 'C', 'D']);
  // lista nova (como o store faz a cada mudança) também
  const nova = lista.filter((r) => r.item !== 'A');
  assert.deepEqual(doMes(nova, '2026-11').map((r) => r.item), ['C', 'D']);
});

test('faturasCartoes: compras antigas ficam de fora sem mudar o resultado (vencimento até 62 dias depois)', () => {
  let maior = 0;
  for (let i = 0; i < 400; i += 3) {
    const d = iso(new Date(2026, 0, 1 + i));
    for (const [f, v] of [[1, 31], [31, 30], [3, 10], [25, 5], [28, 1], [15, 15]]) {
      maior = Math.max(maior, diasEntre(d, faturaDaCompra(d, { dia_fechamento: f, dia_vencimento: v }).vencimento));
    }
  }
  assert.ok(maior <= 62, `maior intervalo: ${maior}`);
  const cartao = { id: 'c1', nome: 'Nubank', dia_fechamento: 3, dia_vencimento: 10, limite: 1000 };
  const compras = [
    g('2026-08-01', 'Velha', 50, 'Outros', { metodo: 'Crédito', cartaoId: 'c1' }),
    g('2026-11-05', 'Nova', 80, 'Outros', { metodo: 'Crédito', cartaoId: 'c1' }),
  ];
  const [f] = faturasCartoes(compras, [cartao], hoje);
  assert.equal(f.usado, 80);
  assert.deepEqual(f.atual.itens.map((r) => r.item), ['Nova']);
});
