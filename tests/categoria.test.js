import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodoDatas, gastosDaCategoria, porEtiqueta, daEtiqueta } from '../js/analise.js';

const g = (data, item, valor, categoria = 'Carro', extra = {}) => ({ id: `${data}-${item}-${valor}`, tipo: 'gasto', data, item, valor, categoria, ...extra });
const hoje = new Date(2026, 10, 10); // 10/11/2026

test('período do mês do painel: mês atual vai só até hoje, mês passado inteiro', () => {
  assert.deepEqual(periodoDatas('mes', { mes: '2026-11', hoje }), { de: '2026-11-01', ate: '2026-11-10' });
  assert.deepEqual(periodoDatas('mes', { mes: '2026-02', hoje }), { de: '2026-02-01', ate: '2026-02-28' });
});

test('períodos prontos contam a partir de hoje', () => {
  assert.deepEqual(periodoDatas('30d', { mes: '2026-11', hoje }), { de: '2026-10-12', ate: '2026-11-10' });
  assert.deepEqual(periodoDatas('3m', { mes: '2026-11', hoje }), { de: '2026-09-01', ate: '2026-11-10' });
  assert.deepEqual(periodoDatas('6m', { mes: '2026-11', hoje }), { de: '2026-06-01', ate: '2026-11-10' });
  assert.deepEqual(periodoDatas('ano', { mes: '2026-11', hoje }), { de: '2026-01-01', ate: '2026-11-10' });
});

test('datas escolhidas: aceita invertidas', () => {
  assert.deepEqual(periodoDatas('datas', { mes: '2026-11', hoje, de: '2026-10-31', ate: '2026-10-01' }), { de: '2026-10-01', ate: '2026-10-31' });
});

test('gastos da categoria: só a categoria e o período, do maior valor para o menor', () => {
  const regs = [
    g('2026-11-02', 'Gasolina', 150),
    g('2026-11-05', 'Lavagem', 40),
    g('2026-11-08', 'Pneu', 600),
    g('2026-11-09', 'Estacionamento', 40),
    g('2026-10-30', 'Gasolina', 200), // fora do período
    g('2026-11-03', 'Almoço', 999, 'Refeições'), // outra categoria
    { id: 'x', tipo: 'entrada', data: '2026-11-04', item: 'Reembolso', valor: 80, categoria: 'Carro' },
  ];
  const { lista, total } = gastosDaCategoria(regs, 'Carro', { de: '2026-11-01', ate: '2026-11-10' });
  assert.deepEqual(lista.map((r) => r.item), ['Pneu', 'Gasolina', 'Estacionamento', 'Lavagem']); // empate: mais recente antes
  assert.equal(total, 830);
});

test('etiquetas da categoria: totais na ordem das etiquetas e filtro', () => {
  const regs = [
    g('2026-11-02', 'Hotel', 500, 'Namorada', { etiqueta: 'Viagem' }),
    g('2026-11-03', 'Garagem Cin Go', 20, 'Namorada', { etiqueta: 'Estacionamento' }),
    g('2026-11-04', 'Garagem Cin Go', 15, 'Namorada', { etiqueta: 'Estacionamento' }),
    g('2026-11-05', 'Farmácia', 30, 'Namorada'), // sem etiqueta: Outros
  ];
  assert.deepEqual(porEtiqueta(regs, 'Namorada'), [
    { etiqueta: 'Viagem', valor: 500, quantos: 1 },
    { etiqueta: 'Estacionamento', valor: 35, quantos: 2 },
    { etiqueta: 'Outros', valor: 30, quantos: 1 },
  ]);
  assert.deepEqual(daEtiqueta(regs, 'Estacionamento').map((r) => r.valor), [20, 15]);
  const uber = [g('2026-11-02', 'Uber', 30, 'Transporte', { etiqueta: 'Uber' }), g('2026-11-03', 'Táxi', 10, 'Transporte')];
  assert.deepEqual(porEtiqueta(uber, 'Transporte').map((e) => e.etiqueta), ['Uber', 'Sem etiqueta']);
});

test('lançamentos: período, categoria, etiqueta e busca juntos', async () => {
  const { filtrarLancamentos } = await import('../js/analise.js');
  const regs = [
    g('2026-09-10', 'Garagem Cin Go', 20, 'Namorada'),
    g('2026-11-03', 'Garagem Cin Go', 15, 'Namorada'),
    g('2026-11-04', 'Hotel', 500, 'Namorada', { etiqueta: 'Viagem' }),
    g('2026-11-05', 'Uber', 30, 'Transporte', { etiqueta: 'Uber' }),
  ];
  const ids = (l) => l.map((r) => `${r.data} ${r.item}`);
  // Tudo, buscando "garagem": os dois meses, mais recente primeiro
  assert.deepEqual(ids(filtrarLancamentos(regs, { termo: 'garagem' })), ['2026-11-03 Garagem Cin Go', '2026-09-10 Garagem Cin Go']);
  assert.deepEqual(ids(filtrarLancamentos(regs, { de: '2026-11-01', ate: '2026-11-30', categoria: 'Namorada' })), ['2026-11-04 Hotel', '2026-11-03 Garagem Cin Go']);
  assert.deepEqual(ids(filtrarLancamentos(regs, { categoria: 'Namorada', etiqueta: 'Outros' })), ['2026-11-03 Garagem Cin Go', '2026-09-10 Garagem Cin Go']);
  // A busca acha pela etiqueta também
  assert.deepEqual(ids(filtrarLancamentos(regs, { termo: 'viagem' })), ['2026-11-04 Hotel']);
});
