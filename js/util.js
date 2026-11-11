// Pequenas funções usadas pelas telas.
import { DIAS_SEMANA, MESES_CURTOS, iso, somarDias, formatador } from './analise.js';

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const REAIS = formatador({ style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const REAIS_INTEIROS = formatador({ style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function reais(v, { centavos = true, sinal = false } = {}) {
  const s = (centavos ? REAIS : REAIS_INTEIROS).format(Math.abs(v) || 0);
  if (v < 0) return `−${s}`;
  return sinal && v > 0 ? `+${s}` : s;
}

/** Valor em reais com os centavos menores (para números grandes). Retorna HTML. */
export function reaisGrande(v) {
  const txt = reais(v);
  const i = txt.lastIndexOf(',');
  if (i < 0) return esc(txt);
  return `${esc(txt.slice(0, i))}<span class="centavos">${esc(txt.slice(i))}</span>`;
}

/** Valor grande do topo: "R$" e centavos menores. Retorna HTML. */
export function valorHero(v, { centavos = true } = {}) {
  const txt = reais(v, { centavos });
  const m = txt.match(/^(−?)R\$\s*(.+?)(,\d\d)?$/);
  if (!m) return esc(txt);
  return `<span class="moeda">${m[1]}R$</span>${esc(m[2])}${m[3] ? `<span class="centavos">${esc(m[3])}</span>` : ''}`;
}

/**
 * Selo de estado (chip pequeno). tipo: neutro | ok | atencao | estourou | destaque
 * Ex.: selo('Vence hoje', 'atencao')
 */
export function selo(texto, tipo = 'neutro') {
  return `<span class="selo ${tipo}">${esc(texto)}</span>`;
}

export function pct(v, casas = 0) {
  return `${formatador({ maximumFractionDigits: casas }).format(v * 100)}%`;
}

export function hojeISO(delta = 0) {
  return somarDias(iso(new Date()), delta);
}

export function horaAgora() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function dataCurta(s) {
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}

/** "Hoje", "Ontem", "sex, 7 nov" */
export function rotuloDia(s) {
  if (s === hojeISO()) return 'Hoje';
  if (s === hojeISO(-1)) return 'Ontem';
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const ano = y !== new Date().getFullYear() ? ` ${y}` : '';
  return `${DIAS_SEMANA[dt.getDay()]}, ${d} ${MESES_CURTOS[m - 1]}${ano}`;
}

export function lerNumero(txt) {
  const s = String(txt || '').trim().replace(/\s|R\$/g, '');
  if (!s) return null;
  // "1.200" é mil e duzentos (ponto de milhar), não 1,2
  const n = Number(s.includes(',') || /^-?\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export function numeroParaCampo(v) {
  return v === null || v === undefined ? '' : String(v).replace('.', ',');
}

/** Faixa que pede para rodar o schema.sql de novo quando o banco está desatualizado. */
export function avisoBanco(ativo, esperando = 0) {
  if (!ativo && !esperando) return '';
  const guardado = esperando
    ? ` ${esperando === 1 ? '1 alteração está guardada' : `${esperando} alterações estão guardadas`} só neste celular e vai para a nuvem sozinha depois disso.`
    : '';
  return `<div class="aviso-banco">${ICONES.alerta}<span>Falta atualizar o banco pra usar todas as novidades (contas fixas, cartões, etiquetas, quem recebeu, limites, metas, fotos):
    rode de novo o arquivo <b>schema.sql</b> no SQL Editor do Supabase, com “Primary Database” selecionado.${guardado}</span></div>`;
}

// ---------- Aviso rápido (toast) ----------
let timer;
export function aviso(msg, tipo = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast ${tipo}`;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, 2800);
}

// ---------- Folha que sobe de baixo (bottom sheet) ----------
let fecharAtual = null;
export function abrirFolha(titulo, html, aoMontar) {
  if (fecharAtual) fecharAtual();
  const fundo = document.createElement('div');
  fundo.className = 'folha-fundo';
  fundo.innerHTML = `
    <div class="folha" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="folha-alca" aria-hidden="true"></div>
      <div class="folha-topo">
        <h2>${esc(titulo)}</h2>
        <button type="button" class="icone-btn fechar" aria-label="Fechar">${ICONES.fechar}</button>
      </div>
      <div class="folha-corpo">${html}</div>
    </div>`;
  document.body.appendChild(fundo);
  document.body.classList.add('sem-rolagem');
  requestAnimationFrame(() => fundo.classList.add('aberta'));
  const aoTeclar = (e) => { if (e.key === 'Escape') fechar(); };
  function fechar() {
    fundo.classList.remove('aberta');
    document.body.classList.remove('sem-rolagem');
    setTimeout(() => fundo.parentNode && fundo.parentNode.removeChild(fundo), 200);
    if (fecharAtual === fechar) fecharAtual = null;
    document.removeEventListener('keydown', aoTeclar);
  }
  document.addEventListener('keydown', aoTeclar);
  fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(); });
  $('.fechar', fundo).addEventListener('click', fechar);
  fecharAtual = fechar;
  const folha = $('.folha', fundo);
  if (aoMontar) aoMontar(folha, fechar);
  return fechar;
}

export function confirmar(texto, { sim = 'Confirmar', perigo = false } = {}) {
  return new Promise((resolve) => {
    abrirFolha('Confirmar', `
      <p class="texto-confirmar">${esc(texto)}</p>
      <div class="acoes-folha">
        <button type="button" class="btn secundario" data-r="nao">Cancelar</button>
        <button type="button" class="btn ${perigo ? 'perigo' : 'primario'}" data-r="sim">${esc(sim)}</button>
      </div>`, (folha, fechar) => {
      $$('[data-r]', folha).forEach((b) => b.addEventListener('click', () => {
        fechar();
        resolve(b.dataset.r === 'sim');
      }));
    });
  });
}

// ---------- Ícones (traço, 24x24) ----------
const svg = (d) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONES = {
  inicio: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>'),
  lista: svg('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>'),
  painel: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  metas: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'),
  subir: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  enviar: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  arquivo: svg('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>'),
  fechar: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  voltar: svg('<path d="M15 6l-6 6 6 6"/>'),
  avancar: svg('<path d="M9 6l6 6-6 6"/>'),
  sol: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  lua: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>'),
  auto: svg('<rect x="5" y="2.5" width="14" height="19" rx="3"/><path d="M10 18.5h4"/>'),
  mais: svg('<path d="M12 5v14M5 12h14"/>'),
  busca: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  relogio: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  ok: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  alerta: svg('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.2v.1"/>'),
  lixo: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  sair: svg('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>'),
  chave: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>'),
  ideia: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  cartao: svg('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>'),
  calendario: svg('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  importar: svg('<path d="M12 3v12M7 10l5 5 5-5M4 19h16"/>'),
};
