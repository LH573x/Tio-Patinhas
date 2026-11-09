// Tela inicial: resumo do mês, registro rápido, caixa de entrada, ontem e hoje.
import { interpretar, gerarLancamentos, CATEGORIAS_GASTO, CATEGORIAS_ENTRADA, METODOS } from '../parser.js';
import { resumoMes, resumoSemana, statusLimites, nomeMes, mesDe, iso, somarMesesMes } from '../analise.js';
import { store } from '../store.js';
import { $, esc, reais, pct, hojeISO, dataCurta, aviso, ICONES } from '../util.js';
import { progresso } from '../graficos.js';
import { linhaRegistro, ligarRegistros, bolinha } from './registro.js';
import { enviarCupom, enviarExtrato, cardCaixa, ligarCaixa } from './anexos.js';

let previa = null;
let salvando = false;
let textoDigitado = '';

function opcoes(lista, atual) {
  return lista.map((o) => `<option ${o === atual ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

function cardMes(app) {
  const hoje = new Date();
  const mes = mesDe(iso(hoje));
  const r = resumoMes(store.listar(), mes, hoje);
  const limites = statusLimites(store.listar(), store.orcamentos(), mes, hoje);
  const planejado = limites.reduce((s, l) => s + l.limite, 0);
  let comparacao = '';
  if (r.variacao !== null) {
    const subiu = r.variacao > 0;
    comparacao = `<span class="variacao ${subiu ? 'subiu' : 'caiu'}">${subiu ? '↑' : '↓'} ${pct(Math.abs(r.variacao))}</span>
      <span class="dica-inline">vs. ${nomeMes(somarMesesMes(mes, -1), { ano: false })} até o dia ${r.dia}</span>`;
  }
  return `
    <section class="cartao destaque-mes">
      <div class="rotulo-mes">Gastos em ${nomeMes(mes, { ano: false })}</div>
      <div class="valor-grande">${reais(r.gasto)}</div>
      ${planejado > 0 ? `
        ${progresso(r.gasto / planejado, r.gasto > planejado ? 'estourou' : r.gasto / planejado > 0.8 ? 'atencao' : 'ok', 'Gasto em relação ao planejado')}
        <div class="linha-pequena">de ${reais(planejado, { centavos: false })} planejados · sobram <b>${reais(Math.max(planejado - r.gasto, 0), { centavos: false })}</b></div>`
        : `<div class="linha-pequena"><button type="button" class="link" data-ir="metas">Definir limites por categoria</button></div>`}
      <div class="mini-kpis">
        <div><span>Entradas</span><b class="positivo">${reais(r.entrada, { centavos: false })}</b></div>
        <div><span>Saldo</span><b class="${r.saldo < 0 ? 'negativo' : ''}">${reais(r.saldo, { centavos: false })}</b></div>
        <div><span>Previsão do mês</span><b>${reais(r.projecao, { centavos: false })}</b></div>
      </div>
      ${comparacao ? `<div class="linha-pequena">${comparacao}</div>` : ''}
    </section>`;
}

function cardRegistrar() {
  return `
    <section class="cartao registrar">
      <form id="form-registro" autocomplete="off">
        <label for="frase" class="rotulo">O que você comprou?</label>
        <div class="linha-entrada">
          <input id="frase" type="text" enterkeyhint="send" placeholder="salgado 8,50 pix" value="${esc(textoDigitado)}">
          <button type="submit" class="btn-enviar" aria-label="Registrar">${ICONES.enviar}</button>
        </div>
        <div id="previa" class="previa" hidden></div>
        <p class="dica">Toque no 🎤 do teclado pra falar. Ex.: “gasolina 200 crédito”, “tênis 600 em 3x”, “recebi salário 3500”.</p>
      </form>
      <div class="anexos">
        <button type="button" class="chip-acao" id="btn-cupom">${ICONES.camera}Foto do cupom</button>
        <button type="button" class="chip-acao" id="btn-extrato">${ICONES.importar}Extrato do banco</button>
      </div>
    </section>`;
}

function cardOntem(app) {
  const ontem = hojeISO(-1);
  const regs = store.listar().filter((r) => r.data === ontem).sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  if (!regs.length) return '';
  const total = regs.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + r.valor, 0);
  return `
    <section class="cartao">
      <div class="cartao-topo"><h2>Revisar ontem <span class="sub">${dataCurta(ontem)}</span></h2><b>${reais(total)}</b></div>
      <p class="dica">Toque num item pra corrigir. Se mudar a categoria, eu aprendo.</p>
      <div class="lista-registros">${regs.map((r) => linhaRegistro(r, app)).join('')}</div>
    </section>`;
}

function cardSemana(app) {
  const hoje = new Date();
  const dia = hoje.getDay(); // mostra na segunda e na terça
  if (dia !== 1 && dia !== 2) return '';
  const s = resumoSemana(store.listar(), hoje);
  if (!s.total) return '';
  const variacao = s.variacao === null ? ''
    : `<span class="variacao ${s.variacao > 0 ? 'subiu' : 'caiu'}">${s.variacao > 0 ? '↑' : '↓'} ${pct(Math.abs(s.variacao))}</span> vs. semana anterior`;
  return `
    <section class="cartao semana">
      <div class="cartao-topo"><h2>Sua semana <span class="sub">${dataCurta(s.inicio)} a ${dataCurta(s.fim)}</span></h2><b>${reais(s.total)}</b></div>
      ${variacao ? `<p class="linha-pequena">${variacao}</p>` : ''}
      <ul class="lista-cats">${s.categorias.slice(0, 3).map((c) => `
        <li>${bolinha(c.categoria, app)}<span>${esc(c.categoria)}</span><b>${reais(c.valor)}</b></li>`).join('')}</ul>
      <button type="button" class="link" data-ir="painel">Ver painel completo</button>
    </section>`;
}

function cardHoje(app) {
  const hoje = hojeISO();
  const regs = store.listar().filter((r) => r.data === hoje).sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  const total = regs.filter((r) => r.tipo === 'gasto').reduce((s, r) => s + r.valor, 0);
  return `
    <section class="cartao">
      <div class="cartao-topo"><h2>Hoje</h2><b>${reais(total)}</b></div>
      <div class="lista-registros">${regs.length ? regs.map((r) => linhaRegistro(r, app)).join('') : '<p class="vazio">Nada registrado hoje ainda.</p>'}</div>
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
  const manual = previa && previa.categoriaManual ? previa : null;
  previa = interpretar(texto, { regras: store.regras() });
  if (manual) {
    previa.categoria = manual.categoria;
    previa.categoriaManual = true;
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
    ${previa.parcelas > 1 ? `<p class="dica">${previa.parcelas}x de ${reais(previa.valorParcela)}, uma por mês</p>` : ''}
    ${previa.data !== hojeISO() ? `<p class="dica">Data: ${dataCurta(previa.data)}</p>` : ''}`;
  $('#p-metodo').addEventListener('change', (e) => { previa.metodo = e.target.value || null; });
  $('#p-cat').addEventListener('change', (e) => {
    previa.categoria = e.target.value;
    previa.categoriaManual = true;
  });
}

async function registrar(app) {
  if (!previa || salvando) return;
  if (previa.valor === null) {
    aviso('Coloque o valor, ex.: “salgado 8,50 pix”', 'erro');
    return;
  }
  const { categoriaManual, completo, ...reg } = previa;
  salvando = true;
  try {
    if (categoriaManual) await store.aprenderRegra(reg.item, reg.categoria);
    await store.adicionar(gerarLancamentos({ ...reg, origem: 'texto' }));
    aviso(`${reg.item} · ${reais(reg.valor)} · ${reg.categoria} ✓`);
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
  raiz.innerHTML = [cardMes(app), cardRegistrar(), cardCaixa(app), cardSemana(app), cardOntem(app), cardHoje(app)].join('');
  $('#frase', raiz).addEventListener('input', renderPrevia);
  $('#form-registro', raiz).addEventListener('submit', (e) => {
    e.preventDefault();
    registrar(app);
  });
  $('#btn-cupom', raiz).addEventListener('click', () => enviarCupom(app));
  $('#btn-extrato', raiz).addEventListener('click', () => enviarExtrato(app));
  if (textoDigitado) renderPrevia();
  ligarRegistros(raiz, app);
  ligarCaixa(raiz, app);
}
