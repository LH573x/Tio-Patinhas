import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoMes, historicoMeses, statusLimites, resumoSemana, dicas, planoMeta } from '../js/analise.js';

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
