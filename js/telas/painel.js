// Painel: para onde foi o dinheiro, comparação entre meses, limites e dicas.
import { resumoMes, historicoMeses, statusLimites, resumoSemana, dicas, porLocal, nomeMes, somarMesesMes, mesDe, iso } from '../analise.js';
import { store } from '../store.js';
import { $$, esc, reais, pct, dataCurta, ICONES } from '../util.js';
import { rosca, barrasMeses, progresso, estadoLimite } from '../graficos.js';
import { bolinha, linhaRegistro, ligarRegistros } from './registro.js';
import { seletorMes, ligarSeletorMes } from './lancamentos.js';

const ROTULO_ESTADO = {
  ok: { texto: 'dentro do limite', icone: ICONES.ok },
  atencao: { texto: 'atenção', icone: ICONES.alerta },
  estourou: { texto: 'passou do limite', icone: ICONES.alerta },
};

export function telaPainel(raiz, app) {
  const hoje = new Date();
  const registros = store.listar();
  const r = resumoMes(registros, app.mes, hoje);
  const limites = new Map(statusLimites(registros, store.orcamentos(), app.mes, hoje).map((l) => [l.categoria, l]));
  const historico = historicoMeses(registros, app.mes, 6, hoje);
  const atual = mesDe(iso(hoje));
  const ehAtual = app.mes === atual;

  const fatias = r.categorias.map((c) => ({ ...c, cor: app.cor(c.categoria) }));
  const anterior = nomeMes(somarMesesMes(app.mes, -1), { ano: false });
  const variacao = r.variacao === null ? '<span class="dica-inline">sem dados do mês anterior</span>'
    : `<span class="variacao ${r.variacao > 0 ? 'subiu' : 'caiu'}">${r.variacao > 0 ? '↑' : '↓'} ${pct(Math.abs(r.variacao))}</span>
       <span class="dica-inline">vs. ${anterior}${ehAtual ? ` até o dia ${r.dia}` : ''}</span>`;

  // Categorias com limite mas sem gasto também aparecem na lista
  const linhasCat = [...fatias];
  for (const [cat] of limites) if (!linhasCat.some((f) => f.categoria === cat)) linhasCat.push({ categoria: cat, valor: 0, cor: app.cor(cat) });

  const listaCategorias = linhasCat.map((c) => {
    const l = limites.get(c.categoria);
    const fracao = r.gasto > 0 ? c.valor / r.gasto : 0;
    return `
      <li class="cat-linha" data-categoria="${esc(c.categoria)}">
        <div class="cat-topo">
          ${bolinha(c.categoria, app)}
          <span class="cat-nome">${esc(c.categoria)}</span>
          <span class="cat-valor"><b>${reais(c.valor)}</b><small>${c.valor > 0 ? pct(fracao) : ''}</small></span>
        </div>
        ${l ? `
          ${progresso(l.gasto / l.limite, estadoLimite(l.gasto / l.limite), `${c.categoria}: ${pct(l.gasto / l.limite)} do limite`, { marca: true })}
          <div class="cat-limite ${l.estado}">${ROTULO_ESTADO[l.estado].icone}
            <span>${l.estado === 'estourou' ? `${reais(-l.restante, { centavos: false })} acima` : `sobram ${reais(l.restante, { centavos: false })}`}
            de ${reais(l.limite, { centavos: false })}${ehAtual && l.estado === 'atencao' && l.projecao > l.limite ? ` · previsão ${reais(l.projecao, { centavos: false })}` : ''}</span></div>` : ''}
      </li>`;
  }).join('');

  const listaDicas = ehAtual ? dicas(registros, store.orcamentos(), hoje) : [];
  const semana = ehAtual ? resumoSemana(registros, hoje) : null;
  const locais = porLocal(registros, app.mes, hoje);
  const futuras = registros.filter((x) => x.parcela && x.data > iso(hoje)).sort((a, b) => a.data.localeCompare(b.data));
  const totalFuturas = futuras.reduce((s, x) => s + x.valor, 0);

  raiz.innerHTML = `
    <div class="barra-ferramentas">${seletorMes(app.mes)}</div>

    <section class="kpis">
      <div class="kpi"><span>Gastos</span><b>${reais(r.gasto, { centavos: false })}</b><div class="kpi-sub">${variacao}</div></div>
      <div class="kpi"><span>Entradas</span><b class="positivo">${reais(r.entrada, { centavos: false })}</b></div>
      <div class="kpi"><span>Saldo</span><b class="${r.saldo < 0 ? 'negativo' : ''}">${reais(r.saldo, { centavos: false })}</b>
        ${r.entrada > 0 ? `<div class="kpi-sub"><span class="dica-inline">guardou ${pct(Math.max(r.saldo, 0) / r.entrada)} do que entrou</span></div>` : ''}</div>
      ${ehAtual ? `<div class="kpi"><span>Previsão do mês</span><b>${reais(r.projecao, { centavos: false })}</b>
        <div class="kpi-sub"><span class="dica-inline">no ritmo de ${reais(r.gasto / Math.max(r.dia, 1), { centavos: false })}/dia</span></div></div>` : ''}
    </section>

    <section class="cartao">
      <div class="cartao-topo"><h2>Para onde foi o dinheiro</h2></div>
      ${fatias.length ? `
        <div class="rosca-area">${rosca(fatias, r.gasto)}</div>
        <ul class="lista-categorias">${listaCategorias}</ul>`
        : '<p class="vazio">Sem gastos neste mês.</p>'}
    </section>

    ${locais.length ? `
    <section class="cartao">
      <div class="cartao-topo"><h2>Onde você mais gastou</h2></div>
      <ul class="lista-cats lista-locais">${locais.slice(0, 5).map((l) => `
        <li>${bolinha(l.categoria, app)}<span>${esc(l.local)}<small>${l.vezes} ${l.vezes === 1 ? 'vez' : 'vezes'}</small></span><b>${reais(l.valor)}</b></li>`).join('')}</ul>
    </section>` : ''}

    <section class="cartao">
      <div class="cartao-topo"><h2>Gastos por mês</h2><span class="dica">toque num mês</span></div>
      <div class="barras-area">${barrasMeses(historico, app.mes)}</div>
    </section>

    ${listaDicas.length ? `
    <section class="cartao">
      <div class="cartao-topo"><h2>Onde dá pra economizar</h2></div>
      <ul class="dicas">${listaDicas.map((d) => `
        <li class="dica-item ${d.tipo}"><span class="dica-icone" aria-hidden="true">${d.tipo === 'limite' || d.tipo === 'saldo' ? ICONES.alerta : ICONES.ideia}</span>
          <div><b>${esc(d.titulo)}</b><p>${esc(d.texto)}</p></div></li>`).join('')}</ul>
    </section>` : ''}

    ${semana && semana.total > 0 ? `
    <section class="cartao">
      <div class="cartao-topo"><h2>Semana passada <span class="sub">${dataCurta(semana.inicio)} a ${dataCurta(semana.fim)}</span></h2><b>${reais(semana.total)}</b></div>
      ${semana.variacao !== null ? `<p class="linha-pequena"><span class="variacao ${semana.variacao > 0 ? 'subiu' : 'caiu'}">${semana.variacao > 0 ? '↑' : '↓'} ${pct(Math.abs(semana.variacao))}</span> vs. a semana anterior (${reais(semana.totalAnterior)})</p>` : ''}
      <ul class="lista-cats">${semana.categorias.slice(0, 4).map((c) => `
        <li>${bolinha(c.categoria, app)}<span>${esc(c.categoria)}</span><b>${reais(c.valor)}</b></li>`).join('')}</ul>
      ${semana.maiores.length ? `<p class="dica">Maiores gastos: ${semana.maiores.map((m) => `${esc(m.item)} (${reais(m.valor, { centavos: false })})`).join(', ')}</p>` : ''}
    </section>` : ''}

    ${futuras.length ? `
    <section class="cartao">
      <div class="cartao-topo"><h2>Parcelas futuras</h2><b>${reais(totalFuturas)}</b></div>
      <div class="lista-registros">${futuras.slice(0, 12).map((x) => linhaRegistro(x, app, { mostrarData: true })).join('')}</div>
    </section>` : ''}`;

  ligarSeletorMes(raiz, app);
  ligarRegistros(raiz, app);
  $$('.barra-mes', raiz).forEach((g) => {
    const ir = () => { app.mes = g.dataset.mes; app.render(); };
    g.addEventListener('click', ir);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ir(); } });
  });
  // Tocar numa fatia destaca a linha da categoria (e vice-versa)
  const destacar = (cat) => {
    $$('.fatia', raiz).forEach((f) => f.classList.toggle('apagada', cat && f.dataset.categoria !== cat));
    $$('.cat-linha', raiz).forEach((l) => l.classList.toggle('ativa', l.dataset.categoria === cat));
  };
  let ativa = null;
  const alternar = (cat) => { ativa = ativa === cat ? null : cat; destacar(ativa); };
  $$('.fatia', raiz).forEach((f) => f.addEventListener('click', () => alternar(f.dataset.categoria)));
  $$('.cat-linha', raiz).forEach((l) => l.addEventListener('click', () => alternar(l.dataset.categoria)));
}
