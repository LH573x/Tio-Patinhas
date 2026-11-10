import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conselhoDoDia, DITADOS } from '../js/assessor.js';
import { mascote } from '../js/mascote.js';

const g = (data, item, valor, categoria) => ({ id: `${data}-${item}-${valor}`, tipo: 'gasto', data, item, valor, categoria });
const hoje = new Date(2026, 10, 10);

test('conselho: limite estourado vira alerta e leva para Metas', () => {
  const regs = [g('2026-11-02', 'Gasolina', 200, 'Carro'), g('2026-11-08', 'Gasolina', 180, 'Carro')];
  const c = conselhoDoDia({ registros: regs, orcamentos: [{ categoria: 'Carro', limite: 300 }], hoje });
  assert.equal(c.humor, 'alerta');
  assert.equal(c.titulo, 'Carro passou do limite');
  assert.equal(c.ir, 'metas');
});

test('conselho: elogia quando gasta menos que no mês passado', () => {
  const regs = [g('2026-10-03', 'Mercado', 900, 'Alimentação geral'), g('2026-11-03', 'Mercado', 300, 'Alimentação geral')];
  const c = conselhoDoDia({ registros: regs, hoje });
  assert.equal(c.humor, 'feliz');
  assert.match(c.titulo, /67% a menos/);
  assert.match(c.texto, /outubro/);
});

test('conselho: sem nada a dizer, um ditado só de vez em quando', () => {
  const dias = Array.from({ length: 30 }, (_, i) => new Date(2026, 10, i + 1));
  const ditos = dias.map((d) => conselhoDoDia({ registros: [], hoje: d })).filter(Boolean);
  assert.equal(ditos.length, 10); // um a cada 3 dias
  assert.ok(ditos.every((c) => DITADOS.some((d) => d.titulo === c.titulo)));
  assert.notEqual(ditos[0].titulo, ditos[1].titulo); // varia
});

test('mascote: SVG com humor e texto alternativo', () => {
  for (const humor of ['normal', 'feliz', 'alerta', 'outro']) {
    const s = mascote({ humor });
    assert.match(s, /^<svg [^>]*role="img" aria-label="Tio Patinhas"/);
    assert.match(s, /<\/svg>$/);
  }
  assert.notEqual(mascote({ humor: 'feliz' }), mascote({ humor: 'alerta' }));
});

test('logo: moeda com ids próprios e sem marca de terceiros', async () => {
  const { desenhoMoeda } = await import('../scripts/moeda.mjs');
  const a = desenhoMoeda('a');
  const b = desenhoMoeda('b');
  const ids = (s) => [...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids(a).length > 3 && ids(a).every((i) => i.startsWith('a')));
  assert.ok(ids(b).every((i) => i.startsWith('b')));
  // toda referência url(#...) aponta para um id do próprio desenho
  for (const [, ref] of a.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids(a).includes(ref), ref);
  assert.equal((a.match(/<g\b/g) || []).length, (a.match(/<\/g>/g) || []).length);
});
