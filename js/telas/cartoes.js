// Cartões de crédito: cadastro (em Metas) e faturas (no Painel).
import { faturasCartoes, rotuloVencimento, diasEntre, iso } from '../analise.js';
import { store } from '../store.js';
import { $, $$, esc, reais, abrirFolha, confirmar, aviso, lerNumero, numeroParaCampo, ICONES, dataCurta } from '../util.js';
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
      <div class="cartao-topo"><h2>Cartões</h2>
        <button type="button" class="btn-mais" id="novo-cartao" aria-label="Novo cartão">${ICONES.mais}</button></div>
      ${cartoes.length ? `<ul class="lista-contas">${cartoes.map((c) => `
        <li class="conta-linha" data-id="${c.id}">
          <button type="button" class="conta-info editar-cartao">
            <span class="conta-nome">${esc(c.nome)}</span>
            <span class="conta-detalhe">Fecha dia ${c.dia_fechamento} · vence dia ${c.dia_vencimento}</span>
          </button>
          <span class="conta-lado leve">${c.limite ? reais(c.limite, { centavos: false }) : ''}</span>
        </li>`).join('')}</ul>`
        : '<p class="vazio">Nenhum cartão cadastrado.</p>'}
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
export function cardFaturas() {
  const cartoes = store.cartoes();
  if (!cartoes.length) return '';
  const hoje = new Date();
  const hojeS = iso(hoje);
  const faturas = faturasCartoes(store.listar(), cartoes, hoje);
  const total = faturas.reduce((t, f) => t + f.atual.valor, 0);
  return `
    <section class="cartao faturas">
      <div class="cartao-topo"><h2>Faturas</h2><span class="total">${reais(total)}</span></div>
      <ul class="lista-contas">${faturas.map((f) => {
        const dias = diasEntre(hojeS, f.atual.vencimento);
        const situacao = f.atual.fechada
          ? `<span class="conta-detalhe ${dias <= 1 ? 'alerta-texto' : ''}">${rotuloVencimento(dias, { diaDoMes: Number(f.atual.vencimento.slice(8)) })}</span>`
          : `<span class="conta-detalhe">Fecha ${dataCurta(f.atual.fechamento)} · vence ${dataCurta(f.atual.vencimento)}</span>`;
        return `
          <li class="conta-linha fatura" data-id="${f.cartao.id}">
            <button type="button" class="conta-info fatura-topo">
              <span class="conta-nome">${esc(f.cartao.nome)}</span>${situacao}
            </button>
            <span class="conta-lado">${reais(f.atual.valor)}</span>
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
