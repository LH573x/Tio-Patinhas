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

test('categorias novas: Besteira, Rolê (com bebida) e Entretenimento', () => {
  const cat = (f) => interpretar(f).categoria;
  assert.equal(cat('chocolate 5 pix'), 'Besteira');
  assert.equal(cat('refri 6'), 'Besteira');
  assert.equal(cat('cerveja 12'), 'Rolê');
  assert.equal(cat('chopp com a galera 45'), 'Rolê');
  assert.equal(cat('balada 120'), 'Rolê');
  assert.equal(cat('bar com amigos 80'), 'Rolê');
  assert.equal(cat('cinema 40'), 'Entretenimento');
  assert.equal(cat('show 200 crédito'), 'Entretenimento');
  assert.equal(cat('alcool 100'), 'Carro'); // combustível
  assert.equal(cat('pizza 60'), 'Refeições');
});

test('entradas: Caixa 2 VR, Caixa 2 e Poker', () => {
  const r = (f) => interpretar(f, { hoje });
  assert.deepEqual(pick(r('caixa 2 300')), { tipo: 'entrada', valor: 300, categoria: 'Caixa 2', item: 'Caixa 2', metodo: null });
  assert.deepEqual(pick(r('caixa 2 vr 450')), { tipo: 'entrada', valor: 450, categoria: 'Caixa 2 VR', item: 'Caixa 2 vr', metodo: null });
  assert.deepEqual(pick(r('recebi 300 de caixa 2 pix')), { tipo: 'entrada', valor: 300, categoria: 'Caixa 2', item: 'Caixa 2', metodo: 'Pix' });
  assert.equal(r('caixa dois 500').categoria, 'Caixa 2');
  assert.deepEqual(pick(r('ganhei 200 no poker')), { tipo: 'entrada', valor: 200, categoria: 'Poker', item: 'Poker', metodo: null });
  assert.equal(r('poker 150').tipo, 'entrada');
  assert.equal(r('recebi salário 3500').categoria, 'Salário');
  assert.equal(r('vr 30 almoço').metodo, 'Vale'); // "vr" sozinho continua sendo vale
});

function pick(x) {
  return { tipo: x.tipo, valor: x.valor, categoria: x.categoria, item: x.item, metodo: x.metodo };
}

test('categoria antiga "Álcool" vira "Rolê", inclusive em regras aprendidas', async () => {
  const { categoriaAtual, sugerirCategoria, CATEGORIAS_GASTO } = await import('../js/parser.js');
  assert.equal(categoriaAtual('Álcool'), 'Rolê');
  assert.equal(categoriaAtual('Carro'), 'Carro');
  assert.ok(!CATEGORIAS_GASTO.includes('Álcool'));
  assert.equal(sugerirCategoria('bar do zé', 'gasto', [{ termo: 'bar do ze', categoria: 'Álcool' }]), 'Rolê');
});

test('categorias Roupas e Transporte (o antigo Metrô)', async () => {
  const { sugerirCategoria, CATEGORIAS_GASTO, categoriaAtual } = await import('../js/parser.js');
  const { CATEGORIAS_INFO, infoCategoria } = await import('../js/categorias.js');
  for (const c of ['Roupas', 'Transporte']) {
    assert.ok(CATEGORIAS_GASTO.includes(c));
    assert.ok(CATEGORIAS_INFO[c], `${c} tem ícone e cor`);
  }
  assert.ok(!CATEGORIAS_GASTO.includes('Metrô'));
  assert.equal(categoriaAtual('Metrô'), 'Transporte');
  assert.equal(infoCategoria('Metrô'), CATEGORIAS_INFO.Transporte);
  assert.equal(sugerirCategoria('camiseta renner'), 'Roupas');
  assert.equal(sugerirCategoria('tênis'), 'Roupas');
  assert.equal(sugerirCategoria('metrô'), 'Transporte');
  assert.equal(sugerirCategoria('passagem do metro'), 'Transporte');
  assert.equal(sugerirCategoria('recarga do bilhete único'), 'Transporte');
  assert.equal(sugerirCategoria('ônibus'), 'Transporte');
  assert.equal(sugerirCategoria('uber'), 'Transporte');
  assert.equal(sugerirCategoria('uber eats'), 'Refeições');
  assert.equal(sugerirCategoria('passagem de avião'), 'Viagens');
  const r = (f) => interpretar(f, { hoje });
  assert.equal(r('camisa 80 pix').categoria, 'Roupas');
  assert.equal(r('metro 5,40').categoria, 'Transporte');
});

test('etiquetas de Transporte e Namorada', async () => {
  const { etiquetaDe, etiquetasDe } = await import('../js/parser.js');
  const r = (f) => interpretar(f, { hoje });
  assert.deepEqual(etiquetasDe('Namorada'), ['Viagem', 'Estacionamento', 'Refeições', 'Presentes', 'Outros']);
  assert.deepEqual(etiquetasDe('Transporte'), ['Uber', 'Transporte público']);
  assert.deepEqual(etiquetasDe('Carro'), []);
  assert.equal(r('uber 25 pix').etiqueta, 'Uber');
  assert.equal(r('99pop 18').etiqueta, 'Uber');
  assert.equal(r('metrô 5,40').etiqueta, 'Transporte público');
  assert.equal(r('ônibus 5').etiqueta, 'Transporte público');
  assert.equal(r('jantar com a namorada 180').etiqueta, 'Refeições');
  assert.equal(r('estacionamento namorada 20').etiqueta, 'Estacionamento');
  assert.equal(r('presente namorada 150').etiqueta, 'Presentes');
  assert.equal(r('hotel com a namorada 500').etiqueta, 'Viagem');
  assert.equal(r('gasolina 200').etiqueta, null);
  // Namorada sem etiqueta conta como "Outros"; etiqueta de outra categoria não vale
  assert.equal(etiquetaDe({ categoria: 'Namorada' }), 'Outros');
  assert.equal(etiquetaDe({ categoria: 'Transporte' }), null);
  assert.equal(etiquetaDe({ categoria: 'Carro', etiqueta: 'Uber' }), null);
});
