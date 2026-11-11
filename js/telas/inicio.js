// Tela inicial: número do mês, o que vence, hoje e ontem, e o campo de registrar fixo no pé.
import { interpretar, gerarLancamentos, CATEGORIAS_GASTO, CATEGORIAS_ENTRADA, METODOS, etiquetaDe } from '../parser.js';
import { resumoMes, statusLimites, mesDe, iso, statusContas, faturasCartoes, diasEntre, rotuloVencimento } from '../analise.js';
import { store } from '../store.js';
import { $, esc, reais, valorHero, hojeISO, horaAgora, dataCurta, aviso, avisoBanco, ICONES } from '../util.js';
import { progresso, estadoLimite } from '../graficos.js';
import { linhaRegistro, ligarRegistros, campoEtiqueta } from './registro.js';
import { enviarCupom, cardCaixa, ligarCaixa } from './anexos.js';
import { pagarConta } from './contas.js';
import { opcoesCartao, cartaoPadrao } from './cartoes.js';
import { avisoLimite } from './alertas.js';
import { cardADefinir, ligarADefinir } from './revisar.js';
import { cardAssessor, ligarAssessor } from './assessor.js';
import { ligarSugestoes } from './sugestoes.js';
import { itemDaFrase } from '../itens.js';

let previa = null;
let salvando = false;
let textoDigitado = '';

function opcoes(lista, atual) {
  return lista.map((o) => `<option ${o === atual ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

function cardMes() {
  const hoje = new Date();
  const mes = mesDe(iso(hoje));
  const registros = store.listar();
  const r = resumoMes(registros, mes, hoje, { previsao: false });
  const limites = statusLimites(registros, store.orcamentos(), mes, hoje);
  const planejado = limites.reduce((s, l) => s + l.limite, 0);
  const sobra = planejado - r.gasto;
  return `
    <section class="destaque-mes">
      <div class="rotulo-mes">Gastos do mês</div>
      <div class="valor-grande">${valorHero(r.gasto)}</div>
      ${planejado > 0 ? `
        ${progresso(r.gasto / planejado, estadoLimite(r.gasto / planejado), 'Gasto em relação ao planejado')}
        <div class="linha-pequena"><span>Planejado ${reais(planejado, { centavos: false })}</span>
          ${sobra >= 0 ? `<span>Sobram <b>${reais(sobra, { centavos: false })}</b></span>`
            : `<b class="estourou-texto">${reais(-sobra, { centavos: false })} acima</b>`}</div>`
        : `<div class="linha-pequena"><button type="button" class="link" data-ir="metas">Definir quanto quer gastar</button></div>`}
    </section>`;
}

/** Contas fixas e faturas que vencem nos próximos dias. */
function cardPagar() {
  const hoje = new Date();
  const hojeS = iso(hoje);
  const itens = [];
  for (const s of statusContas(store.contas(), store.listar(), hoje)) {
    if (s.pagamento || s.dias > 3) continue;
    itens.push({ tipo: 'conta', id: s.conta.id, nome: s.conta.nome, valor: s.conta.valor, dias: s.dias });
  }
  for (const f of faturasCartoes(store.listar(), store.cartoes(), hoje)) {
    if (!f.atual.fechada || f.atual.valor <= 0) continue;
    const dias = diasEntre(hojeS, f.atual.vencimento);
    if (dias > 5) continue;
    itens.push({ tipo: 'fatura', nome: `Fatura ${f.cartao.nome}`, valor: f.atual.valor, dias });
  }
  if (!itens.length) return '';
  itens.sort((a, b) => a.dias - b.dias);
  return `
    <section class="cartao pagar">
      <div class="cartao-topo"><h2>A pagar</h2></div>
      <ul class="lista-contas">${itens.map((it) => `
        <li class="conta-linha">
          ${it.tipo === 'conta'
            ? `<button type="button" class="marcar pagar-aviso" data-conta="${it.id}" aria-label="Marcar ${esc(it.nome)} como paga"></button>`
            : `<span class="marcar-icone" aria-hidden="true">${ICONES.cartao}</span>`}
          <button type="button" class="conta-info" ${it.tipo === 'conta' ? `data-conta="${it.id}"` : 'data-ir="painel"'}>
            <span class="conta-nome">${esc(it.nome)}</span>
            <span class="conta-detalhe ${it.dias <= 0 ? 'alerta-texto' : ''}">${rotuloVencimento(it.dias)}</span>
          </button>
          <span class="conta-lado">${reais(it.valor)}</span>
        </li>`).join('')}</ul>
    </section>`;
}

function cardRegistrar() {
  return `
    <section class="registrar">
      <form id="form-registro" autocomplete="off">
        <div id="previa" class="previa" hidden></div>
        <div id="sugestoes-frase"></div>
        <div class="linha-entrada">
          <input id="frase" type="text" enterkeyhint="send" placeholder="O que você comprou?" aria-label="O que você comprou? Ex.: salgado 8,50 pix" value="${esc(textoDigitado)}">
          <button type="button" class="icone-btn" id="btn-cupom" aria-label="Foto do cupom">${ICONES.camera}</button>
          <button type="submit" class="btn-enviar" aria-label="Registrar">${ICONES.subir}</button>
        </div>
      </form>
    </section>`;
}

let ontemAberto = false;

function cardOntem(app) {
  const ontem = hojeISO(-1);
  const regs = store.listar().filter((r) => r.data === ontem).sort((a, b) => (b.hora || '').localeCompare(a.hora || '') || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  if (!regs.length) return '';
  const total = regs.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + r.valor, 0);
  return `
    <div class="ontem">
      <button type="button" class="linha-abrir" id="abrir-ontem" aria-expanded="${ontemAberto}">
        <span>Ontem <small>· ${regs.length} ${regs.length === 1 ? 'registro' : 'registros'}</small></span>
        <small>${reais(total)}</small>${ICONES.avancar}
      </button>
      <div class="lista-registros" ${ontemAberto ? '' : 'hidden'}>${regs.map((r) => linhaRegistro(r, app)).join('')}</div>
    </div>`;
}

function cardHoje(app) {
  const hoje = hojeISO();
  const regs = store.listar().filter((r) => r.data === hoje).sort((a, b) => (b.hora || '').localeCompare(a.hora || '') || (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  const total = regs.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + r.valor, 0);
  return `
    <section class="cartao">
      <div class="cartao-topo"><h2>Hoje</h2>${regs.length ? `<span class="total">${reais(total)}</span>` : ''}</div>
      <div class="lista-registros">${regs.length ? regs.map((r) => linhaRegistro(r, app)).join('') : '<p class="vazio">Nada por aqui ainda.</p>'}</div>
      ${cardOntem(app)}
    </section>`;
}

function renderPrevia() {
  const entrada = $('#frase');
  const box = $('#previa');
  if (!entrada || !box) return;
  textoDigitado = entrada.value;
  const texto = entrada.value.trim();
  if (!texto) {
    previa = null;
    box.hidden = true;
    return;
  }
  const anterior = previa;
  previa = interpretar(texto, { regras: store.regras(), cartoes: store.cartoes() });
  if (anterior && anterior.categoriaManual) {
    previa.categoria = anterior.categoria;
    previa.categoriaManual = true;
  }
  // Etiqueta (ex.: Transporte › Uber): a escolhida, se a categoria não mudou; senão, a sugerida.
  if (anterior && anterior.etiquetaManual && anterior.categoria === previa.categoria) {
    previa.etiqueta = anterior.etiqueta;
    previa.etiquetaManual = true;
  } else {
    previa.etiqueta = store.sugerirEtiqueta(previa.item, previa.categoria, texto);
  }
  if (anterior && anterior.localManual) {
    previa.local = anterior.local;
    previa.localManual = true;
  }
  if (anterior && anterior.cartaoManual) {
    previa.cartaoId = anterior.cartaoId;
    previa.cartaoManual = true;
  }
  if (anterior && anterior.metodoManual) {
    previa.metodo = anterior.metodo;
    previa.metodoManual = true;
  }
  if (previa.metodo === 'Crédito' && !previa.cartaoId) previa.cartaoId = cartaoPadrao();
  if (anterior && anterior.horaManual) {
    previa.hora = anterior.hora;
    previa.horaManual = true;
  }
  // Sem horário na frase: se é de hoje, usa a hora de agora.
  if (!previa.hora && !previa.horaManual && previa.data === hojeISO()) {
    previa.hora = horaAgora();
    previa.horaAutomatica = true;
  }
  const cats = previa.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_GASTO;
  box.hidden = false;
  box.innerHTML = `
    <div class="previa-linha">
      <span class="chip ${previa.tipo}">${previa.tipo === 'entrada' ? 'Entrada' : 'Gasto'}</span>
      <strong>${esc(previa.item)}</strong>
      <span class="valor ${previa.valor === null ? 'falta' : ''}">${previa.valor === null ? 'falta o valor' : reais(previa.valor)}</span>
    </div>
    <div class="dupla">
      <label class="campo">Categoria<select id="p-cat">${opcoes(cats, previa.categoria)}</select></label>
      <label class="campo">Pagamento<select id="p-metodo"><option value="">—</option>${opcoes(METODOS, previa.metodo)}</select></label>
    </div>
    <div class="campo-etiqueta">${campoEtiqueta(previa.categoria, previa.etiqueta || etiquetaDe({ categoria: previa.categoria }), { id: 'p-etiqueta' })}</div>
    ${previa.metodo === 'Crédito' && store.cartoes().length > 1 ? `
      <label class="campo">Cartão<select id="p-cartao">${opcoesCartao(previa.cartaoId)}</select></label>` : ''}
    <div class="dupla">
      <label class="campo">Local <input id="p-local" placeholder="opcional" value="${esc(previa.local || '')}" autocomplete="off"></label>
      <label class="campo">Horário <input id="p-hora" type="time" value="${previa.hora || ''}"></label>
    </div>
    ${previa.parcelas > 1 ? `<p class="dica">${previa.parcelas}x de ${reais(previa.valorParcela)}, uma por mês</p>` : ''}
    ${previa.data !== hojeISO() ? `<p class="dica">Data: ${dataCurta(previa.data)}</p>` : ''}`;
  $('#p-metodo').addEventListener('change', (e) => {
    previa.metodo = e.target.value || null;
    previa.metodoManual = true;
    if (previa.metodo !== 'Crédito') previa.cartaoId = null;
    renderPrevia(); // mostra ou esconde a escolha do cartão
  });
  $('#p-cartao')?.addEventListener('change', (e) => {
    previa.cartaoId = e.target.value || null;
    previa.cartaoManual = true;
  });
  $('#p-local').addEventListener('input', (e) => {
    previa.local = e.target.value.trim() || null;
    previa.localManual = true;
  });
  $('#p-hora').addEventListener('input', (e) => {
    previa.hora = e.target.value || null;
    previa.horaManual = true;
    previa.horaAutomatica = false;
  });
  $('#p-cat').addEventListener('change', (e) => {
    previa.categoria = e.target.value;
    previa.categoriaManual = true;
    renderPrevia(); // mostra as etiquetas da categoria nova
  });
  $('#p-etiqueta')?.addEventListener('change', (e) => {
    previa.etiqueta = e.target.value || null;
    previa.etiquetaManual = true;
  });
}

async function registrar(app) {
  if (!previa || salvando) return;
  if (previa.valor === null) {
    aviso('Coloque o valor, ex.: “salgado 8,50 pix”', 'erro');
    return;
  }
  const { categoriaManual, etiquetaManual, localManual, horaManual, horaAutomatica, cartaoManual, metodoManual, completo, ...reg } = previa;
  if (reg.metodo !== 'Crédito') reg.cartaoId = null;
  if (horaAutomatica) reg.hora = horaAgora(); // hora de quando registrou de fato
  salvando = true;
  try {
    if (categoriaManual) await store.aprenderRegra(reg.item, reg.categoria);
    const antes = store.listar();
    const novos = gerarLancamentos({ ...reg, origem: 'texto' });
    await store.adicionar(novos);
    aviso([`${reg.item} · ${reais(reg.valor)} · ${reg.categoria} ✓`, avisoLimite(antes, novos)].filter(Boolean).join('\n'));
    textoDigitado = '';
    previa = null;
    app.render();
    $('#frase')?.focus();
  } catch (e) {
    aviso(`Não salvou: ${e.message}`, 'erro');
  } finally {
    salvando = false;
  }
}

export function telaInicio(raiz, app) {
  raiz.innerHTML = [avisoBanco(store.bancoDesatualizado, store.esperandoBanco()), cardMes(), cardAssessor(), cardPagar(), cardADefinir(), cardCaixa(app), cardHoje(app), cardRegistrar()].join('');
  $('#frase', raiz).addEventListener('input', renderPrevia);
  ligarSugestoes($('#frase', raiz), { caixa: $('#sugestoes-frase', raiz), parte: itemDaFrase });
  $('#form-registro', raiz).addEventListener('submit', (e) => {
    e.preventDefault();
    registrar(app);
  });
  $('#btn-cupom', raiz).addEventListener('click', () => enviarCupom(app));
  if (textoDigitado) renderPrevia();
  ligarRegistros(raiz, app);
  ligarCaixa(raiz, app);
  ligarADefinir(raiz, app);
  ligarAssessor(raiz, app);
  raiz.querySelectorAll('[data-conta]').forEach((b) => b.addEventListener('click', () => {
    const conta = store.contas().find((c) => c.id === b.dataset.conta);
    if (conta) pagarConta(conta, app);
  }));
  $('#abrir-ontem', raiz)?.addEventListener('click', () => {
    ontemAberto = !ontemAberto;
    app.render();
  });
}
