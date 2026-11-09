// Linha de um registro e a folha de edição, usadas em várias telas.
import { CATEGORIAS_GASTO, CATEGORIAS_ENTRADA, METODOS } from '../parser.js';
import { store } from '../store.js';
import { $, $$, esc, reais, selo, abrirFolha, confirmar, aviso, lerNumero, numeroParaCampo, ICONES } from '../util.js';
import { infoCategoria } from '../categorias.js';

export function bolinha(categoria, app) {
  const info = infoCategoria(categoria);
  return `<span class="bolinha" style="--cor:${app.cor(categoria)}" aria-hidden="true">${info.icone}</span>`;
}

export function linhaRegistro(r, app, { mostrarData = false } = {}) {
  const detalhe = [r.categoria, r.metodo, mostrarData ? r.data.split('-').reverse().slice(0, 2).join('/') : null, r.hora, r.local]
    .filter(Boolean).join(' · ');
  const ORIGENS = { extrato: 'extrato', cupom: 'cupom', conta: 'conta fixa' };
  const origem = r.origem && ORIGENS[r.origem] ? selo(ORIGENS[r.origem]) : '';
  return `
    <button type="button" class="registro" data-id="${r.id}">
      ${bolinha(r.categoria, app)}
      <span class="registro-meio">
        <span class="registro-item">${esc(r.item)}${r.parcela ? selo(`parcela ${r.parcela}`) : ''}${origem}</span>
        <span class="registro-detalhe">${esc(detalhe)}</span>
      </span>
      <span class="registro-valor ${r.tipo}">${r.tipo === 'entrada' ? '+' : ''}${reais(r.valor)}</span>
    </button>`;
}

export function ligarRegistros(raiz, app) {
  $$('.registro[data-id]', raiz).forEach((el) => {
    el.addEventListener('click', () => {
      const r = store.listar().find((x) => x.id === el.dataset.id);
      if (r) editarRegistro(r, app);
    });
  });
}

function opcoes(lista, atual) {
  return lista.map((o) => `<option ${o === atual ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

export function editarRegistro(r, app) {
  const cats = r.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_GASTO;
  abrirFolha(r.tipo === 'entrada' ? 'Editar entrada' : 'Editar gasto', `
    <form class="formulario" id="form-editar">
      <label class="campo">Item<input name="item" value="${esc(r.item)}" required></label>
      <div class="dupla">
        <label class="campo">Valor<input name="valor" inputmode="decimal" value="${numeroParaCampo(r.valor)}" required></label>
        <label class="campo">Data<input name="data" type="date" value="${r.data}" required></label>
      </div>
      <div class="dupla">
        <label class="campo">Categoria<select name="categoria">${opcoes(cats, r.categoria)}</select></label>
        <label class="campo">Pagamento<select name="metodo"><option value="">—</option>${opcoes(METODOS, r.metodo)}</select></label>
      </div>
      <div class="dupla">
        <label class="campo">Local<input name="local" value="${esc(r.local || '')}" placeholder="opcional"></label>
        <label class="campo">Horário<input name="hora" type="time" value="${r.hora || ''}"></label>
      </div>
      ${r.textoOriginal ? `<p class="dica">Você escreveu: “${esc(r.textoOriginal)}”</p>` : ''}
      <div class="acoes-folha">
        <button type="button" class="btn perigo-texto" id="apagar">${ICONES.lixo}Apagar</button>
        <button type="submit" class="btn primario">Salvar</button>
      </div>
    </form>`, (folha, fechar) => {
    $('#form-editar', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const valor = lerNumero(f.get('valor'));
      if (valor === null || valor < 0) {
        aviso('Valor inválido', 'erro');
        return;
      }
      const m = { ...r, item: f.get('item').trim(), valor, data: f.get('data'), categoria: f.get('categoria'), metodo: f.get('metodo') || null,
        local: f.get('local').trim() || null, hora: f.get('hora') || null };
      try {
        if (m.categoria !== r.categoria) await store.aprenderRegra(m.item, m.categoria);
        await store.atualizar(r.id, m);
        fechar();
        aviso(m.categoria !== r.categoria ? `Corrigido. Da próxima vez, “${m.item}” vai para ${m.categoria}.` : 'Corrigido ✓');
        app.render();
      } catch (err) {
        aviso(`Não salvou: ${err.message}`, 'erro');
      }
    });
    $('#apagar', folha).addEventListener('click', async () => {
      if (!(await confirmar(`Apagar “${r.item}” (${reais(r.valor)})?`, { sim: 'Apagar', perigo: true }))) return;
      try {
        await store.remover(r.id);
        aviso('Apagado');
        app.render();
      } catch (err) {
        aviso(`Não apagou: ${err.message}`, 'erro');
      }
    });
  });
}
