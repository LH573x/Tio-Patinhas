// Painel: resumo do mês, categorias (com os limites), faturas e os últimos meses.
import { resumoMes, historicoMeses, statusLimites, mesDe, iso, nomeMes, PERIODOS, periodoDatas, gastosDaCategoria, porCategoria, porEtiqueta, daEtiqueta, SEM_ETIQUETA } from '../analise.js';
import { store } from '../store.js';
import { $, $$, esc, reais, pct, valorHero, abrirFolha, ICONES } from '../util.js';
import { barrasMeses, barraCategorias } from '../graficos.js';
import { bolinha, linhaRegistro, ligarRegistros } from './registro.js';
import { seletorMes, ligarSeletorMes } from './lancamentos.js';
import { cardFaturas, ligarFaturas } from './cartoes.js';

const semMoeda = (v) => reais(v, { centavos: false }).replace(/R\$\s*/, '');

export function telaPainel(raiz, app) {
  const hoje = new Date();
  const registros = store.listar();
  const r = resumoMes(registros, app.mes, hoje, { contas: store.contas() });
  const limites = new Map(statusLimites(registros, store.orcamentos(), app.mes, hoje).map((l) => [l.categoria, l]));
  const historico = historicoMeses(registros, app.mes, 6, hoje);
  const ehAtual = app.mes === mesDe(iso(hoje));

  // Categorias no período escolhido (o mesmo período da lista de cada categoria).
  const noMes = escolha.id === 'mes';
  const periodo = periodoDatas(escolha.id, { mes: app.mes, hoje, de: escolha.de, ate: escolha.ate });
  const categorias = noMes ? r.categorias
    : porCategoria(registros.filter((x) => x.tipo === 'gasto' && x.data >= periodo.de && x.data <= periodo.ate));
  const totalCat = noMes ? r.gasto : categorias.reduce((s, c) => s + c.valor, 0);
  // Categorias com limite mas sem gasto também aparecem na lista (os limites são do mês)
  const linhasCat = categorias.map((c) => ({ ...c }));
  if (noMes) for (const [cat] of limites) if (!linhasCat.some((f) => f.categoria === cat)) linhasCat.push({ categoria: cat, valor: 0 });
  const chipsPeriodo = PERIODOS.map((p) => `
    <button type="button" class="chip-filtro ${escolha.id === p.id ? 'ativo' : ''}" data-periodo-painel="${p.id}">${
      esc(p.id === 'mes' ? maiuscula(nomeMes(app.mes, { ano: false })) : p.nome)}</button>`).join('');

  const subLimite = (c) => {
    const l = noMes && limites.get(c.categoria);
    if (!l) return '';
    const lim = reais(l.limite, { centavos: false });
    if (l.estado === 'estourou') return `<span class="cat-sub estourou-texto">${reais(-l.restante, { centavos: false })} acima dos ${lim}</span>`;
    if (ehAtual && l.projecao > l.limite) return `<span class="cat-sub alerta-texto">Vai passar dos ${lim}</span>`;
    return `<span class="cat-sub">de ${lim}</span>`;
  };

  // Cada categoria abre a lista dos gastos dela (maior valor primeiro), com período à escolha.
  const listaCategorias = linhasCat.map((c) => `
    <li><button type="button" class="cat-linha" data-categoria="${esc(c.categoria)}">
      ${bolinha(c.categoria, app)}
      <span class="cat-meio"><span class="cat-nome">${esc(c.categoria)}</span>${subLimite(c)}</span>
      <span class="cat-valor"><b>${reais(c.valor)}</b>${c.valor > 0 && totalCat > 0 ? `<small>${pct(c.valor / totalCat)}</small>` : ''}</span>
      <span class="cat-seta" aria-hidden="true">${ICONES.avancar}</span>
    </button></li>`).join('');

  const futuras = registros.filter((x) => x.parcela && x.data > iso(hoje)).sort((a, b) => a.data.localeCompare(b.data));
  const totalFuturas = futuras.reduce((s, x) => s + x.valor, 0);

  raiz.innerHTML = `
    <div class="barra-ferramentas">${seletorMes(app.mes)}</div>

    <section class="destaque-mes">
      <div class="rotulo-mes">Gastos</div>
      <div class="valor-grande">${valorHero(r.gasto, { centavos: false })}</div>
      <div class="resumo-tres">
        <div><span>Entradas</span><b>${semMoeda(r.entrada)}</b></div>
        <div><span>Saldo</span><b class="${r.saldo < 0 ? 'negativo' : 'positivo'}">${r.saldo > 0 ? '+' : ''}${semMoeda(r.saldo)}</b></div>
        ${ehAtual ? `<div><span>Previsão</span><b>${semMoeda(r.projecao)}</b></div>` : ''}
      </div>
    </section>

    <section class="cartao">
      <div class="cartao-topo"><h2>Categorias</h2>${noMes ? '' : `<span class="total">${reais(totalCat)}</span>`}</div>
      <div class="chips-filtro" role="group" aria-label="Período das categorias">${chipsPeriodo}</div>
      ${escolha.id === 'datas' ? `
        <div class="dupla">
          <label class="campo">De<input type="date" name="de" data-datas-painel value="${periodo.de}"></label>
          <label class="campo">Até<input type="date" name="ate" data-datas-painel value="${periodo.ate}"></label>
        </div>` : ''}
      ${totalCat > 0 ? barraCategorias(categorias.map((c) => ({ ...c, cor: app.cor(c.categoria) }))) : ''}
      ${linhasCat.length ? `<ul class="lista-categorias">${listaCategorias}</ul>` : `<p class="vazio">Sem gastos ${noMes ? 'neste mês' : 'neste período'}.</p>`}
    </section>

    ${ehAtual ? cardFaturas(app) : ''}

    <section class="cartao">
      <div class="cartao-topo"><h2>Últimos meses</h2></div>
      <div class="barras-area">${barrasMeses(historico, app.mes)}</div>
    </section>

    ${futuras.length ? `
    <section class="cartao">
      <div class="cartao-topo"><h2>Parcelas futuras</h2><span class="total">${reais(totalFuturas)}</span></div>
      <div class="lista-registros">${futuras.slice(0, 12).map((x) => linhaRegistro(x, app, { mostrarData: true })).join('')}</div>
    </section>` : ''}`;

  ligarSeletorMes(raiz, app);
  ligarFaturas(raiz, app);
  ligarRegistros(raiz, app);
  $$('.cat-linha[data-categoria]', raiz).forEach((b) => b.addEventListener('click', () => abrirCategoria(b.dataset.categoria, app)));
  $$('[data-periodo-painel]', raiz).forEach((b) => b.addEventListener('click', () => {
    escolherPeriodo(b.dataset.periodoPainel, periodo);
    const rolagem = b.parentElement.scrollLeft;
    app.render();
    const chips = $('[data-periodo-painel]', raiz)?.parentElement;
    if (chips) chips.scrollLeft = rolagem;
  }));
  $$('[data-datas-painel]', raiz).forEach((inp) => inp.addEventListener('change', () => {
    if (!inp.value) return;
    escolha[inp.name] = inp.value;
    app.render();
  }));
  $$('.barra-mes', raiz).forEach((g) => {
    const ir = () => { app.mes = g.dataset.mes; app.render(); };
    g.addEventListener('click', ir);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } });
  });
}

// Período escolhido na última vez (vale para todas as categorias enquanto o app está aberto).
// A etiqueta vale só para a categoria aberta.
const escolha = { id: 'mes', de: '', ate: '', etiqueta: '' };

const dataCurta = (d) => d.split('-').reverse().join('/');

// Troca o período; "Escolher datas" começa pelo período que estava na tela.
function escolherPeriodo(id, periodo) {
  if (id === 'datas' && escolha.id !== 'datas') {
    escolha.de = periodo.de === '0000-01-01' ? `${periodo.ate.slice(0, 4)}-01-01` : periodo.de;
    escolha.ate = periodo.ate;
  }
  escolha.id = id;
}
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Folha com todos os gastos de uma categoria no período, do maior valor para o menor. */
export function abrirCategoria(categoria, app, { etiqueta = '' } = {}) {
  escolha.etiqueta = etiqueta;
  abrirFolha(categoria, '', (folha) => desenharCategoria($('.folha-corpo', folha), categoria, app));
}

// Redesenha só o miolo da folha (trocar o período não fecha e reabre a folha).
function desenharCategoria(corpo, categoria, app) {
  const hoje = new Date();
  const periodo = periodoDatas(escolha.id, { mes: app.mes, hoje, de: escolha.de, ate: escolha.ate });
  const daCategoria = gastosDaCategoria(store.listar(), categoria, periodo);
  // Etiquetas (ex.: Namorada › Viagem): quanto foi em cada uma, e tocar filtra a lista.
  const etiquetas = porEtiqueta(daCategoria.lista, categoria);
  const comEtiquetas = etiquetas.some((e) => e.etiqueta !== SEM_ETIQUETA);
  if (escolha.etiqueta && !etiquetas.some((e) => e.etiqueta === escolha.etiqueta)) escolha.etiqueta = '';
  const lista = escolha.etiqueta ? daEtiqueta(daCategoria.lista, escolha.etiqueta) : daCategoria.lista;
  const total = escolha.etiqueta ? etiquetas.find((e) => e.etiqueta === escolha.etiqueta).valor : daCategoria.total;
  const chipsEtiqueta = comEtiquetas ? `
      <div class="chips-filtro" role="group" aria-label="Etiqueta">
        <button type="button" class="chip-filtro ${escolha.etiqueta ? '' : 'ativo'}" data-etiqueta="">Todas</button>
        ${etiquetas.map((e) => `<button type="button" class="chip-filtro ${escolha.etiqueta === e.etiqueta ? 'ativo' : ''}" data-etiqueta="${esc(e.etiqueta)}">${
          esc(e.etiqueta)} · ${reais(e.valor, { centavos: false })}</button>`).join('')}
      </div>` : '';
  const rotulo = escolha.id === 'mes' ? maiuscula(nomeMes(app.mes))
    : escolha.id === 'tudo' ? 'Tudo até hoje' : `${dataCurta(periodo.de)} a ${dataCurta(periodo.ate)}`;
  const chips = PERIODOS.map((p) => `
    <button type="button" class="chip-filtro ${escolha.id === p.id ? 'ativo' : ''}" data-periodo="${p.id}">${
      esc(p.id === 'mes' ? maiuscula(nomeMes(app.mes, { ano: false })) : p.nome)}</button>`).join('');
  // Ao editar um gasto daqui, volta para esta lista (já atualizada) em vez de cair no painel.
  const appVolta = { ...app, render() { app.render(); abrirCategoria(categoria, app, { etiqueta: escolha.etiqueta }); } };

  corpo.innerHTML = `
    <div class="cat-detalhe">
      <div class="chips-filtro" role="group" aria-label="Período">${chips}</div>${chipsEtiqueta}
      ${escolha.id === 'datas' ? `
        <div class="dupla">
          <label class="campo">De<input type="date" name="de" value="${periodo.de}"></label>
          <label class="campo">Até<input type="date" name="ate" value="${periodo.ate}"></label>
        </div>` : ''}
      <div class="totais-lista">
        <span>${esc(rotulo)}${escolha.etiqueta ? ` · ${esc(escolha.etiqueta)}` : ''} · ${lista.length} ${lista.length === 1 ? 'gasto' : 'gastos'}</span>
        <span>Total <b>${reais(total)}</b></span>
      </div>
      ${lista.length
        ? `<div class="lista-registros">${lista.map((x) => linhaRegistro(x, app, { mostrarData: true })).join('')}</div>`
        : '<p class="vazio">Nenhum gasto nesta categoria no período.</p>'}
    </div>`;
  const redesenhar = () => {
    const rolagem = $$('.chips-filtro', corpo).map((c) => c.scrollLeft);
    desenharCategoria(corpo, categoria, app);
    $$('.chips-filtro', corpo).forEach((c, i) => { c.scrollLeft = rolagem[i] || 0; });
  };
  ligarRegistros(corpo, appVolta);
  $$('[data-periodo]', corpo).forEach((b) => b.addEventListener('click', () => {
    escolherPeriodo(b.dataset.periodo, periodo);
    redesenhar();
  }));
  $$('[data-etiqueta]', corpo).forEach((b) => b.addEventListener('click', () => {
    escolha.etiqueta = b.dataset.etiqueta;
    redesenhar();
  }));
  $$('input[type=date]', corpo).forEach((inp) => inp.addEventListener('change', () => {
    if (!inp.value) return;
    escolha[inp.name] = inp.value;
    redesenhar();
  }));
}
