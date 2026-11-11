import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itensUsados, sugerirItens, chaveItem, itemDaFrase } from '../js/itens.js';


const g = (item, extra = {}) => ({ tipo: 'gasto', item, categoria: 'Refeições', data: '2026-11-01', valor: 10, ...extra });

test('itens usados: junta grafias, fica a mais usada e ordena por frequência', () => {
  const lista = itensUsados([
    g('Gasolina', { categoria: 'Carro' }), g('gasolina', { categoria: 'Carro' }), g('Gasolina', { categoria: 'Carro' }),
    g('Almoço'), g('Almoco'), g('Almoço'), g('Almoço'),
    g('Salgado'),
  ]);
  assert.deepEqual(lista.map((i) => [i.item, i.vezes]), [['Almoço', 4], ['Gasolina', 3], ['Salgado', 1]]);
});

test('itens usados: deixa de fora A definir, Não lembro, nomes do banco e genéricos', () => {
  const lista = itensUsados([
    g('Posto Shell 123', { categoria: 'A definir' }),
    g('Mercado X', { categoria: 'Não lembro' }),
    g('Fulana de Tal', { origem: 'extrato', textoOriginal: 'Pix enviado - Fulana de Tal', local: 'Fulana de Tal' }),
    g('Bolo', { origem: 'extrato', textoOriginal: 'Pix enviado - Fulana de Tal', local: 'Fulana de Tal' }),
    g('Gasto'),
    { tipo: 'entrada', item: 'Salário', categoria: 'Salário', data: '2026-11-05', valor: 100 },
  ]);
  assert.deepEqual(lista.map((i) => i.item), ['Bolo']);
});

test('sugestões: começo de palavra primeiro, sem acento, e não repete o que já está escrito', () => {
  const itens = itensUsados([g('Pão de queijo'), g('Pão de queijo'), g('Queijo ralado'), g('Requeijão'), g('Gasolina')]);
  // "queij" começa palavra em Pão de queijo e Queijo ralado; em Requeijão está no meio
  assert.deepEqual(sugerirItens('queij', itens).map((i) => i.item), ['Pão de queijo', 'Queijo ralado', 'Requeijão']);
  assert.deepEqual(sugerirItens('eij', itens).map((i) => i.item), ['Pão de queijo', 'Queijo ralado', 'Requeijão']);
  assert.deepEqual(sugerirItens('ralad', itens).map((i) => i.item), ['Queijo ralado']);
  assert.deepEqual(sugerirItens('pao', itens).map((i) => i.item), ['Pão de queijo']);
  assert.deepEqual(sugerirItens('Pão de queijo', itens), []);
  assert.deepEqual(sugerirItens('g', itens), [], 'precisa de 2 letras');
  assert.equal(chaveItem('  Pão-de-Queijo! '), 'pao de queijo');
});

test('frase do Início: o item é o começo, antes do valor', () => {
  assert.equal(itemDaFrase('salg').texto, 'salg');
  assert.equal(itemDaFrase('salg').trocar('Salgado'), 'Salgado ');
  const f = itemDaFrase('salg 8,50 pix');
  assert.equal(f.texto, 'salg');
  assert.equal(f.trocar('Salgado'), 'Salgado 8,50 pix');
  assert.equal(itemDaFrase('8,50 salgado').texto, '');
});
