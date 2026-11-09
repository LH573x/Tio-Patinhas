// Cartões de crédito: cadastro (em Metas) e faturas (no Painel).
import { faturasCartoes, rotuloVencimento, diasEntre, iso } from '../analise.js';
import { store } from '../store.js';
import { $, $$, esc, reais, reaisGrande, abrirFolha, confirmar, aviso, lerNumero, numeroParaCampo, ICONES, selo, dataCurta, pct } from '../util.js';
import { progresso, estadoLimite } from '../graficos.js';
import { linhaRegistro, ligarRegistros } from './registro.js';

/** Opções de cartão para um <select>. */
export function opcoesCartao(atual) {
  return `<option value="">—</option>${store.cartoes().map((c) => `<option value="${c.id}" ${c.id === atual ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}`;
}

/** Cartão padrão para um gasto no crédito: se só existe um, é ele. */
export function cartaoPadrao() {
  const lista = store.cartoes();
  return lista.length === 1 ? lista[0].id : null;
}

// ---------------------------------------------------------------- Cadastro (tela Metas)
export function cardCartoes() {
  const cartoes = store.cartoes();
  return `
    <section class="cartao" id="cartoes">
      <div class="cartao-topo"><h2>Cartões de crédito</h2>
        <button type="button" class="chip-acao" id="novo-cartao">${ICONES.mais}Novo cartão</button></div>
      ${cartoes.length ? `<ul class="lista-contas">${cartoes.map((c) => `
        <li class="conta-linha" data-id="${c.id}">
          <button type="button" class="conta-info editar-cartao">
            <span class="conta-nome">${ICONES.cartao}${esc(c.nome)}</span>
            <span class="conta-detalhe">fecha dia ${c.dia_fechamento} · vence dia ${c.dia_vencimento}</span>
          </button>
          <span class="conta-lado">${c.limite ? `<b>${reais(c.limite, { centavos: false })}</b><small>limite</small>` : '<small>sem limite</small>'}</span>
        </li>`).join('')}</ul>
        <p class="dica">Escreva o nome do cartão no gasto (ex.: “mercado 200 ${esc(cartoes[0].nome.toLowerCase())}”) e a fatura se monta sozinha no Painel.</p>`
        : '<p class="vazio">Cadastre seus cartões com o dia de fechamento e de vencimento. Eu monto a fatura de cada um com os gastos no crédito e as parcelas.</p>'}
    </section>`;
}

export function ligarCartoes(raiz, app) {
  $('#novo-cartao', raiz)?.addEventListener('click', () => editarCartao(null, app));
  $$('#cartoes .conta-linha', raiz).forEach((el) => {
    const cartao = store.cartoes().find((c) => c.id === el.dataset.id);
    $('.editar-cartao', el).addEventListener('click', () => editarCartao(cartao, app));
  });
}

function editarCartao(cartao, app) {
  const novo = !cartao;
  const c = cartao || { nome: '', dia_fechamento: '', dia_vencimento: '', limite: '' };
  abrirFolha(novo ? 'Novo cartão' : 'Editar cartão', `
    <form class="formulario" id="form-cartao">
      <label class="campo">Nome<input name="nome" required placeholder="ex.: Nubank" value="${esc(c.nome)}"></label>
      <div class="dupla">
        <label class="campo">Dia do fechamento<input name="fecha" inputmode="numeric" required placeholder="ex.: 3" value="${c.dia_fechamento || ''}"></label>
        <label class="campo">Dia do vencimento<input name="vence" inputmode="numeric" required placeholder="ex.: 10" value="${c.dia_vencimento || ''}"></label>
      </div>
      <label class="campo">Limite (opcional)<input name="limite" inputmode="decimal" placeholder="ex.: 5000" value="${numeroParaCampo(c.limite)}"></label>
      <p class="dica">Compras feitas a partir do dia do fechamento entram na fatura do mês seguinte.</p>
      <div class="acoes-folha">
        ${novo ? '' : '<button type="button" class="btn perigo-texto" id="apagar-cartao">Apagar</button>'}
        <button type="submit" class="btn primario">${novo ? 'Criar cartão' : 'Salvar'}</button>
      </div>
    </form>`, (folha, fechar) => {
    $('#form-cartao', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const fecha = Number(String(f.get('fecha')).trim());
      const vence = Number(String(f.get('vence')).trim());
      const dia = (n) => Number.isInteger(n) && n >= 1 && n <= 31;
      if (!dia(fecha) || !dia(vence)) { aviso('Os dias vão de 1 a 31', 'erro'); return; }
      const limite = lerNumero(f.get('limite'));
      try {
        await store.salvarCartao({ id: c.id, nome: f.get('nome').trim(), dia_fechamento: fecha, dia_vencimento: vence, limite: limite && limite > 0 ? limite : null });
        fechar();
        aviso(novo ? 'Cartão criado ✓' : 'Cartão salvo ✓');
        app.render();
      } catch (err) {
        aviso(`Não salvou: ${err.message}`, 'erro');
      }
    });
    $('#apagar-cartao', folha)?.addEventListener('click', async () => {
      if (!(await confirmar(`Apagar o cartão “${c.nome}”? Os gastos continuam, só deixam de estar ligados a ele.`, { sim: 'Apagar', perigo: true }))) return;
      try {
        await store.removerCartao(c.id);
        aviso('Cartão apagado');
        app.render();
      } catch (err) {
        aviso(err.message, 'erro');
      }
    });
  });
}

// ---------------------------------------------------------------- Faturas (tela Painel)
export function cardFaturas(app) {
  const cartoes = store.cartoes();
  if (!cartoes.length) return '';
  const hoje = new Date();
  const hojeS = iso(hoje);
  const faturas = faturasCartoes(store.listar(), cartoes, hoje);
  const total = faturas.reduce((t, f) => t + f.atual.valor, 0);
  return `
    <section class="cartao faturas">
      <div class="cartao-topo"><h2>Faturas <span class="sub">${cartoes.length} ${cartoes.length === 1 ? 'cartão' : 'cartões'}</span></h2></div>
      <div class="valor-medio">${reaisGrande(total)}</div>
      <p class="dica sem-margem">a pagar nas próximas faturas de cada cartão</p>
      <ul class="lista-faturas">${faturas.map((f) => {
        const dias = diasEntre(hojeS, f.atual.vencimento);
        const tipoSelo = dias <= 0 ? 'estourou' : dias <= 5 ? 'atencao' : 'neutro';
        const situacao = f.atual.fechada
          ? selo(rotuloVencimento(dias, { diaDoMes: Number(f.atual.vencimento.slice(8)) }), tipoSelo)
          : selo(`Fecha ${dataCurta(f.atual.fechamento)}`, 'destaque');
        const usoLimite = f.cartao.limite ? f.usado / f.cartao.limite : null;
        return `
          <li class="fatura" data-id="${f.cartao.id}">
            <button type="button" class="fatura-topo">
              <span class="fatura-nome">${ICONES.cartao}<b>${esc(f.cartao.nome)}</b></span>
              <b class="fatura-valor">${reais(f.atual.valor)}</b>
            </button>
            <div class="fatura-linha">${situacao}<span class="dica-inline">vence ${dataCurta(f.atual.vencimento)}${f.proxima ? ` · próxima ${reais(f.proxima.valor, { centavos: false })}` : ''}</span></div>
            ${usoLimite !== null ? `
              ${progresso(usoLimite, estadoLimite(usoLimite), `${f.cartao.nome}: ${pct(usoLimite)} do limite usado`, { marca: true })}
              <div class="fatura-limite"><span>${pct(usoLimite)} do limite usado</span><span>${f.disponivel < 0 ? `${reais(-f.disponivel, { centavos: false })} acima` : `${reais(f.disponivel, { centavos: false })} disponível`}</span></div>` : ''}
          </li>`;
      }).join('')}</ul>
    </section>`;
}

export function ligarFaturas(raiz, app) {
  $$('.fatura', raiz).forEach((el) => {
    $('.fatura-topo', el).addEventListener('click', () => {
      const f = faturasCartoes(store.listar(), store.cartoes(), new Date()).find((x) => x.cartao.id === el.dataset.id);
      if (f) abrirFatura(f, app);
    });
  });
}

function abrirFatura(f, app) {
  const itens = [...f.atual.itens].sort((a, b) => b.data.localeCompare(a.data));
  abrirFolha(`Fatura ${f.cartao.nome}`, `
    <div class="cartao-topo"><span class="dica-inline">vence ${dataCurta(f.atual.vencimento)} · ${f.atual.fechada ? 'fechada' : `fecha ${dataCurta(f.atual.fechamento)}`}</span><b>${reais(f.atual.valor)}</b></div>
    <div class="lista-registros">${itens.length ? itens.map((r) => linhaRegistro(r, app, { mostrarData: true })).join('') : '<p class="vazio">Nada nesta fatura ainda.</p>'}</div>`, (folha) => {
    ligarRegistros(folha, app);
  });
}
