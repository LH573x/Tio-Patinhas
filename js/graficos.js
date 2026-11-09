// Gráficos desenhados em SVG, sem biblioteca.
// Regras: marcas finas, cantos de 4px, 2px de espaço entre fatias/barras,
// rótulos só onde ajudam, valores sempre também em texto (lista ao lado).
import { esc, reais } from './util.js';
import { MESES_CURTOS } from './analise.js';

/**
 * Rosca de gastos por categoria.
 * fatias: [{ categoria, valor, cor }]
 */
export function rosca(fatias, total, { rotulo = 'gastos', tamanho = 168 } = {}) {
  const r = 70;
  const espessura = 18;
  const c = 2 * Math.PI * r;
  const soma = fatias.reduce((s, f) => s + f.valor, 0) || 1;
  const vao = fatias.length > 1 ? 2.5 : 0; // espaço entre fatias, em px do traço
  let inicio = 0;
  const arcos = fatias.map((f) => {
    const comp = (f.valor / soma) * c;
    const visivel = Math.max(comp - vao, 0.5);
    const arco = `<circle class="fatia" data-categoria="${esc(f.categoria)}" cx="90" cy="90" r="${r}" fill="none"
      stroke="${f.cor}" stroke-width="${espessura}" stroke-dasharray="${visivel} ${c - visivel}"
      stroke-dashoffset="${-inicio}" transform="rotate(-90 90 90)"><title>${esc(f.categoria)}: ${reais(f.valor)}</title></circle>`;
    inicio += comp;
    return arco;
  });
  return `
    <svg class="rosca" viewBox="0 0 180 180" width="${tamanho}" height="${tamanho}" role="img"
      aria-label="Gastos por categoria, total ${reais(total)}">
      <circle cx="90" cy="90" r="${r}" fill="none" stroke="var(--trilho)" stroke-width="${espessura}"/>
      ${arcos.join('')}
      <text x="90" y="84" text-anchor="middle" class="rosca-rotulo">${esc(rotulo)}</text>
      <text x="90" y="106" text-anchor="middle" class="rosca-valor">${reais(total, { centavos: false })}</text>
    </svg>`;
}

/**
 * Uma barra só, dividida pelas categorias (substitui a rosca).
 * fatias: [{ categoria, valor, cor }]
 */
export function barraCategorias(fatias) {
  const soma = fatias.reduce((s, f) => s + f.valor, 0) || 1;
  return `<div class="barra-cats" role="img" aria-label="Divisão dos gastos por categoria">${fatias
    .filter((f) => f.valor > 0)
    .map((f) => `<i style="--cor:${f.cor};flex:${(f.valor / soma).toFixed(4)}" title="${esc(f.categoria)}: ${reais(f.valor)}"></i>`).join('')}</div>`;
}

/**
 * Barras dos últimos meses (uma série: gastos), com linha da média.
 * meses: [{ mes: 'YYYY-MM', gasto }], destaque: 'YYYY-MM'
 */
export function barrasMeses(meses, destaque) {
  const L = 320;
  const A = 150;
  const topo = 22;
  const base = A - 24;
  const max = Math.max(...meses.map((m) => m.gasto), 1);
  const passo = L / meses.length;
  const larg = Math.min(30, passo * 0.56);
  const comDados = meses.filter((m) => m.gasto > 0 && m.mes !== destaque);
  const media = comDados.length ? comDados.reduce((s, m) => s + m.gasto, 0) / comDados.length : 0;
  const y = (v) => base - (v / max) * (base - topo);
  const barras = meses.map((m, i) => {
    const x = i * passo + (passo - larg) / 2;
    const h = Math.max(base - y(m.gasto), m.gasto > 0 ? 3 : 0);
    const ativo = m.mes === destaque;
    const [ano, mm] = m.mes.split('-').map(Number);
    const nome = MESES_CURTOS[mm - 1];
    // retângulo com topo arredondado (4px) e base reta, apoiado na linha de base
    const rr = Math.min(4, h / 2, larg / 2);
    const d = h > 0
      ? `M${x} ${base}V${base - h + rr}Q${x} ${base - h} ${x + rr} ${base - h}H${x + larg - rr}Q${x + larg} ${base - h} ${x + larg} ${base - h + rr}V${base}Z`
      : '';
    return `
      <g class="barra-mes${ativo ? ' ativa' : ''}" data-mes="${m.mes}" tabindex="0" role="button"
        aria-label="${nome} de ${ano}: ${reais(m.gasto)}">
        <rect x="${i * passo}" y="0" width="${passo}" height="${A}" fill="transparent"/>
        ${d ? `<path d="${d}"/>` : ''}
        <text x="${x + larg / 2}" y="${A - 6}" text-anchor="middle" class="eixo">${nome}</text>
        ${ativo && m.gasto > 0 ? `<text x="${x + larg / 2}" y="${base - h - 6}" text-anchor="middle" class="valor-barra">${reais(m.gasto, { centavos: false })}</text>` : ''}
        <title>${nome}/${ano}: ${reais(m.gasto)}</title>
      </g>`;
  });
  const linhaMedia = media > 0
    ? `<line x1="0" x2="${L}" y1="${y(media)}" y2="${y(media)}" class="linha-media"/>
       <text x="0" y="${y(media) - 5}" text-anchor="start" class="eixo">média ${reais(media, { centavos: false })}</text>`
    : '';
  return `
    <svg class="barras" viewBox="0 0 ${L} ${A}" preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="Gastos dos últimos ${meses.length} meses">
      <line x1="0" x2="${L}" y1="${base}" y2="${base}" class="linha-base"/>
      ${linhaMedia}
      ${barras.join('')}
    </svg>`;
}

/**
 * Barra de progresso (limite ou meta). estado: ok | atencao | estourou | meta
 * marca: mostra um tracinho nos 80% (onde o app começa a avisar).
 */
export function progresso(fracao, estado = 'ok', rotulo = '', { marca = false } = {}) {
  const p = Math.max(0, Math.min(fracao, 1)) * 100;
  return `<div class="progresso ${estado}${marca ? ' com-marca' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100"
    aria-valuenow="${Math.round(fracao * 100)}" ${rotulo ? `aria-label="${esc(rotulo)}"` : ''}>
    <div class="progresso-cheio" style="width:${p}%"></div>${marca ? '<i class="progresso-marca" aria-hidden="true"></i>' : ''}</div>`;
}

/** Estado de uma barra de limite: até 80% ok, de 80% a 100% atenção, acima de 100% estourou. */
export function estadoLimite(fracao) {
  if (fracao > 1) return 'estourou';
  if (fracao >= 0.8) return 'atencao';
  return 'ok';
}
