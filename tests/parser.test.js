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

const casosLocalHora = [
  ['salgado 8,50 pix na padaria do zé', { item: 'Salgado', local: 'Padaria do zé', hora: null, valor: 8.5, metodo: 'Pix', categoria: 'Refeições' }],
  ['gasolina 200 no crédito no posto shell às 15h30', { item: 'Gasolina', local: 'Posto shell', hora: '15:30', metodo: 'Crédito', valor: 200 }],
  ['coxinha 9 no posto ipiranga', { item: 'Coxinha', local: 'Posto ipiranga', categoria: 'Refeições' }],
  ['almoço 35 no shopping com a namorada', { local: 'Shopping', categoria: 'Namorada', valor: 35 }],
  ['hotel em Floripa 1.200,50 pix', { item: 'Hotel', local: 'Floripa', valor: 1200.5, categoria: 'Viagens' }],
  ['tênis 600 em 3x na Centauro', { item: 'Tênis', local: 'Centauro', valor: 600, parcelas: 3 }],
  ['café 7 às 9h', { item: 'Café', hora: '09:00', valor: 7, local: null }],
  ['pizza 60 pix ontem 21:15', { hora: '21:15', valor: 60, data: '2026-11-08', item: 'Pizza' }],
  ['abasteci 200 no crédito', { local: null, metodo: 'Crédito', valor: 200 }],
  ['almoço 25 em dinheiro', { local: null, metodo: 'Dinheiro', valor: 25 }],
  ['marmita 22 meio dia no trabalho', { hora: '12:00', local: 'Trabalho', item: 'Marmita', valor: 22 }],
];

for (const [frase, esperado] of casosLocalHora) {
  test(`local e hora: ${frase}`, () => {
    const r = interpretar(frase, { hoje });
    for (const [k, v] of Object.entries(esperado)) assert.equal(r[k], v, `${k} em "${frase}"`);
  });
}

test('cartão pelo nome: vira crédito e sai do item e do local', () => {
  const cartoes = [{ id: 'nu', nome: 'Nubank' }, { id: 'it', nome: 'Itaú' }, { id: 'xp', nome: 'XP Visa' }];
  const hoje = new Date(2026, 10, 9);
  let r = interpretar('mercado 200 nubank', { hoje, cartoes });
  assert.equal(r.cartaoId, 'nu');
  assert.equal(r.metodo, 'Crédito');
  assert.equal(r.item, 'Mercado');
  r = interpretar('jantar 90 no itau', { hoje, cartoes });
  assert.equal(r.cartaoId, 'it');
  assert.equal(r.item, 'Jantar');
  assert.equal(r.local, null);
  r = interpretar('tênis 600 em 3x xp visa', { hoje, cartoes });
  assert.equal(r.cartaoId, 'xp');
  assert.equal(r.parcelas, 3);
  assert.equal(r.item, 'Tênis');
  r = interpretar('padaria 12 débito nubank', { hoje, cartoes });
  assert.equal(r.cartaoId, null);
  assert.equal(r.metodo, 'Débito');
  r = interpretar('salgado 8,50 pix', { hoje, cartoes });
  assert.equal(r.cartaoId, null);
});

test('categorias novas: Besteira, Rolê, Álcool e Entretenimento', () => {
  const cat = (f) => interpretar(f).categoria;
  assert.equal(cat('chocolate 5 pix'), 'Besteira');
  assert.equal(cat('refri 6'), 'Besteira');
  assert.equal(cat('cerveja 12'), 'Álcool');
  assert.equal(cat('balada 120'), 'Rolê');
  assert.equal(cat('bar com amigos 80'), 'Rolê');
  assert.equal(cat('cinema 40'), 'Entretenimento');
  assert.equal(cat('show 200 crédito'), 'Entretenimento');
  assert.equal(cat('alcool 100'), 'Carro'); // combustível
  assert.equal(cat('pizza 60'), 'Refeições');
});
