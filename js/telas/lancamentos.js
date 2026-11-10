// Lista de todos os registros do mês, agrupados por dia, com busca e filtro.
import { CATEGORIAS_GASTO, CATEGORIAS_ENTRADA, semAcento } from '../parser.js';
import { nomeMes, somarMesesMes, mesDe, iso } from '../analise.js';
import { store } from '../store.js';
import { $, $$, esc, reais, rotuloDia, ICONES } from '../util.js';
import { linhaRegistro, ligarRegistros } from './registro.js';
import { enviarExtrato } from './anexos.js';

const estado = { busca: '', categoria: '', timer: null };

export function seletorMes(mes, id = 'mes') {
  const atual = mesDe(iso(new Date()));
  const titulo = nomeMes(mes);
  return `
    <div class="seletor-mes" id="${id}">
      <button type="button" class="icone-btn" data-delta="-1" aria-label="Mês anterior">${ICONES.voltar}</button>
      <span>${titulo.charAt(0).toUpperCase() + titulo.slice(1)}</span>
      <button type="button" class="icone-btn" data-delta="1" aria-label="Próximo mês" ${mes >= somarMesesMes(atual, 12) ? 'disabled' : ''}>${ICONES.avancar}</button>
    </div>`;
}

export function ligarSeletorMes(raiz, app, id = 'mes') {
  $$(`#${id} [data-delta]`, raiz).forEach((b) => b.addEventListener('click', () => {
    app.mes = somarMesesMes(app.mes, Number(b.dataset.delta));
    app.render();
  }));
}

export function telaLancamentos(raiz, app) {
  const todos = store.listar().filter((r) => mesDe(r.data) === app.mes);
  const termo = semAcento(estado.busca.trim());
  const filtrados = todos
    .filter((r) => !estado.categoria || r.categoria === estado.categoria)
    .filter((r) => !termo || semAcento(`${r.item} ${r.categoria} ${r.metodo || ''} ${r.local || ''} ${r.textoOriginal || ''}`).includes(termo))
    .sort((a, b) => b.data.localeCompare(a.data) || (b.hora || '').localeCompare(a.hora || '') || (b.criadoEm || '').localeCompare(a.criadoEm || ''));

  const dias = new Map();
  for (const r of filtrados) {
    if (!dias.has(r.data)) dias.set(r.data, []);
    dias.get(r.data).push(r);
  }
  const gasto = filtrados.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + r.valor, 0);
  const entrada = filtrados.filter((r) => r.tipo === 'entrada').reduce((s, r) => s + r.valor, 0);
  const cats = [...CATEGORIAS_GASTO, ...CATEGORIAS_ENTRADA].filter((c) => todos.some((r) => r.categoria === c));

  raiz.innerHTML = `
    <div class="barra-ferramentas">
      ${seletorMes(app.mes)}
      <button type="button" class="chip-acao" id="btn-importar">${ICONES.importar}Extrato</button>
    </div>
    <label class="busca">${ICONES.busca}<input type="search" id="busca" placeholder="Buscar (ex.: gasolina, pix, padaria)" value="${esc(estado.busca)}"></label>
    ${cats.length > 1 ? `<div class="chips-filtro" role="group" aria-label="Filtrar por categoria">
      <button type="button" class="chip-filtro ${estado.categoria ? '' : 'ativo'}" data-cat="">Todas</button>
      ${cats.map((c) => `<button type="button" class="chip-filtro ${estado.categoria === c ? 'ativo' : ''}" data-cat="${esc(c)}"
        style="--cor:${app.cor(c)}"><i></i>${esc(c)}</button>`).join('')}
    </div>` : ''}
    <div class="totais-lista">
      <span>${filtrados.length} ${filtrados.length === 1 ? 'registro' : 'registros'}</span>
      <span>Gastos <b>${reais(gasto)}</b>${entrada ? ` · Entradas <b class="positivo">${reais(entrada)}</b>` : ''}</span>
    </div>
    ${filtrados.length ? [...dias.entries()].map(([data, regs]) => {
      const totalDia = regs.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + r.valor, 0);
      return `
        <section class="grupo-dia">
          <div class="grupo-topo"><h3>${rotuloDia(data)}</h3><span>${reais(totalDia)}</span></div>
          <div class="lista-registros">${regs.map((r) => linhaRegistro(r, app)).join('')}</div>
        </section>`;
    }).join('') : `<div class="vazio-grande">${todos.length ? 'Nada encontrado com esse filtro.' : 'Nenhum registro neste mês.'}</div>`}`;

  ligarSeletorMes(raiz, app);
  ligarRegistros(raiz, app);
  $('#btn-importar', raiz).addEventListener('click', () => enviarExtrato(app));
  const busca = $('#busca', raiz);
  // Espera uma pausa na digitação antes de redesenhar a lista (não trava a cada letra).
  busca.addEventListener('input', () => {
    clearTimeout(estado.timer);
    estado.timer = setTimeout(() => {
      if (!busca.isConnected) return;
      estado.busca = busca.value;
      const pos = busca.selectionStart;
      telaLancamentos(raiz, app);
      const nova = $('#busca', raiz);
      nova.focus();
      nova.setSelectionRange(pos, pos);
    }, 180);
  });
  $$('.chip-filtro', raiz).forEach((b) => b.addEventListener('click', () => {
    estado.categoria = b.dataset.cat;
    telaLancamentos(raiz, app);
  }));
}
