// Gera os ícones do app a partir da logo (scripts/moeda.mjs): o Tio Patinhas numa moeda de ouro.
// Uso: node scripts/icones.mjs   (os PNGs precisam do Playwright com Chromium)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { desenhoMoeda } from './moeda.mjs';

const xml = (vb, conteudo) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">\n${conteudo}\n</svg>\n`;
// A moeda num quadrado de `lado`, com centro em (cx, cy) e diâmetro `d`.
const moedaEm = (cx, cy, d) => `<svg x="${cx - d / 2}" y="${cy - d / 2}" width="${d}" height="${d}" viewBox="0 0 200 200">${desenhoMoeda('m')}</svg>`;
// Fundo verde do app (para ícones que não podem ser transparentes), com a sombra da moeda.
const fundoVerde = (lado, d) => `
  <defs>
    <linearGradient id="verde" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14805f"/><stop offset="1" stop-color="#0a4a35"/></linearGradient>
    <radialGradient id="sombra" cx=".5" cy=".5" r=".5"><stop offset=".78" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${lado}" height="${lado}" fill="url(#verde)"/>
  <circle cx="${lado / 2}" cy="${lado / 2 + d * 0.035}" r="${d * 0.56}" fill="url(#sombra)"/>`;

const arquivos = {
  // Favicon, cartão de instalar e tela de entrada: só a moeda, fundo transparente.
  'icons/icon.svg': xml('0 0 200 200', desenhoMoeda('m')),
  // Android corta as bordas do ícone "maskable": a moeda fica dentro do círculo seguro (80% do meio).
  'icons/icon-maskable.svg': xml('0 0 512 512', `${fundoVerde(512, 372)}${moedaEm(256, 256, 372)}`),
  // iPhone não aceita transparência: fundo verde, moeda maior.
  'icons/apple-touch-icon.svg': xml('0 0 180 180', `${fundoVerde(180, 148)}${moedaEm(90, 90, 148)}`),
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
await png(arquivos['icons/apple-touch-icon.svg'], 180, 'icons/apple-touch-icon.png');
fs.unlinkSync('icons/icon-maskable.svg');
fs.unlinkSync('icons/apple-touch-icon.svg');
await navegador.close();
console.log('Ícones gerados.');
