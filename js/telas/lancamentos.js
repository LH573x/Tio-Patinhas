// Lista de registros agrupados por dia: período (um mês, vários meses ou tudo), busca,
// categoria e etiqueta. Dá para marcar vários e mudar ou apagar todos de uma vez.
import { CATEGORIAS_GASTO, CATEGORIAS_ENTRADA, semAcento, etiquetasDe, etiquetaDe } from '../parser.js';
import { nomeMes, somarMesesMes, mesDe, iso, diasNoMes, PERIODOS, periodoDatas, filtrarLancamentos, porEtiqueta, SEM_ETIQUETA } from '../analise.js';
import { store } from '../store.js';
import { $, $$, esc, reais, rotuloDia, ICONES, confirmar, aviso, abrirFolha } from '../util.js';
import { linhaRegistro, ligarRegistros, campoEtiqueta } from './registro.js';
import { enviarExtrato } from './anexos.js';

// Quantos registros aparecem de cada vez (com "Tudo" a lista pode ter milhares).
const PASSO = 200;

// periodo: um dos PERIODOS ("mes" = o mês escolhido nas setas).
// selecionando: modo de marcar vários para mudar ou apagar de uma vez.
const estado = { busca: '', periodo: 'mes', de: '', ate: '', categoria: '', etiqueta: '', limite: PASSO,
  timer: null, selecionando: false, marcados: new Set() };

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

/** Datas do período escolhido. No mês, o mês inteiro (com as parcelas futuras); "Tudo" inclui as futuras. */
function datasDoPeriodo(app) {
  if (estado.periodo === 'mes') return { de: `${app.mes}-01`, ate: `${app.mes}-${String(diasNoMes(app.mes)).padStart(2, '0')}` };
  if (estado.periodo === 'tudo') return { de: '', ate: '' };
  return periodoDatas(estado.periodo, { mes: app.mes, hoje: new Date(), de: estado.de, ate: estado.ate });
}

const dataCurta = (d) => d.split('-').reverse().join('/');

export function telaLancamentos(raiz, app) {
  const periodo = datasDoPeriodo(app);
  const doPeriodo = filtrarLancamentos(store.listar(), periodo);
  // Filtro que sumiu do período (ex.: apagou todos): volta para Todas
  if (estado.categoria && !doPeriodo.some((r) => r.categoria === estado.categoria)) estado.categoria = '';
  const daCategoria = estado.categoria ? doPeriodo.filter((r) => r.categoria === estado.categoria) : [];
  const etiquetas = estado.categoria ? porEtiqueta(daCategoria, estado.categoria) : [];
  const comEtiquetas = etiquetas.some((e) => e.etiqueta !== SEM_ETIQUETA);
  if (estado.etiqueta && !etiquetas.some((e) => e.etiqueta === estado.etiqueta)) estado.etiqueta = '';
  const filtrados = filtrarLancamentos(doPeriodo, {
    categoria: estado.categoria, etiqueta: estado.etiqueta, termo: semAcento(estado.busca.trim()) });
  const mostrados = filtrados.slice(0, estado.limite);

  const dias = new Map();
  for (const r of mostrados) {
    if (!dias.has(r.data)) dias.set(r.data, []);
    dias.get(r.data).push(r);
  }
  const gasto = filtrados.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + r.valor, 0);
  const entrada = filtrados.filter((r) => r.tipo === 'entrada').reduce((s, r) => s + r.valor, 0);
  const cats = [...CATEGORIAS_GASTO, ...CATEGORIAS_ENTRADA].filter((c) => doPeriodo.some((r) => r.categoria === c));

  // Só ficam marcados os que continuam visíveis no filtro (mudou filtro ou período, desmarca o resto)
  const visiveis = new Set(filtrados.map((r) => r.id));
  for (const id of estado.marcados) if (!visiveis.has(id)) estado.marcados.delete(id);
  const nMarcados = estado.marcados.size;
  const todosMarcados = filtrados.length > 0 && nMarcados === filtrados.length;

  const chipsPeriodo = PERIODOS.map((p) => `
    <button type="button" class="chip-filtro ${estado.periodo === p.id ? 'ativo' : ''}" data-periodo="${p.id}">${
      esc(p.id === 'mes' ? 'Mês' : p.nome)}</button>`).join('');
  const rotuloPeriodo = estado.periodo === 'tudo' ? 'Tudo' : estado.periodo === 'mes' ? '' : `${dataCurta(periodo.de)} a ${dataCurta(periodo.ate)}`;

  raiz.innerHTML = `
    <div class="barra-ferramentas">
      ${estado.periodo === 'mes' ? seletorMes(app.mes) : `<span class="rotulo-periodo">${esc(rotuloPeriodo)}</span>`}
      <div class="acoes-lista">
        ${filtrados.length ? `<button type="button" class="chip-acao ${estado.selecionando ? 'ativo' : ''}" id="btn-selecionar">${estado.selecionando ? 'Cancelar' : `${ICONES.ok}Selecionar`}</button>` : ''}
        ${estado.selecionando ? '' : `<button type="button" class="chip-acao" id="btn-importar">${ICONES.importar}Extrato</button>`}
      </div>
    </div>
    <div class="chips-filtro" role="group" aria-label="Período">${chipsPeriodo}</div>
    ${estado.periodo === 'datas' ? `
      <div class="dupla">
        <label class="campo">De<input type="date" name="de" value="${periodo.de}"></label>
        <label class="campo">Até<input type="date" name="ate" value="${periodo.ate}"></label>
      </div>` : ''}
    <label class="busca">${ICONES.busca}<input type="search" id="busca" placeholder="Buscar (ex.: gasolina, pix, garagem)" value="${esc(estado.busca)}"></label>
    ${cats.length > 1 ? `<div class="chips-filtro" role="group" aria-label="Filtrar por categoria">
      <button type="button" class="chip-filtro ${estado.categoria ? '' : 'ativo'}" data-cat="">Todas</button>
      ${cats.map((c) => `<button type="button" class="chip-filtro ${estado.categoria === c ? 'ativo' : ''}" data-cat="${esc(c)}"
        style="--cor:${app.cor(c)}"><i></i>${esc(c)}</button>`).join('')}
    </div>` : ''}
    ${comEtiquetas ? `<div class="chips-filtro" role="group" aria-label="Filtrar por etiqueta">
      <button type="button" class="chip-filtro ${estado.etiqueta ? '' : 'ativo'}" data-etiqueta="">Todas as etiquetas</button>
      ${etiquetas.map((e) => `<button type="button" class="chip-filtro ${estado.etiqueta === e.etiqueta ? 'ativo' : ''}" data-etiqueta="${esc(e.etiqueta)}">${esc(e.etiqueta)}</button>`).join('')}
    </div>` : ''}
    <div class="totais-lista">
      <span>${filtrados.length} ${filtrados.length === 1 ? 'registro' : 'registros'}</span>
      <span>Gastos <b>${reais(gasto)}</b>${entrada ? ` · Entradas <b class="positivo">${reais(entrada)}</b>` : ''}</span>
    </div>
    ${estado.selecionando ? `
      <div class="barra-selecao" role="region" aria-label="Seleção">
        <button type="button" class="link" id="marcar-todos">${todosMarcados ? 'Desmarcar todos' : `Marcar todos (${filtrados.length})`}</button>
        <span class="sel-conta">${nMarcados ? `${nMarcados} ${nMarcados === 1 ? 'marcado' : 'marcados'}` : 'Toque para marcar'}</span>
        <button type="button" class="btn secundario" id="mudar-marcados" ${nMarcados ? '' : 'disabled'}>Mudar</button>
        <button type="button" class="btn perigo icone-so" id="apagar-marcados" ${nMarcados ? '' : 'disabled'} aria-label="Apagar marcados">${ICONES.lixo}</button>
      </div>` : ''}
    <div class="${estado.selecionando ? 'selecionando' : ''}">
    ${mostrados.length ? [...dias.entries()].map(([data, regs]) => {
      const totalDia = regs.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + r.valor, 0);
      return `
        <section class="grupo-dia">
          <div class="grupo-topo"><h3>${rotuloDia(data)}</h3><span>${reais(totalDia)}</span></div>
          <div class="lista-registros">${regs.map((r) => linhaRegistro(r, app)
            .replace('class="registro"', `class="registro${estado.marcados.has(r.id) ? ' sel-marcado' : ''}"${estado.selecionando ? ` aria-pressed="${estado.marcados.has(r.id)}"` : ''}`)).join('')}</div>
        </section>`;
    }).join('') : `<div class="vazio-grande">${doPeriodo.length ? 'Nada encontrado com esse filtro.' : 'Nenhum registro neste período.'}</div>`}
    ${filtrados.length > mostrados.length ? `
      <button type="button" class="btn secundario largo" id="mostrar-mais">Mostrar mais (${filtrados.length - mostrados.length} restantes)</button>` : ''}
    </div>`;

  const redesenhar = () => telaLancamentos(raiz, app);
  ligarSeletorMes(raiz, app);
  if (estado.selecionando) ligarSelecao(raiz, app, filtrados);
  else ligarRegistros(raiz, app);
  $('#btn-importar', raiz)?.addEventListener('click', () => enviarExtrato(app));
  $('#btn-selecionar', raiz)?.addEventListener('click', () => {
    estado.selecionando = !estado.selecionando;
    estado.marcados.clear();
    redesenhar();
  });
  $('#mostrar-mais', raiz)?.addEventListener('click', () => {
    estado.limite += PASSO;
    const y = window.scrollY;
    redesenhar();
    window.scrollTo({ top: y });
  });
  const busca = $('#busca', raiz);
  // Espera uma pausa na digitação antes de redesenhar a lista (não trava a cada letra).
  busca.addEventListener('input', () => {
    clearTimeout(estado.timer);
    estado.timer = setTimeout(() => {
      if (!busca.isConnected) return;
      estado.busca = busca.value;
      estado.limite = PASSO;
      const pos = busca.selectionStart;
      redesenhar();
      const nova = $('#busca', raiz);
      nova.focus();
      nova.setSelectionRange(pos, pos);
    }, 180);
  });
  $$('[data-periodo]', raiz).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.periodo === 'datas' && estado.periodo !== 'datas') {
      // As datas começam pelo período que estava na tela
      const hoje = iso(new Date());
      estado.de = periodo.de || `${hoje.slice(0, 4)}-01-01`;
      estado.ate = periodo.ate || hoje;
    }
    estado.periodo = b.dataset.periodo;
    estado.limite = PASSO;
    redesenhar();
  }));
  $$('input[type=date]', raiz).forEach((inp) => inp.addEventListener('change', () => {
    if (!inp.value) return;
    estado[inp.name] = inp.value;
    redesenhar();
  }));
  $$('[data-cat]', raiz).forEach((b) => b.addEventListener('click', () => {
    estado.categoria = b.dataset.cat;
    estado.etiqueta = '';
    estado.limite = PASSO;
    redesenhar();
  }));
  $$('[data-etiqueta]', raiz).forEach((b) => b.addEventListener('click', () => {
    estado.etiqueta = b.dataset.etiqueta;
    estado.limite = PASSO;
    redesenhar();
  }));
}

/** Modo seleção: tocar marca/desmarca; "Mudar" troca categoria, etiqueta ou nome; a lixeira apaga. */
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
  $('#mudar-marcados', raiz)?.addEventListener('click', () => {
    mudarVarios(filtrados.filter((r) => estado.marcados.has(r.id)), app);
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

function opcoes(lista, atual) {
  return lista.map((o) => `<option ${o === atual ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

/** Folha para mudar vários de uma vez: categoria, etiqueta e (se quiser) o nome. */
function mudarVarios(regs, app) {
  if (!regs.length) return;
  const tipos = new Set(regs.map((r) => r.tipo));
  if (tipos.size > 1) {
    aviso('Marque só gastos ou só entradas para mudar juntos', 'erro');
    return;
  }
  const tipo = regs[0].tipo;
  const cats = tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_GASTO;
  const categorias = new Set(regs.map((r) => r.categoria));
  const comum = categorias.size === 1 ? regs[0].categoria : '';
  const etiquetasMarcadas = new Set(regs.map((r) => etiquetaDe(r)));
  const etiquetaComum = comum && etiquetasMarcadas.size === 1 ? [...etiquetasMarcadas][0] : null;
  const nomes = new Set(regs.map((r) => r.item));
  const total = regs.reduce((s, r) => s + r.valor, 0);

  abrirFolha(`Mudar ${regs.length} ${regs.length === 1 ? 'registro' : 'registros'}`, `
    <form class="formulario" id="form-varios">
      <p class="dica">${reais(total)} no total${categorias.size > 1 ? `, em ${categorias.size} categorias` : ` em ${esc(comum)}`}.</p>
      <label class="campo">Categoria<select name="categoria" required>
        ${comum ? '' : '<option value="" selected disabled>Escolha</option>'}${opcoes(cats, comum)}</select></label>
      <div class="campo-etiqueta" id="varios-etiqueta">${campoEtiqueta(comum, etiquetaComum)}</div>
      <label class="campo">Nome<input name="item" placeholder="${nomes.size === 1 ? esc([...nomes][0]) : 'manter o de cada um'}" autocomplete="off"></label>
      <div class="acoes-folha">
        <button type="submit" class="btn primario">Mudar ${regs.length}</button>
      </div>
    </form>`, (folha, fechar) => {
    const selCat = $('select[name=categoria]', folha);
    selCat.addEventListener('change', () => {
      const cat = selCat.value;
      const sugerida = cat === comum ? etiquetaComum : (nomes.size === 1 && store.sugerirEtiqueta(regs[0].item, cat, regs[0].textoOriginal)) || etiquetaDe({ categoria: cat });
      $('#varios-etiqueta', folha).innerHTML = campoEtiqueta(cat, sugerida);
    });
    $('#form-varios', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const categoria = f.get('categoria');
      if (!categoria) {
        aviso('Escolha a categoria', 'erro');
        return;
      }
      const etiqueta = etiquetasDe(categoria).length ? f.get('etiqueta') || null : null;
      const item = String(f.get('item') || '').trim();
      const campos = { categoria, etiqueta, ...(item ? { item } : {}) };
      try {
        await store.atualizarVarios(regs.map((r) => r.id), campos);
        // Mudou a categoria: da próxima vez, os mesmos nomes já vão para ela
        const nomesNovos = item ? [item] : [...nomes];
        if (nomesNovos.length <= 10) {
          for (const n of nomesNovos) if (!categorias.has(categoria) || categorias.size > 1) await store.aprenderRegra(n, categoria);
        }
        fechar();
        estado.marcados.clear();
        estado.selecionando = false;
        aviso(`${regs.length} ${regs.length === 1 ? 'registro agora está' : 'registros agora estão'} em ${categoria}${etiqueta ? ` › ${etiqueta}` : ''} ✓`);
        app.render();
      } catch (err) {
        aviso(`Não salvou: ${err.message}`, 'erro');
      }
    });
  });
}
