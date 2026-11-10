// Linha de um registro e a folha de edição, usadas em várias telas.
import { CATEGORIAS_GASTO, CATEGORIAS_ENTRADA, METODOS } from '../parser.js';
import { store } from '../store.js';
import { $, $$, esc, reais, abrirFolha, confirmar, aviso, lerNumero, numeroParaCampo, ICONES } from '../util.js';
import { opcoesCartao } from './cartoes.js';
import { aprenderEstabelecimentos, lembrarPorValor, quemDoRegistro } from '../extrato.js';

export function bolinha(categoria, app) {
  return `<span class="bolinha" style="--cor:${app.cor(categoria)}" aria-hidden="true"></span>`;
}

export function linhaRegistro(r, app, { mostrarData = false } = {}) {
  const detalhe = [r.categoria, r.parcela ? r.parcela.replace('/', ' de ') : null, r.metodo,
    mostrarData ? r.data.split('-').reverse().slice(0, 2).join('/') : null, r.hora, r.local]
    .filter(Boolean).join(' · ');
  return `
    <button type="button" class="registro" data-id="${r.id}">
      ${bolinha(r.categoria, app)}
      <span class="registro-meio">
        <span class="registro-item">${esc(r.item)}</span>
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
  // Veio do extrato: mostra quem recebeu (ou pagou), com o nome que você deu, se deu.
  const quem = quemDoRegistro(r);
  const est = quem && store.estabelecimentos().find((e) => e.chave === quem.chave);
  const nomeQuem = quem ? (est && est.apelido) || r.local || quem.original : null;
  const rotuloQuem = r.tipo === 'entrada' ? 'Quem pagou' : 'Quem recebeu';
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
      ${r.tipo === 'gasto' && store.cartoes().length ? `
        <label class="campo" id="campo-cartao" ${r.metodo === 'Crédito' ? '' : 'hidden'}>Cartão<select name="cartao">${opcoesCartao(r.cartaoId)}</select></label>` : ''}
      <div class="dupla">
        ${quem
          ? `<label class="campo">${rotuloQuem}<input name="quem" value="${esc(nomeQuem)}" placeholder="${esc(quem.original)}"></label>`
          : `<label class="campo">Local<input name="local" value="${esc(r.local || '')}" placeholder="opcional"></label>`}
        <label class="campo">Horário<input name="hora" type="time" value="${r.hora || ''}"></label>
      </div>
      ${quem ? `<p class="dica">No banco: “${esc(String(r.textoOriginal || quem.original).replace(/\s+/g, ' '))}”. Se trocar o nome de quem recebeu (ex.: “Mãe”), ele vale para todas as transações de ${esc(quem.original)}, inclusive as próximas.</p>`
        : r.textoOriginal ? `<p class="dica">Você escreveu: “${esc(r.textoOriginal)}”</p>` : ''}
      <div class="acoes-folha">
        <button type="button" class="btn perigo-texto" id="apagar">${ICONES.lixo}Apagar</button>
        <button type="submit" class="btn primario">Salvar</button>
      </div>
    </form>`, (folha, fechar) => {
    $('select[name=metodo]', folha).addEventListener('change', (e) => {
      const campo = $('#campo-cartao', folha);
      if (campo) campo.hidden = e.target.value !== 'Crédito';
    });
    $('#form-editar', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const valor = lerNumero(f.get('valor'));
      if (valor === null || valor < 0) {
        aviso('Valor inválido', 'erro');
        return;
      }
      const metodo = f.get('metodo') || null;
      const m = { ...r, item: f.get('item').trim(), valor, data: f.get('data'), categoria: f.get('categoria'), metodo,
        local: quem ? r.local : (f.get('local') || '').trim() || null, hora: f.get('hora') || null,
        cartaoId: metodo === 'Crédito' ? (f.get('cartao') ?? r.cartaoId) || null : null };
      try {
        if (m.categoria !== r.categoria) await store.aprenderRegra(m.item, m.categoria);
        await store.atualizar(r.id, m);
        let renomeados = 0;
        const novoQuem = quem ? String(f.get('quem') || '').trim() : '';
        if (quem && novoQuem !== nomeQuem) {
          // Vale para todas as transações da mesma pessoa ou lugar
          const ids = store.listar().filter((x) => { const q = quemDoRegistro(x); return q && q.chave === quem.chave; }).map((x) => x.id);
          await store.renomearQuem(quem.chave, novoQuem && novoQuem !== quem.original ? novoQuem : null, ids, quem.original);
          renomeados = ids.length;
        }
        if (quem && r.categoria === 'A definir' && m.categoria !== 'A definir') {
          await store.salvarEstabelecimentos(aprenderEstabelecimentos(
            [{ chave: quem.chave, nome: quem.original, item: m.item, categoria: m.categoria }], store.estabelecimentos(),
          )).catch(() => {});
        }
        // Trocou o nome do banco pelo que foi comprado (ex.: "Cookie do Slack"): lembra "quem recebeu + valor"
        // para as próximas importações e já corrige as outras iguais que ainda estão com o nome do banco.
        let iguais = 0;
        const nomesDoBanco = new Set([quem && quem.original, nomeQuem, novoQuem, r.local].filter(Boolean));
        const corrigiu = quem && m.item && !nomesDoBanco.has(m.item) && m.categoria !== 'A definir'
          && (m.item !== r.item || m.categoria !== r.categoria);
        if (corrigiu) {
          await store.salvarEstabelecimentos(lembrarPorValor(
            [{ chave: quem.chave, nome: quem.original, item: m.item, categoria: m.categoria, valor: r.valor }],
          )).catch(() => {});
          const outras = store.listar().filter((x) => {
            if (x.id === r.id || x.tipo !== r.tipo || Math.abs(x.valor - r.valor) > 0.001) return false;
            const q = quemDoRegistro(x);
            return q && q.chave === quem.chave && (nomesDoBanco.has(x.item) || x.categoria === 'A definir');
          });
          for (const x of outras) await store.atualizar(x.id, { ...x, item: m.item, categoria: m.categoria });
          iguais = outras.length;
        }
        fechar();
        aviso(iguais ? `Corrigido. ${iguais === 1 ? 'Outra transação igual' : `Outras ${iguais} transações iguais`} (${reais(r.valor)} para ${quem.original}) também ${iguais === 1 ? 'virou' : 'viraram'} “${m.item}”.`
          : corrigiu ? `Corrigido. Da próxima vez, ${reais(r.valor)} para ${quem.original} já entra como “${m.item}”.`
          : renomeados > 1 ? `Corrigido. ${renomeados} transações agora aparecem como “${novoQuem || quem.original}”.`
          : m.categoria !== r.categoria ? `Corrigido. Da próxima vez, “${m.item}” vai para ${m.categoria}.` : 'Corrigido ✓');
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
