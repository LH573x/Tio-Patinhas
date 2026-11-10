import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

// O app abre da cópia guardada: todo arquivo de código precisa estar na lista do service worker.
test('service worker guarda todos os arquivos do app', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const lista = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));
  const pasta = (d) => readdirSync(new URL(`../${d}/`, import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `${d}/${f}`);
  for (const f of [...pasta('js'), ...pasta('js/telas'), ...pasta('js/vendor'), 'css/style.css', 'index.html']) {
    assert.ok(lista.has(f), `${f} faltando em sw.js`);
  }
});

// Arquivo renomeado ou apagado não pode deixar a página (nem a instalação do app) quebrada.
test('index.html, manifesto e service worker só apontam para arquivos que existem', () => {
  const ler = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const existe = (f) => existsSync(new URL(`../${f.replace(/^\.\//, '')}`, import.meta.url));
  const html = ler('index.html');
  const locais = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|data:|#)/.test(u));
  const manifesto = JSON.parse(ler('manifest.webmanifest')).icons.map((i) => i.src);
  const sw = [...ler('sw.js').matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
  for (const f of [...locais, ...manifesto, ...sw]) assert.ok(existe(f), `${f} não existe`);
  assert.ok(locais.includes('fonts/inter-latin-v20.woff2'), 'fonte guardada no app');
  assert.ok(!/fonts\.googleapis/.test(html), 'sem depender do Google Fonts para abrir');
});

test('todo módulo do app está no modulepreload (baixa tudo de uma vez)', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const pre = new Set([...html.matchAll(/rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]));
  const pasta = (d) => readdirSync(new URL(`../${d}/`, import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `${d}/${f}`);
  for (const f of [...pasta('js'), ...pasta('js/telas')]) assert.ok(pre.has(f), `${f} faltando no modulepreload`);
});
