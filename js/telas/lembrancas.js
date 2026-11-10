// Lembranças "quem recebeu + valor": quando você troca o nome do banco pelo que comprou
// (ex.: R$ 10,00 para Mãe = Bolo), o app pergunta se é sempre isso. Se for, os próximos
// iguais do extrato já entram assim. Dá pra desligar uma por uma ou todas em Ajustes.
import { store } from '../store.js';
import { chaveValor, quemDoRegistro } from '../extrato.js';
import { A_DEFINIR } from '../parser.js';
import { $, $$, esc, reais, abrirFolha, aviso } from '../util.js';

const CHAVE_LIGADO = 'tp.lembrar-valor';

/** Perguntar e usar as lembranças por valor (ligado, a menos que você desligue em Ajustes). */
export function lembrarLigado() {
  try { return localStorage.getItem(CHAVE_LIGADO) !== '0'; } catch { return true; }
}

function ligar(sim) {
  try { localStorage.setItem(CHAVE_LIGADO, sim ? '1' : '0'); } catch { /* ignora */ }
}

const ehLembranca = (e) => e.chave.includes('#');

/** Estabelecimentos para a importação: sem as lembranças por valor, se estiverem desligadas. */
export function paraImportar() {
  const todos = store.estabelecimentos();
  return lembrarLigado() ? todos : todos.filter((e) => !ehLembranca(e));
}

/** Outras transações iguais (mesma pessoa e valor) que ainda não dizem o que foram. */
function iguaisSemNome(r, quem, nomesDoBanco) {
  return store.listar().filter((x) => {
    if (x.id === r.id || x.tipo !== r.tipo || Math.abs(x.valor - r.valor) > 0.001) return false;
    const q = quemDoRegistro(x);
    return q && q.chave === quem.chave && (nomesDoBanco.has(x.item) || x.categoria === A_DEFINIR);
  });
}

/**
 * Depois de salvar uma edição: se você trocou o nome do banco pelo que foi comprado, pergunta
 * se é sempre isso. Não pergunta de novo se você já disse que pode variar.
 */
export function talvezPerguntar({ r, m, quem, nome, nomesDoBanco, app }) {
  if (!quem || !lembrarLigado() || store.semEstabelecimentos) return false;
  if (!m.item || nomesDoBanco.has(m.item) || m.categoria === A_DEFINIR) return false;
  if (m.item === r.item && m.categoria === r.categoria) return false;
  const chave = chaveValor(quem.chave, r.valor);
  const atual = store.estabelecimentos().find((e) => e.chave === chave);
  if (atual && !atual.item) return false; // você já disse que pode variar
  if (atual && atual.item === m.item && atual.categoria === m.categoria) return false; // já lembrava isso
  const outras = iguaisSemNome(r, quem, nomesDoBanco);
  const verbo = r.tipo === 'entrada' ? `Todo valor de ${reais(r.valor)} que ${esc(nome)} te manda` : `Todo pagamento de ${reais(r.valor)} para ${esc(nome)}`;
  abrirFolha('Lembrar para as próximas?', `
    <p class="texto-confirmar">${verbo} é <b>“${esc(m.item)}”</b>?</p>
    ${atual ? `<p class="dica">Até agora ele entrava sozinho como “${esc(atual.item)}”.</p>` : ''}
    <p class="dica">Se for sempre, os próximos iguais que vierem no extrato já entram como “${esc(m.item)}” em ${esc(m.categoria)}${outras.length
      ? `, e ${outras.length === 1 ? 'outro igual que já está lançado também muda' : `outros ${outras.length} iguais que já estão lançados também mudam`}` : ''}.
      Se puder ser outra coisa, eles continuam esperando você dizer o que foi.</p>
    <div class="acoes-folha">
      <button type="button" class="btn secundario" data-r="varia">Pode variar</button>
      <button type="button" class="btn primario" data-r="sempre">É sempre isso</button>
    </div>
    <p class="dica">Dá pra desligar depois em Ajustes › Lembranças do extrato.</p>`, (folha, fechar) => {
    $$('[data-r]', folha).forEach((b) => b.addEventListener('click', async () => {
      fechar();
      if (b.dataset.r === 'sempre') {
        await store.salvarEstabelecimentos([{ chave, nome: quem.original, item: m.item, categoria: m.categoria, vezes: 3 }]);
        for (const x of outras) await store.atualizar(x.id, { ...x, item: m.item, categoria: m.categoria });
        aviso(outras.length ? `Combinado. ${outras.length + 1} transações agora são “${m.item}”.` : `Combinado. Os próximos já entram como “${m.item}”.`);
      } else {
        // Guarda que pode variar (sem item): não pergunta de novo e não preenche sozinho
        await store.salvarEstabelecimentos([{ chave, nome: quem.original, item: null, categoria: null, vezes: 0 }]);
        aviso('Combinado. Os próximos continuam esperando você dizer o que foi.');
      }
      app.render();
    }));
  });
  return true;
}

/** Ajustes › Lembranças do extrato: liga/desliga tudo e desliga uma por uma. */
export function abrirLembrancas() {
  const ests = store.estabelecimentos();
  const nomeDe = (chaveBase, e) => {
    const base = ests.find((x) => x.chave === chaveBase);
    return (base && base.apelido) || e.nome || chaveBase;
  };
  const lista = ests.filter((e) => ehLembranca(e) && e.item).map((e) => {
    const i = e.chave.lastIndexOf('#');
    return { ...e, quem: nomeDe(e.chave.slice(0, i), e), valor: Number(e.chave.slice(i + 1)) };
  }).sort((a, b) => a.quem.localeCompare(b.quem) || a.valor - b.valor);
  const ligado = lembrarLigado();
  abrirFolha('Lembranças do extrato', `
    <label class="interruptor">
      <span><b>Lembrar pessoa + valor</b><small>Quando você diz o que foi um Pix ou compra, pergunto se é sempre isso. Os próximos iguais entram sozinhos.</small></span>
      <input type="checkbox" id="lembrar-ligado" ${ligado ? 'checked' : ''}>
    </label>
    ${lista.length ? `
      <h3 class="sec-titulo">Entram sozinhos</h3>
      <ul class="lista-lembrancas">
        ${lista.map((e) => `
          <li><span><b>${reais(e.valor)}</b> para ${esc(e.quem)}<small>= ${esc(e.item)} · ${esc(e.categoria || '')}</small></span>
            <button type="button" class="btn secundario" data-desligar="${esc(e.chave)}">Desligar</button></li>`).join('')}
      </ul>` : '<p class="dica">Nenhuma ainda. Ao editar um lançamento do extrato e trocar o nome pelo que você comprou, eu pergunto se é sempre isso.</p>'}`, (folha) => {
    $('#lembrar-ligado', folha).addEventListener('change', (e) => {
      ligar(e.target.checked);
      aviso(e.target.checked ? 'Lembranças ligadas' : 'Lembranças desligadas: nada entra sozinho por valor');
    });
    $$('[data-desligar]', folha).forEach((b) => b.addEventListener('click', async () => {
      const e = lista.find((x) => x.chave === b.dataset.desligar);
      await store.salvarEstabelecimentos([{ chave: e.chave, nome: e.nome, item: null, categoria: null, vezes: 0 }]);
      b.closest('li').remove();
      aviso(`Desligado: ${reais(e.valor)} para ${e.quem} volta a perguntar o que foi`);
    }));
  });
}
