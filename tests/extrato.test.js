import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerExtrato, decodificar, lerValor, lerData, limparDescricao, prepararImportacao, descritorCartao } from '../js/extrato.js';

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

test('Inter com Histórico e Descrição: nome de quem recebeu e do estabelecimento', () => {
  const e = lerExtrato(arquivo('inter-historico.csv'));
  assert.equal(e.transacoes.length, 6);
  const linhas = prepararImportacao(e, []);
  assert.equal(linhas[0].item, 'Ana Souza Lima');
  assert.equal(linhas[0].tipo, 'entrada');
  assert.equal(linhas[1].item, 'Posto Shell');
  assert.equal(linhas[1].local, 'Posto Shell');
  assert.equal(linhas[1].estabelecimento, 'posto shell 1234');
  assert.equal(linhas[1].metodo, 'Débito');
  assert.equal(linhas[1].categoria, 'Carro');
  assert.equal(linhas[2].item, 'Bruno Costa');
  assert.equal(linhas[2].metodo, 'Pix');
  assert.equal(linhas[2].local, null);
  assert.equal(linhas[4].item, 'Uber *trip Help.usp');
  assert.equal(linhas[5].item, 'Drogasil');
  // dois Pix iguais no mesmo dia continuam sendo duas transações
  assert.equal(new Set(e.transacoes.map((t) => t.ref)).size, 6);
  assert.match(e.transacoes[1].ref, /\|s70\.00#1$/);
});

test('reconhece o que foi importado pela versão anterior (referência antiga)', () => {
  const e = lerExtrato(arquivo('inter-historico.csv'));
  const existentes = [{ id: '1', tipo: 'gasto', item: 'Compra no Débito', valor: 200, data: '2026-11-06',
    refExterna: 'csv:2026-11-06|200.00|compra no debito#1' }];
  const linhas = prepararImportacao(e, existentes);
  assert.equal(linhas[1].situacao, 'importado');
  assert.equal(linhas.filter((l) => l.situacao === 'importado').length, 1);
});

test('não duplica o que veio de foto de cupom ou de outro formato de extrato', () => {
  const e = lerExtrato(arquivo('inter-historico.csv'));
  const existentes = [
    { id: 'c', tipo: 'gasto', item: 'Gasolina', local: 'Posto Shell', valor: 200, data: '2026-11-05', refExterna: 'caixa:abc:0' },
    { id: 'o', tipo: 'gasto', item: 'Drogasil', valor: 60.48, data: '2026-11-03', refExterna: 'ofx:999:x1' },
    // outra linha do mesmo tipo de extrato: é outra transação, não a mesma
    { id: 'x', tipo: 'gasto', item: 'Bruno Costa', valor: 6, data: '2026-11-05', refExterna: 'csv:2026-11-01|6.00|s1.00#1' },
  ];
  const linhas = prepararImportacao(e, existentes);
  assert.equal(linhas[1].situacao, 'duplicado');
  assert.equal(linhas[1].duplicadoDe, 'c');
  assert.equal(linhas[5].situacao, 'duplicado');
  assert.equal(linhas[2].situacao, 'novo');
  assert.equal(linhas[3].situacao, 'novo');
});

test('descritorCartao separa nome e cidade', () => {
  assert.deepEqual(descritorCartao('Garagem Cingo         Sao Paulo    Bra'), { nome: 'Garagem Cingo', cidade: 'Sao Paulo' });
  assert.deepEqual(descritorCartao('Newmania              Sao Sebastiaobra'), { nome: 'Newmania', cidade: 'Sao Sebastiao' });
  assert.equal(descritorCartao('Padaria Pão Quente'), null);
});
