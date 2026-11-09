// Painel: resumo do mês, categorias (com os limites), faturas e os últimos meses.
import { resumoMes, historicoMeses, statusLimites, mesDe, iso } from '../analise.js';
import { store } from '../store.js';
import { $$, esc, reais, pct, valorHero } from '../util.js';
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

  const listaCategorias = linhasCat.map((c) => `
    <li class="cat-linha">
      ${bolinha(c.categoria, app)}
      <span class="cat-meio"><span class="cat-nome">${esc(c.categoria)}</span>${subLimite(c)}</span>
      <span class="cat-valor"><b>${reais(c.valor)}</b>${c.valor > 0 && r.gasto > 0 ? `<small>${pct(c.valor / r.gasto)}</small>` : ''}</span>
    </li>`).join('');

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
  $$('.barra-mes', raiz).forEach((g) => {
    const ir = () => { app.mes = g.dataset.mes; app.render(); };
    g.addEventListener('click', ir);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } });
  });
}
