// Painel: resumo do mês, categorias (com os limites), faturas e os últimos meses.
import { resumoMes, historicoMeses, statusLimites, mesDe, iso, nomeMes, PERIODOS, periodoDatas, gastosDaCategoria } from '../analise.js';
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

  // Categorias com limite mas sem gasto também aparecem na lista
  const linhasCat = r.categorias.map((c) => ({ ...c }));
  for (const [cat] of limites) if (!linhasCat.some((f) => f.categoria === cat)) linhasCat.push({ categoria: cat, valor: 0 });

  const subLimite = (c) => {
    const l = limites.get(c.categoria);
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
      <span class="cat-valor"><b>${reais(c.valor)}</b>${c.valor > 0 && r.gasto > 0 ? `<small>${pct(c.valor / r.gasto)}</small>` : ''}</span>
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
      <div class="cartao-topo"><h2>Categorias</h2></div>
      ${r.gasto > 0 ? barraCategorias(r.categorias.map((c) => ({ ...c, cor: app.cor(c.categoria) }))) : ''}
      ${linhasCat.length ? `<ul class="lista-categorias">${listaCategorias}</ul>` : '<p class="vazio">Sem gastos neste mês.</p>'}
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
  $$('.barra-mes', raiz).forEach((g) => {
    const ir = () => { app.mes = g.dataset.mes; app.render(); };
    g.addEventListener('click', ir);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } });
  });
}

// Período escolhido na última vez (vale para todas as categorias enquanto o app está aberto).
const escolha = { id: 'mes', de: '', ate: '' };

const dataCurta = (d) => d.split('-').reverse().join('/');
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Folha com todos os gastos de uma categoria no período, do maior valor para o menor. */
export function abrirCategoria(categoria, app) {
  abrirFolha(categoria, '', (folha) => desenharCategoria($('.folha-corpo', folha), categoria, app));
}

// Redesenha só o miolo da folha (trocar o período não fecha e reabre a folha).
function desenharCategoria(corpo, categoria, app) {
  const hoje = new Date();
  const periodo = periodoDatas(escolha.id, { mes: app.mes, hoje, de: escolha.de, ate: escolha.ate });
  const { lista, total } = gastosDaCategoria(store.listar(), categoria, periodo);
  const rotulo = escolha.id === 'mes' ? maiuscula(nomeMes(app.mes))
    : escolha.id === 'tudo' ? 'Tudo até hoje' : `${dataCurta(periodo.de)} a ${dataCurta(periodo.ate)}`;
  const chips = PERIODOS.map((p) => `
    <button type="button" class="chip-filtro ${escolha.id === p.id ? 'ativo' : ''}" data-periodo="${p.id}">${
      esc(p.id === 'mes' ? maiuscula(nomeMes(app.mes, { ano: false })) : p.nome)}</button>`).join('');
  // Ao editar um gasto daqui, volta para esta lista (já atualizada) em vez de cair no painel.
  const appVolta = { ...app, render() { app.render(); abrirCategoria(categoria, app); } };

  corpo.innerHTML = `
    <div class="cat-detalhe">
      <div class="chips-filtro" role="group" aria-label="Período">${chips}</div>
      ${escolha.id === 'datas' ? `
        <div class="dupla">
          <label class="campo">De<input type="date" name="de" value="${periodo.de}"></label>
          <label class="campo">Até<input type="date" name="ate" value="${periodo.ate}"></label>
        </div>` : ''}
      <div class="totais-lista">
        <span>${esc(rotulo)} · ${lista.length} ${lista.length === 1 ? 'gasto' : 'gastos'}</span>
        <span>Total <b>${reais(total)}</b></span>
      </div>
      ${lista.length
        ? `<div class="lista-registros">${lista.map((x) => linhaRegistro(x, app, { mostrarData: true })).join('')}</div>`
        : '<p class="vazio">Nenhum gasto nesta categoria no período.</p>'}
    </div>`;
  const redesenhar = () => {
    const chipsAntes = $('.chips-filtro', corpo).scrollLeft;
    desenharCategoria(corpo, categoria, app);
    $('.chips-filtro', corpo).scrollLeft = chipsAntes;
  };
  ligarRegistros(corpo, appVolta);
  $$('[data-periodo]', corpo).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.periodo === 'datas' && escolha.id !== 'datas') {
      // As datas começam pelo período que estava na tela
      escolha.de = periodo.de === '0000-01-01' ? `${periodo.ate.slice(0, 4)}-01-01` : periodo.de;
      escolha.ate = periodo.ate;
    }
    escolha.id = b.dataset.periodo;
    redesenhar();
  }));
  $$('input[type=date]', corpo).forEach((inp) => inp.addEventListener('change', () => {
    if (!inp.value) return;
    escolha[inp.name] = inp.value;
    redesenhar();
  }));
}
