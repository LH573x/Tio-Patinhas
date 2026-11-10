// Gastos "A definir": vieram do extrato sem você dizer o que foram.
// Card no Início e uma folha para ir respondendo um por um, quando der tempo.
import { CATEGORIAS_GASTO, A_DEFINIR, sugerirCategoria } from '../parser.js';
import { aprenderEstabelecimentos, chaveEstabelecimento, quemDoRegistro } from '../extrato.js';
import { store } from '../store.js';
import { $, $$, esc, reais, abrirFolha, aviso, rotuloDia, ICONES } from '../util.js';

const CATEGORIAS = CATEGORIAS_GASTO.filter((c) => c !== A_DEFINIR);

export function pendentes() {
  return store.listar()
    .filter((r) => r.tipo === 'gasto' && r.categoria === A_DEFINIR)
    .sort((a, b) => b.data.localeCompare(a.data) || (b.hora || '').localeCompare(a.hora || ''));
}

/** Card do Início: só aparece se houver algo a definir. */
export function cardADefinir() {
  const lista = pendentes();
  if (!lista.length) return '';
  const total = lista.reduce((s, r) => s + r.valor, 0);
  return `
    <section class="cartao a-definir">
      <button type="button" class="linha-abrir" id="abrir-a-definir">
        <span><b>A definir</b> <small>· ${lista.length} ${lista.length === 1 ? 'gasto' : 'gastos'} pra dizer o que foi</small></span>
        <small>${reais(total)}</small>${ICONES.avancar}
      </button>
    </section>`;
}

export function ligarADefinir(raiz, app) {
  $('#abrir-a-definir', raiz)?.addEventListener('click', () => revisarADefinir(app));
}

/** Chave do estabelecimento de um registro (a gravada na importação, ou a partir do local/nome). */
function chaveDoRegistro(r) {
  const quem = quemDoRegistro(r);
  return quem ? quem.chave : chaveEstabelecimento(r.local || r.item);
}

/** Folha que mostra um gasto por vez: valor, dia, hora, local e "O que foi?". */
export function revisarADefinir(app, pulados = new Set()) {
  const todos = pendentes();
  const fila = todos.filter((r) => !pulados.has(r.id));
  if (!fila.length) {
    aviso(pulados.size ? 'Os que você pulou continuam em A definir' : 'Tudo definido ✓');
    app.render();
    return;
  }
  const r = fila[0];
  // O que você já respondeu antes para este mesmo lugar (se houver)
  const est = store.estabelecimentos().find((e) => e.chave === chaveDoRegistro(r));
  const onde = [r.local, r.metodo].filter(Boolean).join(' · ');
  let categoria = est && est.categoria ? est.categoria : null;

  abrirFolha(`A definir · ${todos.length} ${todos.length === 1 ? 'restante' : 'restantes'}`, `
    <form class="formulario" id="form-definir">
      <div class="definir-topo">
        <span class="definir-valor">${reais(r.valor)}</span>
        <span class="definir-nome">${esc(r.item)}</span>
        <span class="dica-inline">${esc(rotuloDia(r.data))}${r.hora ? ` · ${esc(r.hora)}` : ''}${onde ? ` · ${esc(onde)}` : ''}</span>
        ${r.textoOriginal ? `<small class="definir-original">${esc(r.textoOriginal.replace(/\s+/g, ' '))}</small>` : ''}
      </div>
      <label class="campo">O que foi?
        <input name="oque" placeholder="ex.: gasolina, almoço, remédio" autocomplete="off" enterkeyhint="done" value="${esc(est && est.item ? est.item : r.local && r.item !== r.local ? r.item : '')}">
      </label>
      <div class="chips-filtro chips-categoria" role="radiogroup" aria-label="Categoria">
        ${CATEGORIAS.map((c) => `<button type="button" role="radio" class="chip-filtro ${c === categoria ? 'ativo' : ''}" data-cat="${esc(c)}"
          aria-checked="${c === categoria}" style="--cor:${app.cor(c)}"><i></i>${esc(c)}</button>`).join('')}
      </div>
      <div class="acoes-folha">
        <button type="button" class="btn secundario" id="pular">Pular</button>
        <button type="submit" class="btn primario">${fila.length > 1 ? 'Salvar e próximo' : 'Salvar'}</button>
      </div>
    </form>`, (folha) => {
    const campo = $('input[name=oque]', folha);
    const marcar = (c) => {
      categoria = c;
      $$('[data-cat]', folha).forEach((b) => {
        const ativo = b.dataset.cat === c;
        b.classList.toggle('ativo', ativo);
        b.setAttribute('aria-checked', String(ativo));
      });
    };
    let escolhida = false;
    campo.addEventListener('input', () => {
      if (escolhida) return;
      const c = sugerirCategoria(campo.value, 'gasto', store.regras());
      if (campo.value.trim() && c !== 'Outros') marcar(c);
    });
    $$('[data-cat]', folha).forEach((b) => b.addEventListener('click', () => {
      escolhida = true;
      marcar(b.dataset.cat);
    }));
    $('#pular', folha).addEventListener('click', () => revisarADefinir(app, new Set([...pulados, r.id])));
    $('#form-definir', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      const oque = campo.value.trim();
      if (!categoria) {
        aviso('Escolha a categoria', 'erro');
        return;
      }
      const botao = $('button[type=submit]', folha);
      botao.disabled = true;
      try {
        await store.atualizar(r.id, { ...r, item: oque || r.item, categoria });
        if (oque) {
          await store.salvarEstabelecimentos(aprenderEstabelecimentos(
            [{ chave: chaveDoRegistro(r), nome: r.local || r.item, item: oque, categoria }], store.estabelecimentos(),
          )).catch(() => {});
        }
        app.render();
        revisarADefinir(app, pulados);
      } catch (err) {
        botao.disabled = false;
        aviso(`Não salvou: ${err.message}`, 'erro');
      }
    });
  });
}
