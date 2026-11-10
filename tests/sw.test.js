import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

// O app abre da cópia guardada: todo arquivo de código precisa estar na lista do service worker.
test('service worker guarda todos os arquivos do app', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const lista = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));
  const pasta = (d) => readdirSync(new URL(`../${d}/`, import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `${d}/${f}`);
  for (const f of [...pasta('js'), ...pasta('js/telas'), ...pasta('js/vendor'), 'css/style.css', 'index.html']) {
    assert.ok(lista.has(f), `${f} faltando em sw.js`);
  }
});
