// Lista de todos os registros do mês, agrupados por dia, com busca e filtro.
import { CATEGORIAS_GASTO, CATEGORIAS_ENTRADA, semAcento } from '../parser.js';
import { nomeMes, somarMesesMes, mesDe, iso } from '../analise.js';
import { store } from '../store.js';
import { $, $$, esc, reais, rotuloDia, ICONES, confirmar, aviso } from '../util.js';
import { linhaRegistro, ligarRegistros } from './registro.js';
import { enviarExtrato } from './anexos.js';

// selecionando: modo de marcar vários para apagar de uma vez
const estado = { busca: '', categoria: '', timer: null, selecionando: false, marcados: new Set() };

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
  // Filtro de uma categoria que sumiu do mês (ex.: apagou todos): volta para Todas
  if (estado.categoria && !todos.some((r) => r.categoria === estado.categoria)) estado.categoria = '';
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

  // Só ficam marcados os que continuam visíveis (mudou filtro ou mês, desmarca o resto)
  const visiveis = new Set(filtrados.map((r) => r.id));
  for (const id of estado.marcados) if (!visiveis.has(id)) estado.marcados.delete(id);
  const nMarcados = estado.marcados.size;
  const todosMarcados = filtrados.length > 0 && nMarcados === filtrados.length;

  raiz.innerHTML = `
    <div class="barra-ferramentas">
      ${seletorMes(app.mes)}
      <div class="acoes-lista">
        ${filtrados.length ? `<button type="button" class="chip-acao ${estado.selecionando ? 'ativo' : ''}" id="btn-selecionar">${estado.selecionando ? 'Cancelar' : `${ICONES.ok}Selecionar`}</button>` : ''}
        ${estado.selecionando ? '' : `<button type="button" class="chip-acao" id="btn-importar">${ICONES.importar}Extrato</button>`}
      </div>
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
    ${estado.selecionando ? `
      <div class="barra-selecao" role="region" aria-label="Seleção">
        <button type="button" class="link" id="marcar-todos">${todosMarcados ? 'Desmarcar todos' : `Marcar todos (${filtrados.length})`}</button>
        <span class="sel-conta">${nMarcados ? `${nMarcados} ${nMarcados === 1 ? 'marcado' : 'marcados'}` : 'Toque para marcar'}</span>
        <button type="button" class="btn perigo" id="apagar-marcados" ${nMarcados ? '' : 'disabled'}>${ICONES.lixo}Apagar</button>
      </div>` : ''}
    <div class="${estado.selecionando ? 'selecionando' : ''}">
    ${filtrados.length ? [...dias.entries()].map(([data, regs]) => {
      const totalDia = regs.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + r.valor, 0);
      return `
        <section class="grupo-dia">
          <div class="grupo-topo"><h3>${rotuloDia(data)}</h3><span>${reais(totalDia)}</span></div>
          <div class="lista-registros">${regs.map((r) => linhaRegistro(r, app)
            .replace('class="registro"', `class="registro${estado.marcados.has(r.id) ? ' sel-marcado' : ''}"${estado.selecionando ? ` aria-pressed="${estado.marcados.has(r.id)}"` : ''}`)).join('')}</div>
        </section>`;
    }).join('') : `<div class="vazio-grande">${todos.length ? 'Nada encontrado com esse filtro.' : 'Nenhum registro neste mês.'}</div>`}
    </div>`;

  ligarSeletorMes(raiz, app);
  if (estado.selecionando) ligarSelecao(raiz, app, filtrados);
  else ligarRegistros(raiz, app);
  $('#btn-importar', raiz)?.addEventListener('click', () => enviarExtrato(app));
  $('#btn-selecionar', raiz)?.addEventListener('click', () => {
    estado.selecionando = !estado.selecionando;
    estado.marcados.clear();
    telaLancamentos(raiz, app);
  });
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

/** Modo seleção: tocar marca/desmarca; "Apagar" remove todos os marcados de uma vez. */
function ligarSelecao(raiz, app, filtrados) {
  $$('.registro[data-id]', raiz).forEach((el) => el.addEventListener('click', () => {
    const id = el.dataset.id;
    if (estado.marcados.has(id)) estado.marcados.delete(id);
    else estado.marcados.add(id);
    const y = window.scrollY;
    telaLancamentos(raiz, app);
    window.scrollTo({ top: y });
  }));
  $('#marcar-todos', raiz)?.addEventListener('click', () => {
    if (estado.marcados.size === filtrados.length) estado.marcados.clear();
    else filtrados.forEach((r) => estado.marcados.add(r.id));
    telaLancamentos(raiz, app);
  });
  $('#apagar-marcados', raiz)?.addEventListener('click', async () => {
    const ids = [...estado.marcados];
    const total = filtrados.filter((r) => estado.marcados.has(r.id)).reduce((s, r) => s + r.valor, 0);
    const pergunta = `Apagar ${ids.length} ${ids.length === 1 ? 'registro' : 'registros'} (${reais(total)})? Não dá pra desfazer.`;
    if (!(await confirmar(pergunta, { sim: 'Apagar', perigo: true }))) return;
    try {
      await store.removerVarios(ids);
      estado.marcados.clear();
      estado.selecionando = false;
      aviso(`${ids.length} ${ids.length === 1 ? 'registro apagado' : 'registros apagados'}`);
    } catch (err) {
      aviso(`Não apagou: ${err.message}`, 'erro');
    }
    app.render();
  });
}
