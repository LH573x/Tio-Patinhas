import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretar, gerarLancamentos } from '../js/parser.js';

const hoje = new Date(2026, 10, 9); // 09/11/2026

const casos = [
  ['salgado 8,50 pix', { item: 'Salgado', valor: 8.5, metodo: 'Pix', categoria: 'Refeições', tipo: 'gasto' }],
  ['abasteci 200 no crédito', { valor: 200, metodo: 'Crédito', categoria: 'Carro' }],
  ['gasolina R$ 150,00 débito', { item: 'Gasolina', valor: 150, metodo: 'Débito', categoria: 'Carro' }],
  ['mercado 312,47 debito', { item: 'Mercado', valor: 312.47, categoria: 'Alimentação geral' }],
  ['jantar com a namorada 180 crédito', { valor: 180, categoria: 'Namorada' }],
  ['hotel em Floripa 1.200,50 pix', { valor: 1200.5, categoria: 'Viagens' }],
  ['2 coxinhas 14 dinheiro', { valor: 14, metodo: 'Dinheiro', categoria: 'Refeições' }],
  ['recebi salário 3500', { tipo: 'entrada', valor: 3500, categoria: 'Salário' }],
  ['farmácia 32,90 pix', { categoria: 'Outros', valor: 32.9 }],
  ['almoço 25 vr', { metodo: 'Vale', categoria: 'Refeições', valor: 25 }],
  ['café', { valor: null }],
];

for (const [frase, esperado] of casos) {
  test(frase, () => {
    const r = interpretar(frase, { hoje });
    for (const [k, v] of Object.entries(esperado)) assert.equal(r[k], v, `${k} em "${frase}"`);
  });
}

test('ontem muda a data', () => {
  assert.equal(interpretar('pizza 60 pix ontem', { hoje }).data, '2026-11-08');
});

test('regras aprendidas têm prioridade', () => {
  const r = interpretar('posto shell 100 pix', { hoje, regras: [{ termo: 'shell', categoria: 'Viagens' }] });
  assert.equal(r.categoria, 'Viagens');
});

test('parcelas viram lançamentos mensais', () => {
  const r = interpretar('tênis 600 em 3x', { hoje });
  assert.equal(r.parcelas, 3);
  assert.equal(r.metodo, 'Crédito');
  assert.equal(r.valor, 600);
  const l = gerarLancamentos(r);
  assert.deepEqual(l.map((x) => [x.data, x.valor, x.parcela]), [
    ['2026-11-09', 200, '1/3'], ['2026-12-09', 200, '2/3'], ['2027-01-09', 200, '3/3'],
  ]);
  assert.equal(l[0].item, 'Tênis');
});

test('parcelas com centavos fecham o total', () => {
  const l = gerarLancamentos(interpretar('celular 1000 10x', { hoje }));
  assert.equal(Math.round(l.reduce((s, x) => s + x.valor, 0) * 100) / 100, 1000);
});
