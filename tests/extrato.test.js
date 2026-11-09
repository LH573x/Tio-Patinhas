import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerExtrato, decodificar, lerValor, lerData, limparDescricao, prepararImportacao } from '../js/extrato.js';

const arquivo = (nome) => decodificar(readFileSync(new URL(`./exemplos/${nome}`, import.meta.url)));

test('lerValor entende formatos brasileiros e americanos', () => {
  assert.equal(lerValor('1.234,56'), 1234.56);
  assert.equal(lerValor('-12,50'), -12.5);
  assert.equal(lerValor('-12.50'), -12.5);
  assert.equal(lerValor('R$ 8,90'), 8.9);
  assert.equal(lerValor('(15,00)'), -15);
  assert.equal(lerValor('1.200'), 1200);
  assert.equal(lerValor('abc'), null);
});

test('lerData', () => {
  assert.equal(lerData('09/11/2026'), '2026-11-09');
  assert.equal(lerData('9/11/26'), '2026-11-09');
  assert.equal(lerData('2026-11-09'), '2026-11-09');
  assert.equal(lerData('20261109120000[-3:BRT]'), '2026-11-09');
});

test('Nubank conta (CSV): sinais, descrições e o que ignorar', () => {
  const e = lerExtrato(arquivo('nubank-conta.csv'));
  assert.equal(e.transacoes.length, 6);
  assert.equal(e.cartao, false);
  const [salario, padaria, posto] = e.transacoes;
  assert.equal(salario.tipo, 'entrada');
  assert.equal(salario.valor, 3500);
  assert.equal(padaria.tipo, 'gasto');
  assert.equal(padaria.ref, 'csv:c3d4');
  const linhas = prepararImportacao(e, []);
  assert.equal(linhas[1].item, 'Padaria Pão Quente');
  assert.equal(linhas[1].metodo, 'Débito');
  assert.equal(linhas[2].categoria, 'Carro');
  assert.equal(linhas[3].situacao, 'ignorar'); // fatura
  assert.equal(linhas[4].item, 'Maria Souza');
  assert.equal(linhas[4].metodo, 'Pix');
  assert.equal(linhas[5].situacao, 'ignorar'); // aplicação
  assert.equal(posto.valor, 200);
});

test('Nubank cartão (CSV): positivo é compra', () => {
  const e = lerExtrato(arquivo('nubank-cartao.csv'));
  assert.equal(e.cartao, true);
  const linhas = prepararImportacao(e, []);
  assert.equal(linhas[0].tipo, 'gasto');
  assert.equal(linhas[0].categoria, 'Refeições');
  assert.equal(linhas[0].metodo, 'Crédito');
  assert.equal(linhas[1].categoria, 'Alimentação geral');
  assert.equal(linhas[3].tipo, 'entrada');
  assert.equal(linhas[3].situacao, 'ignorar'); // pagamento da fatura
});

test('Inter (CSV com ; e cabeçalho depois de linhas extras)', () => {
  const e = lerExtrato(arquivo('inter.csv'));
  assert.equal(e.transacoes.length, 4);
  assert.equal(e.transacoes[2].valor, 1234.56);
  assert.equal(e.transacoes[2].tipo, 'gasto');
  assert.equal(e.transacoes[3].tipo, 'entrada');
  // duas transações iguais no mesmo dia recebem referências diferentes
  assert.notEqual(e.transacoes[0].ref, e.transacoes[1].ref);
  const linhas = prepararImportacao(e, []);
  assert.equal(linhas[2].categoria, 'Viagens');
  assert.equal(linhas[0].metodo, 'Pix');
});

test('OFX em Windows-1252 (Itaú)', () => {
  const e = lerExtrato(arquivo('itau.ofx'));
  assert.equal(e.formato, 'OFX');
  assert.equal(e.transacoes.length, 2);
  assert.equal(e.transacoes[0].data, '2026-11-04');
  assert.equal(e.transacoes[0].valor, 89.9);
  assert.equal(e.transacoes[0].ref, 'ofx:9876:2026110401');
  const linhas = prepararImportacao(e, []);
  assert.equal(linhas[0].item, 'Açougue Boi');
  assert.equal(linhas[0].categoria, 'Alimentação geral');
  assert.equal(linhas[1].categoria, 'Salário');
});

test('não duplica: já importado e já registrado à mão', () => {
  const e = lerExtrato(arquivo('nubank-conta.csv'));
  const existentes = [
    { id: '1', tipo: 'gasto', item: 'Salgado', valor: 8.5, data: '2026-11-02' }, // registrado à mão
    { id: '2', tipo: 'gasto', item: 'Posto', valor: 200, data: '2026-11-04', ref_externa: 'csv:e5f6' }, // importado
  ];
  const linhas = prepararImportacao(e, existentes);
  assert.equal(linhas[1].situacao, 'duplicado');
  assert.match(linhas[1].aviso, /Salgado/);
  assert.equal(linhas[1].selecionado, false);
  assert.equal(linhas[2].situacao, 'importado');
  assert.equal(linhas[0].selecionado, true);
});

test('limparDescricao', () => {
  assert.equal(limparDescricao('COMPRA NO DEBITO - SUPERMERCADO EXTRA'), 'Supermercado Extra');
  assert.equal(limparDescricao('Pix enviado: "Cinema Kinoplex"'), 'Cinema Kinoplex');
  assert.equal(limparDescricao('UBER *TRIP'), 'Uber *trip');
});
