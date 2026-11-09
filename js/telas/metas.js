// Contas fixas, cartões, limites por categoria e metas de economia.
import { CATEGORIAS_GASTO } from '../parser.js';
import { statusLimites, resumoMes, historicoMeses, planoMeta, mesDe, iso, nomeMes, somarMesesMes, doMes } from '../analise.js';
import { store } from '../store.js';
import { $, $$, esc, reais, pct, abrirFolha, confirmar, aviso, lerNumero, numeroParaCampo, ICONES, avisoBanco } from '../util.js';
import { cardContas, ligarContas } from './contas.js';
import { cardCartoes, ligarCartoes } from './cartoes.js';
import { progresso, estadoLimite } from '../graficos.js';
import { bolinha } from './registro.js';

function mediaCategoria(categoria) {
  const atual = mesDe(iso(new Date()));
  const valores = [1, 2, 3].map((i) => doMes(store.listar(), somarMesesMes(atual, -i))
    .filter((r) => r.tipo === 'gasto' && r.categoria === categoria)
    .reduce((s, r) => s + r.valor, 0)).filter((v) => v > 0);
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
}

function editarLimite(categoria, app) {
  const atual = store.orcamentos().find((o) => o.categoria === categoria);
  const media = mediaCategoria(categoria);
  abrirFolha(`Limite de ${categoria}`, `
    <form class="formulario" id="form-limite">
      <label class="campo">Quanto quer gastar por mês, no máximo?
        <input name="limite" inputmode="decimal" placeholder="ex.: 400" value="${atual ? numeroParaCampo(atual.limite) : ''}">
      </label>
      ${media > 0 ? `<p class="dica">Nos últimos meses você gastou, em média, <b>${reais(media, { centavos: false })}</b> por mês aqui.
        <button type="button" class="link" id="usar-media">Usar ${reais(Math.round(media * 0.9 / 10) * 10, { centavos: false })} (10% a menos)</button></p>` : ''}
      <div class="acoes-folha">
        ${atual ? '<button type="button" class="btn perigo-texto" id="remover-limite">Tirar limite</button>' : ''}
        <button type="submit" class="btn primario">Salvar</button>
      </div>
    </form>`, (folha, fechar) => {
    const salvar = async (valor) => {
      try {
        await store.salvarLimite(categoria, valor);
        fechar();
        aviso(valor ? `Limite de ${categoria}: ${reais(valor, { centavos: false })} ✓` : 'Limite removido');
        app.render();
      } catch (e) {
        aviso(`Não salvou: ${e.message}`, 'erro');
      }
    };
    $('#form-limite', folha).addEventListener('submit', (e) => {
      e.preventDefault();
      const v = lerNumero(new FormData(e.target).get('limite'));
      if (v === null || v < 0) { aviso('Digite um valor, ex.: 400', 'erro'); return; }
      salvar(v);
    });
    $('#usar-media', folha)?.addEventListener('click', () => {
      $('input[name=limite]', folha).value = String(Math.round(media * 0.9 / 10) * 10);
    });
    $('#remover-limite', folha)?.addEventListener('click', () => salvar(0));
  });
}

function editarMeta(meta, app) {
  const nova = !meta;
  const m = meta || { nome: '', valor_alvo: '', valor_atual: 0, prazo: '' };
  abrirFolha(nova ? 'Nova meta' : 'Editar meta', `
    <form class="formulario" id="form-meta">
      <label class="campo">Nome<input name="nome" required placeholder="ex.: Viagem de férias" value="${esc(m.nome)}"></label>
      <div class="dupla">
        <label class="campo">Quanto quer juntar<input name="alvo" inputmode="decimal" required placeholder="3000" value="${numeroParaCampo(m.valor_alvo)}"></label>
        <label class="campo">Já tem guardado<input name="atual" inputmode="decimal" placeholder="0" value="${numeroParaCampo(m.valor_atual)}"></label>
      </div>
      <label class="campo">Até quando? (opcional)<input name="prazo" type="date" value="${m.prazo || ''}"></label>
      <div class="acoes-folha">
        ${nova ? '' : '<button type="button" class="btn perigo-texto" id="apagar-meta">Apagar</button>'}
        <button type="submit" class="btn primario">${nova ? 'Criar meta' : 'Salvar'}</button>
      </div>
    </form>`, (folha, fechar) => {
    $('#form-meta', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const alvo = lerNumero(f.get('alvo'));
      if (!alvo || alvo <= 0) { aviso('Diga quanto quer juntar', 'erro'); return; }
      try {
        await store.salvarMeta({ id: m.id, nome: f.get('nome').trim(), valor_alvo: alvo, valor_atual: lerNumero(f.get('atual')) || 0, prazo: f.get('prazo') || null });
        fechar();
        aviso(nova ? 'Meta criada ✓' : 'Meta salva ✓');
        app.render();
      } catch (err) {
        aviso(`Não salvou: ${err.message}`, 'erro');
      }
    });
    $('#apagar-meta', folha)?.addEventListener('click', async () => {
      if (!(await confirmar(`Apagar a meta “${m.nome}”?`, { sim: 'Apagar', perigo: true }))) return;
      try {
        await store.removerMeta(m.id);
        aviso('Meta apagada');
        app.render();
      } catch (err) {
        aviso(err.message, 'erro');
      }
    });
  });
}

function guardar(meta, app) {
  abrirFolha(`Guardar em “${meta.nome}”`, `
    <form class="formulario" id="form-guardar">
      <label class="campo">Quanto você guardou?<input name="valor" inputmode="decimal" placeholder="ex.: 200" required></label>
      <p class="dica">Pra tirar dinheiro da meta, use um valor negativo (ex.: -100).</p>
      <div class="acoes-folha"><button type="submit" class="btn primario largo">Guardar</button></div>
    </form>`, (folha, fechar) => {
    $('#form-guardar', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = lerNumero(new FormData(e.target).get('valor'));
      if (!v) { aviso('Digite um valor', 'erro'); return; }
      try {
        const salva = await store.salvarMeta({ ...meta, valor_atual: Math.max(meta.valor_atual + v, 0) });
        fechar();
        aviso(salva.valor_atual >= salva.valor_alvo ? `Meta “${meta.nome}” alcançada! 🎉` : `Guardado ✓ Faltam ${reais(salva.valor_alvo - salva.valor_atual, { centavos: false })}`);
        app.render();
      } catch (err) {
        aviso(`Não salvou: ${err.message}`, 'erro');
      }
    });
  });
}

export function telaMetas(raiz, app) {
  const hoje = new Date();
  const mes = mesDe(iso(hoje));
  const registros = store.listar();
  const status = new Map(statusLimites(registros, store.orcamentos(), mes, hoje).map((s) => [s.categoria, s]));
  const r = resumoMes(registros, mes, hoje);
  const gastoCat = new Map(r.categorias.map((c) => [c.categoria, c.valor]));
  const totalLimites = [...status.values()].reduce((s, l) => s + l.limite, 0);
  const metas = store.metas();
  const hist = historicoMeses(registros, somarMesesMes(mes, -1), 3);
  const sobraMedia = hist.filter((h) => h.entrada > 0).map((h) => h.entrada - h.gasto);
  const mediaSobra = sobraMedia.length ? sobraMedia.reduce((a, b) => a + b, 0) / sobraMedia.length : null;

  raiz.innerHTML = `
    ${avisoBanco(store.bancoDesatualizado)}
    ${cardContas(app)}
    ${cardCartoes(app)}
    <section class="cartao">
      <div class="cartao-topo"><h2>Limites de ${nomeMes(mes, { ano: false })}</h2>
        ${totalLimites ? `<span class="dica">${reais(r.gasto, { centavos: false })} de ${reais(totalLimites, { centavos: false })}</span>` : ''}</div>
      <p class="dica">Defina quanto quer gastar por mês em cada categoria. O app avisa quando estiver chegando perto.</p>
      <ul class="lista-limites">${CATEGORIAS_GASTO.map((c) => {
        const s = status.get(c);
        const gasto = gastoCat.get(c) || 0;
        return `
          <li><button type="button" class="limite-linha" data-cat="${esc(c)}">
            <div class="cat-topo">${bolinha(c, app)}<span class="cat-nome">${esc(c)}</span>
              <span class="cat-valor">${s ? `<b>${reais(gasto, { centavos: false })}</b><small>de ${reais(s.limite, { centavos: false })}</small>`
                : `<span class="definir">${ICONES.mais}Definir</span>`}</span></div>
            ${s ? progresso(gasto / s.limite, estadoLimite(gasto / s.limite), `${c}: ${pct(gasto / s.limite)} do limite`, { marca: true }) : ''}
          </button></li>`;
      }).join('')}</ul>
    </section>

    <section class="cartao">
      <div class="cartao-topo"><h2>Metas de economia</h2>
        <button type="button" class="chip-acao" id="nova-meta">${ICONES.mais}Nova meta</button></div>
      ${mediaSobra !== null ? `<p class="dica">Nos últimos meses sobraram, em média, <b class="${mediaSobra < 0 ? 'negativo' : 'positivo'}">${reais(mediaSobra, { centavos: false })}</b> por mês.</p>` : ''}
      ${metas.length ? `<ul class="lista-metas">${metas.map((m) => {
        const p = planoMeta(m, hoje);
        let detalhe = p.concluida ? '🎉 Meta alcançada!' : `Faltam ${reais(p.falta, { centavos: false })}`;
        if (!p.concluida && p.porMes) detalhe += ` · guarde ${reais(p.porMes, { centavos: false })}/mês até ${m.prazo.split('-').reverse().join('/')}`;
        return `
          <li class="meta-linha" data-id="${m.id}">
            <div class="meta-topo"><b>${esc(m.nome)}</b><span>${reais(m.valor_atual, { centavos: false })} <small>de ${reais(m.valor_alvo, { centavos: false })}</small></span></div>
            ${progresso(p.pct, 'meta', `${m.nome}: ${pct(p.pct)}`)}
            <div class="meta-rodape"><span class="dica-inline">${detalhe}</span>
              <span class="meta-acoes">
                <button type="button" class="link editar-meta">Editar</button>
                ${p.concluida ? '' : '<button type="button" class="chip-acao pequeno guardar-meta">Guardar</button>'}
              </span></div>
          </li>`;
      }).join('')}</ul>` : '<p class="vazio">Nenhuma meta ainda. Que tal uma reserva de emergência ou uma viagem?</p>'}
    </section>`;

  ligarContas(raiz, app);
  ligarCartoes(raiz, app);
  $$('.limite-linha', raiz).forEach((b) => b.addEventListener('click', () => editarLimite(b.dataset.cat, app)));
  $('#nova-meta', raiz).addEventListener('click', () => editarMeta(null, app));
  $$('.meta-linha', raiz).forEach((el) => {
    const meta = metas.find((m) => m.id === el.dataset.id);
    $('.editar-meta', el).addEventListener('click', () => editarMeta(meta, app));
    $('.guardar-meta', el)?.addEventListener('click', () => guardar(meta, app));
  });
}
