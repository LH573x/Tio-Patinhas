import {
  interpretar, gerarLancamentos, formatarReais, CATEGORIAS_GASTO, CATEGORIAS_ENTRADA, METODOS,
} from './parser.js';
import { store } from './store.js';

const $ = (sel) => document.querySelector(sel);

function hojeISO(delta = 0) {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dataCurta(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Abas ----------
const abas = ['registrar', 'ontem', 'mes'];
function abrirAba(nome) {
  abas.forEach((a) => {
    $(`#aba-${a}`).hidden = a !== nome;
    $(`[data-aba="${a}"]`).setAttribute('aria-selected', a === nome);
  });
  render();
}
document.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => abrirAba(b.dataset.aba)));

// ---------- Registrar ----------
const entrada = $('#frase');
let previa = null;

function opcoes(lista, atual) {
  return lista.map((o) => `<option ${o === atual ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

function renderPrevia() {
  const texto = entrada.value.trim();
  const box = $('#previa');
  if (!texto) {
    previa = null;
    box.hidden = true;
    return;
  }
  previa = interpretar(texto, { regras: store.regras() });
  const cats = previa.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_GASTO;
  box.hidden = false;
  box.innerHTML = `
    <div class="previa-linha">
      <span class="chip ${previa.tipo}">${previa.tipo === 'entrada' ? 'Entrada' : 'Gasto'}</span>
      <strong>${esc(previa.item)}</strong>
      <span class="valor ${previa.valor === null ? 'falta' : ''}">${previa.valor === null ? 'falta o valor' : formatarReais(previa.valor)}</span>
    </div>
    <div class="previa-campos">
      <label>Pagamento<select id="p-metodo"><option value="">—</option>${opcoes(METODOS, previa.metodo)}</select></label>
      <label>Categoria<select id="p-cat">${opcoes(cats, previa.categoria)}</select></label>
    </div>
    ${previa.parcelas > 1 ? `<p class="dica">${previa.parcelas}x de ${formatarReais(previa.valorParcela)}, uma por mês</p>` : ''}
    ${previa.data !== hojeISO() ? `<p class="dica">Data: ${dataCurta(previa.data)}</p>` : ''}`;
  $('#p-metodo').addEventListener('change', (e) => { previa.metodo = e.target.value || null; });
  $('#p-cat').addEventListener('change', (e) => {
    previa.categoria = e.target.value;
    previa.categoriaManual = true;
  });
}
entrada.addEventListener('input', renderPrevia);

function registrar() {
  if (!previa) return;
  if (previa.valor === null) {
    toast('Coloque o valor, ex.: "salgado 8,50 pix"');
    return;
  }
  if (previa.categoriaManual) store.aprenderRegra(previa.item, previa.categoria);
  const { categoriaManual, completo, ...reg } = previa;
  store.adicionar(gerarLancamentos({ ...reg, origem: 'texto' }));
  toast(`${reg.item} · ${formatarReais(reg.valor)} · ${reg.categoria} ✓`);
  entrada.value = '';
  renderPrevia();
  render();
  entrada.focus();
}
$('#form-registro').addEventListener('submit', (e) => {
  e.preventDefault();
  registrar();
});

// ---------- Lista editável ----------
function linhaRegistro(r) {
  const cats = r.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_GASTO;
  return `
    <details class="registro" data-id="${r.id}">
      <summary>
        <span class="r-item">${esc(r.item)}${r.parcela ? ` <small>${r.parcela}</small>` : ''}</span>
        <span class="r-cat">${esc(r.categoria)}${r.metodo ? ` · ${esc(r.metodo)}` : ''}</span>
        <span class="r-valor ${r.tipo}">${r.tipo === 'entrada' ? '+' : ''}${formatarReais(r.valor)}</span>
      </summary>
      <div class="editar">
        <label>Item<input data-campo="item" value="${esc(r.item)}"></label>
        <label>Valor<input data-campo="valor" inputmode="decimal" value="${String(r.valor).replace('.', ',')}"></label>
        <label>Pagamento<select data-campo="metodo"><option value="">—</option>${opcoes(METODOS, r.metodo)}</select></label>
        <label>Categoria<select data-campo="categoria">${opcoes(cats, r.categoria)}</select></label>
        <label>Data<input data-campo="data" type="date" value="${r.data}"></label>
        <div class="acoes">
          <button type="button" class="salvar">Salvar</button>
          <button type="button" class="apagar">Apagar</button>
        </div>
      </div>
    </details>`;
}

function ligarEdicao(container) {
  container.querySelectorAll('.registro').forEach((el) => {
    const id = el.dataset.id;
    el.querySelector('.salvar').addEventListener('click', () => {
      const atual = store.listar().find((r) => r.id === id);
      const m = {};
      el.querySelectorAll('[data-campo]').forEach((c) => { m[c.dataset.campo] = c.value; });
      m.valor = Number(String(m.valor).replace(/\./g, '').replace(',', '.')) || 0;
      m.metodo = m.metodo || null;
      if (atual && m.categoria !== atual.categoria) store.aprenderRegra(m.item, m.categoria);
      store.atualizar(id, m);
      toast('Corrigido ✓');
      render();
    });
    el.querySelector('.apagar').addEventListener('click', () => {
      if (confirm('Apagar este registro?')) {
        store.remover(id);
        render();
      }
    });
  });
}

function listaHTML(regs, vazio) {
  if (!regs.length) return `<p class="vazio">${vazio}</p>`;
  return regs.map(linhaRegistro).join('');
}

function totais(regs) {
  return regs.reduce((t, r) => {
    t[r.tipo] += r.valor;
    return t;
  }, { gasto: 0, entrada: 0 });
}

// ---------- Render ----------
function render() {
  const todos = store.listar().sort((a, b) => (b.data + b.criadoEm).localeCompare(a.data + a.criadoEm));
  const hoje = hojeISO();
  const ontem = hojeISO(-1);
  const mes = hoje.slice(0, 7);

  // Hoje (aba Registrar)
  const deHoje = todos.filter((r) => r.data === hoje);
  $('#lista-hoje').innerHTML = listaHTML(deHoje, 'Nada registrado hoje ainda.');
  $('#total-hoje').textContent = formatarReais(totais(deHoje).gasto);
  ligarEdicao($('#lista-hoje'));

  // Ontem
  const deOntem = todos.filter((r) => r.data === ontem);
  $('#titulo-ontem').textContent = `Ontem, ${dataCurta(ontem)}`;
  $('#lista-ontem').innerHTML = listaHTML(deOntem, 'Nenhum registro ontem.');
  $('#total-ontem').textContent = formatarReais(totais(deOntem).gasto);
  ligarEdicao($('#lista-ontem'));

  // Mês
  const doMes = todos.filter((r) => r.data.startsWith(mes) && r.data <= hoje);
  const t = totais(doMes);
  $('#mes-gastos').textContent = formatarReais(t.gasto);
  $('#mes-entradas').textContent = formatarReais(t.entrada);
  $('#mes-saldo').textContent = formatarReais(t.entrada - t.gasto);
  $('#total-mes').textContent = formatarReais(t.gasto);
  const porCat = CATEGORIAS_GASTO.map((c) => ({
    c, v: doMes.filter((r) => r.tipo === 'gasto' && r.categoria === c).reduce((s, r) => s + r.valor, 0),
  })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const max = Math.max(1, ...porCat.map((x) => x.v));
  $('#mes-categorias').innerHTML = porCat.length
    ? porCat.map((x) => `
      <div class="barra">
        <div class="barra-topo"><span>${esc(x.c)}</span><span>${formatarReais(x.v)} · ${Math.round((x.v / t.gasto) * 100)}%</span></div>
        <div class="barra-fundo"><div class="barra-cheia" style="width:${(x.v / max) * 100}%"></div></div>
      </div>`).join('')
    : '<p class="vazio">Sem gastos neste mês ainda.</p>';
  const futuras = todos.filter((r) => r.data > hoje && r.parcela);
  $('#mes-futuras').innerHTML = futuras.length
    ? `<h3>Parcelas futuras</h3>${listaHTML(futuras.sort((a, b) => a.data.localeCompare(b.data)), '')}`
    : '';
  ligarEdicao($('#mes-futuras'));
}

// ---------- Toast ----------
let timer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---------- Início ----------
const params = new URLSearchParams(location.search);
abrirAba(abas.includes(params.get('aba')) ? params.get('aba') : 'registrar');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
