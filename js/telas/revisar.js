// Gastos "A definir": vieram do extrato sem você dizer o que foram.
// Card no Início e uma folha para ir respondendo um por um, quando der tempo.
import { CATEGORIAS_GASTO, A_DEFINIR, NAO_LEMBRO, sugerirCategoria } from '../parser.js';
import { ligarSugestoes } from './sugestoes.js';
import { aprenderEstabelecimentos, lembrarPorValor, chaveDoRegistro, quemDoRegistro, gastosParecidos } from '../extrato.js';
import { lembrarLigado } from './lembrancas.js';
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
  const quem = quemDoRegistro(r);
  const nomeQuem = quem ? (est && est.apelido) || r.local || quem.original : null;
  // Outros pendentes que parecem ser a mesma coisa: definidos junto com este
  const parecidos = gastosParecidos(r, todos);
  const textoSalvar = (n) => (n ? `Salvar ${n + 1} ${fila.length > n + 1 ? 'e próximo' : ''}`.trim()
    : fila.length > 1 ? 'Salvar e próximo' : 'Salvar');
  const marcadosNoInicio = parecidos.filter((p) => p.certeza).length;

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
        <div id="sugestoes-oque"></div>
      </label>
      <div class="chips-filtro chips-categoria" role="radiogroup" aria-label="Categoria">
        ${CATEGORIAS.map((c) => `<button type="button" role="radio" class="chip-filtro ${c === categoria ? 'ativo' : ''}" data-cat="${esc(c)}"
          aria-checked="${c === categoria}" style="--cor:${app.cor(c)}"><i></i>${esc(c)}</button>`).join('')}
      </div>
      ${parecidos.length ? `
        <div class="definir-parecidos">
          <div class="definir-parecidos-topo">
            <span><b>Parecidos</b> <small>Os marcados recebem a mesma resposta</small></span>
            <button type="button" class="link" id="marcar-todos">${marcadosNoInicio === parecidos.length ? 'Desmarcar todos' : 'Marcar todos'}</button>
          </div>
          ${parecidos.map(({ registro: p, certeza }) => `
            <label class="parecido ${certeza ? '' : 'desmarcada'}">
              <input type="checkbox" data-id="${esc(p.id)}" ${certeza ? 'checked' : ''} aria-label="Definir também ${esc(p.item)} de ${esc(rotuloDia(p.data))}">
              <span class="parecido-meio"><span class="parecido-nome">${esc(p.local || p.item)}</span>
                <small>${esc(rotuloDia(p.data))}${p.hora ? ` · ${esc(p.hora)}` : ''}${certeza ? '' : ' · nome parecido'}</small></span>
              <span class="parecido-valor">${reais(p.valor)}</span>
            </label>`).join('')}
        </div>` : ''}
      ${quem && lembrarLigado() ? `
        <label class="caixinha"><input type="checkbox" name="sempre">
          <span>Todo ${r.tipo === 'entrada' ? 'valor' : 'pagamento'} de ${reais(r.valor)} ${r.tipo === 'entrada' ? 'de' : 'para'} ${esc(nomeQuem)} é isso
          <small>Os próximos iguais do extrato já entram assim</small></span></label>` : ''}
      <div class="acoes-folha">
        <button type="button" class="link nao-lembro" id="nao-lembro">Não lembro</button>
        <button type="button" class="btn secundario" id="pular">Pular</button>
        <button type="submit" class="btn primario">${textoSalvar(marcadosNoInicio)}</button>
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
    ligarSugestoes(campo, { caixa: $('#sugestoes-oque', folha) });
    campo.addEventListener('input', () => {
      if (escolhida) return;
      const c = sugerirCategoria(campo.value, 'gasto', store.regras());
      if (campo.value.trim() && c !== 'Outros') marcar(c);
    });
    $$('[data-cat]', folha).forEach((b) => b.addEventListener('click', () => {
      escolhida = true;
      marcar(b.dataset.cat);
    }));
    const caixas = $$('.parecido input', folha);
    const marcados = () => caixas.filter((c) => c.checked);
    const atualizarGrupo = () => {
      const n = marcados().length;
      caixas.forEach((c) => c.closest('.parecido').classList.toggle('desmarcada', !c.checked));
      $('button[type=submit]', folha).textContent = textoSalvar(n);
      const todosBtn = $('#marcar-todos', folha);
      if (todosBtn) todosBtn.textContent = n === caixas.length ? 'Desmarcar todos' : 'Marcar todos';
    };
    caixas.forEach((c) => c.addEventListener('change', atualizarGrupo));
    $('#marcar-todos', folha)?.addEventListener('click', () => {
      const marcar = marcados().length !== caixas.length;
      caixas.forEach((c) => { c.checked = marcar; });
      atualizarGrupo();
    });
    // Não lembra o que foi: sai de "A definir" como "Não lembro" (junto com os parecidos marcados)
    $('#nao-lembro', folha).addEventListener('click', () => {
      escolhida = true;
      marcar(NAO_LEMBRO);
      $('#form-definir', folha).requestSubmit();
    });
    $('#pular', folha).addEventListener('click', () => revisarADefinir(app, new Set([...pulados, r.id])));
    $('#form-definir', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      // "Não lembro" não troca o nome do banco por um item
      const oque = categoria === NAO_LEMBRO ? '' : campo.value.trim();
      if (!categoria) {
        aviso('Escolha a categoria', 'erro');
        return;
      }
      const botao = $('button[type=submit]', folha);
      botao.disabled = true;
      try {
        const ids = new Set(marcados().map((c) => c.dataset.id));
        const grupo = [r, ...parecidos.map((p) => p.registro).filter((p) => ids.has(p.id))];
        // Todos do grupo recebem a mesma resposta: muda tudo de uma vez (um envio só para a nuvem)
        await store.atualizarVarios(grupo.map((g) => g.id), oque ? { item: oque, categoria } : { categoria });
        if (oque) {
          const confirmadas = grupo.map((g) => ({ chave: chaveDoRegistro(g), nome: g.local || g.item, item: oque, categoria, valor: g.valor }));
          const sempre = $('input[name=sempre]', folha)?.checked;
          await store.salvarEstabelecimentos([
            ...aprenderEstabelecimentos(confirmadas, store.estabelecimentos()), ...(sempre ? lembrarPorValor(confirmadas.slice(0, 1)) : []),
          ]).catch(() => {});
        }
        if (grupo.length > 1) aviso(`${grupo.length} gastos definidos como ${categoria}`);
        app.render();
        revisarADefinir(app, pulados);
      } catch (err) {
        botao.disabled = false;
        aviso(`Não salvou: ${err.message}`, 'erro');
      }
    });
  });
}
