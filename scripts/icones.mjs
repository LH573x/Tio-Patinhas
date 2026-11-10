// Gera os ícones do app a partir do desenho do mascote (js/mascote.js).
// Uso: node scripts/icones.mjs   (os PNGs precisam do Playwright com Chromium)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { mascote } from '../js/mascote.js';

const OURO = '#e8b84a';
// Fundo dourado com um brilho no meio, como uma moeda.
const fundo = (id) => `<radialGradient id="${id}" cx=".5" cy=".42" r=".62"><stop offset="0" stop-color="#ffd978"/><stop offset=".65" stop-color="${OURO}"/><stop offset="1" stop-color="#cf9a2c"/></radialGradient>`;
const corpo = mascote().replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const caixa = '14 6 172 195';
const xml = (vb, conteudo) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">\n${conteudo}\n</svg>\n`;
const dentro = (x, y, w, h) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${caixa}">${corpo}</svg>`;

const arquivos = {
  'icons/mascote.svg': xml(caixa, corpo),
  'icons/icon.svg': xml('0 0 512 512', `${fundo('f')}<rect width="512" height="512" rx="112" fill="url(#f)"/>\n${dentro(46, 33, 420, 479)}`),
  'icons/logo.svg': xml('0 0 64 64', `${fundo('f')}<clipPath id="c"><circle cx="32" cy="32" r="32"/></clipPath><g clip-path="url(#c)"><rect width="64" height="64" fill="url(#f)"/>${dentro(5.5, 3, 53, 61)}</g>`),
  // Maskable: o sistema corta as bordas, então o mascote fica dentro dos 80% do meio.
  'icons/icon-maskable.svg': xml('0 0 512 512', `${fundo('f')}<rect width="512" height="512" fill="url(#f)"/>\n${dentro(91, 126, 330, 386)}`),
};
for (const [nome, svg] of Object.entries(arquivos)) fs.writeFileSync(nome, svg);

const { chromium } = createRequire(import.meta.url)('playwright');
const navegador = await chromium.launch();
const png = async (svg, tam, saida) => {
  const p = await navegador.newPage({ viewport: { width: tam, height: tam } });
  await p.setContent(`<body style="margin:0"><img style="width:${tam}px;height:${tam}px;display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body>`);
  await p.waitForTimeout(50);
  await p.screenshot({ path: saida, omitBackground: true });
  await p.close();
};
await png(arquivos['icons/icon.svg'], 192, 'icons/icon-192.png');
await png(arquivos['icons/icon.svg'], 512, 'icons/icon-512.png');
await png(arquivos['icons/icon-maskable.svg'], 512, 'icons/icon-maskable-512.png');
fs.unlinkSync('icons/icon-maskable.svg');
await navegador.close();
console.log('Ícones gerados.');
