// Envio de cupom (foto) e de extrato (CSV/OFX lido na hora; PDF/print vai
// para a caixa de entrada que a rotina diária do Claude lê).
import { CATEGORIAS_GASTO, CATEGORIAS_ENTRADA, METODOS } from '../parser.js';
import { lerExtrato, decodificar, prepararImportacao } from '../extrato.js';
import { store } from '../store.js';
import { $, $$, esc, reais, abrirFolha, aviso, dataCurta, ICONES } from '../util.js';
import { bolinha } from './registro.js';

// ---------------------------------------------------------------- Fotos

/** Reduz a foto (máx. 1600px, JPEG) para enviar rápido e ocupar pouco espaço. */
async function comprimir(arquivo) {
  if (!arquivo.type.startsWith('image/') || arquivo.type === 'image/heic') return arquivo;
  try {
    const bmp = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.82));
    if (!blob || blob.size >= arquivo.size) return arquivo;
    return new File([blob], arquivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return arquivo;
  }
}

function escolherArquivo(accept, capture) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    if (capture) input.capture = 'environment';
    input.addEventListener('change', () => resolve(input.files[0] || null), { once: true });
    input.click();
  });
}

async function enviarParaCaixa(arquivo, tipo, app) {
  abrirFolha(tipo === 'cupom' ? 'Enviar cupom' : 'Enviar extrato', `
    <form class="formulario" id="form-caixa">
      <p class="arquivo-escolhido">${ICONES.arquivo}<span>${esc(arquivo.name)}</span></p>
      <label class="campo">Quer dizer algo sobre ele? (opcional)
        <input name="obs" placeholder="${tipo === 'cupom' ? 'ex.: jantar com a namorada, pago no crédito' : 'ex.: fatura do Nubank de outubro'}" data-autofoco="nao">
      </label>
      <p class="dica">${ICONES.relogio} O assessor lê ${tipo === 'cupom' ? 'a foto' : 'o arquivo'} de madrugada e cria os registros. Eles aparecem no card “Ontem” pra você conferir.</p>
      <div class="acoes-folha"><button type="submit" class="btn primario largo">Enviar</button></div>
    </form>`, (folha, fechar) => {
    $('#form-caixa', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      const botao = $('button[type=submit]', folha);
      botao.disabled = true;
      botao.textContent = 'Enviando…';
      try {
        const pronto = await comprimir(arquivo);
        await store.enviarParaCaixa(pronto, tipo, new FormData(e.target).get('obs'));
        fechar();
        aviso('Enviado ✓ O assessor lê de madrugada.');
        app.render();
      } catch (err) {
        botao.disabled = false;
        botao.textContent = 'Enviar';
        aviso(`Não enviou: ${err.message}`, 'erro');
      }
    });
  });
}

export async function enviarCupom(app) {
  const arquivo = await escolherArquivo('image/*', true);
  if (arquivo) enviarParaCaixa(arquivo, 'cupom', app);
}

export async function enviarExtrato(app) {
  const arquivo = await escolherArquivo('.csv,.ofx,.txt,.pdf,image/*,text/csv,application/pdf,application/x-ofx', false);
  if (!arquivo) return;
  const nome = arquivo.name.toLowerCase();
  if (/\.(csv|ofx|txt)$/.test(nome) || /csv|ofx/.test(arquivo.type)) {
    try {
      const texto = decodificar(await arquivo.arrayBuffer());
      const extrato = lerExtrato(texto);
      if (!extrato.transacoes.length) throw new Error('Não achei transações neste arquivo.');
      revisarImportacao(extrato, arquivo.name, app);
    } catch (err) {
      aviso(err.message, 'erro');
    }
    return;
  }
  enviarParaCaixa(arquivo, 'extrato', app);
}

// ---------------------------------------------------------------- Importação de CSV/OFX

function opcoes(lista, atual) {
  return lista.map((o) => `<option ${o === atual ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

function revisarImportacao(extrato, nomeArquivo, app) {
  const linhas = prepararImportacao(extrato, store.listar(), store.regras());
  const datas = linhas.map((l) => l.data).sort();
  const desenhar = () => linhas.map((l, i) => {
    const cats = l.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_GASTO;
    return `
      <div class="imp-linha ${l.selecionado ? '' : 'desmarcada'}" data-i="${i}">
        <label class="imp-check"><input type="checkbox" ${l.selecionado ? 'checked' : ''} aria-label="Importar ${esc(l.item)}"></label>
        ${bolinha(l.categoria, app)}
        <div class="imp-meio">
          <input class="imp-item" value="${esc(l.item)}" aria-label="Nome">
          <div class="imp-detalhe">
            <span>${dataCurta(l.data)}</span>
            <select class="imp-cat" aria-label="Categoria">${opcoes(cats, l.categoria)}</select>
            <select class="imp-met" aria-label="Pagamento"><option value="">—</option>${opcoes(METODOS, l.metodo)}</select>
          </div>
          ${l.aviso ? `<div class="imp-aviso ${l.situacao}">${esc(l.aviso)}</div>` : ''}
        </div>
        <span class="registro-valor ${l.tipo}">${l.tipo === 'entrada' ? '+' : ''}${reais(l.valor)}</span>
      </div>`;
  }).join('');
  const resumo = () => {
    const sel = linhas.filter((l) => l.selecionado);
    const g = sel.filter((l) => l.tipo === 'gasto').reduce((s, l) => s + l.valor, 0);
    const e = sel.filter((l) => l.tipo === 'entrada').reduce((s, l) => s + l.valor, 0);
    return { n: sel.length, g, e };
  };
  const puladas = linhas.filter((l) => !l.selecionado).length;

  abrirFolha('Revisar extrato', `
    <p class="dica">${esc(nomeArquivo)} · ${extrato.formato}${extrato.cartao ? ' · cartão de crédito' : ''} ·
      ${dataCurta(datas[0])} a ${dataCurta(datas[datas.length - 1])}</p>
    ${puladas ? `<p class="dica">${puladas} ${puladas === 1 ? 'linha ficou desmarcada' : 'linhas ficaram desmarcadas'} (já registradas, pagamento de fatura ou investimento). Marque se quiser incluir.</p>` : ''}
    <div class="imp-lista" id="imp-lista">${desenhar()}</div>
    <div class="acoes-folha fixa">
      <span id="imp-resumo" class="imp-resumo"></span>
      <button type="button" class="btn primario" id="imp-ok">Importar</button>
    </div>`, (folha, fechar) => {
    const lista = $('#imp-lista', folha);
    const atualizar = () => {
      const r = resumo();
      $('#imp-resumo', folha).innerHTML = `${r.n} ${r.n === 1 ? 'item' : 'itens'} · <b>${reais(r.g)}</b> em gastos${r.e ? ` · ${reais(r.e)} em entradas` : ''}`;
      $('#imp-ok', folha).textContent = r.n ? `Importar ${r.n}` : 'Nada marcado';
      $('#imp-ok', folha).disabled = !r.n;
    };
    lista.addEventListener('change', (e) => {
      const el = e.target.closest('.imp-linha');
      if (!el) return;
      const l = linhas[Number(el.dataset.i)];
      if (e.target.type === 'checkbox') {
        l.selecionado = e.target.checked;
        el.classList.toggle('desmarcada', !l.selecionado);
      } else if (e.target.classList.contains('imp-cat')) {
        l.categoria = e.target.value;
        l.categoriaManual = true;
        el.querySelector('.bolinha').outerHTML = bolinha(l.categoria, app);
      } else if (e.target.classList.contains('imp-met')) {
        l.metodo = e.target.value || null;
      } else if (e.target.classList.contains('imp-item')) {
        l.item = e.target.value.trim() || l.item;
      }
      atualizar();
    });
    atualizar();
    $('#imp-ok', folha).addEventListener('click', async () => {
      const escolhidas = linhas.filter((l) => l.selecionado);
      const botao = $('#imp-ok', folha);
      botao.disabled = true;
      botao.textContent = 'Importando…';
      try {
        const aprendidas = new Map();
        escolhidas.filter((l) => l.categoriaManual).forEach((l) => aprendidas.set(l.item, l.categoria));
        for (const [item, cat] of aprendidas) await store.aprenderRegra(item, cat);
        await store.adicionar(escolhidas.map((l) => ({
          tipo: l.tipo, item: l.item, valor: l.valor, metodo: l.metodo, categoria: l.categoria, data: l.data,
          origem: 'extrato', textoOriginal: l.descricao, refExterna: l.ref,
        })));
        fechar();
        aviso(`${escolhidas.length} ${escolhidas.length === 1 ? 'registro importado' : 'registros importados'} ✓`);
        app.render();
      } catch (err) {
        botao.disabled = false;
        atualizar();
        aviso(`Não importou: ${err.message}`, 'erro');
      }
    });
  });
}

// ---------------------------------------------------------------- Card da caixa de entrada

export function cardCaixa(app) {
  const itens = store.caixa();
  const pendentes = itens.filter((c) => c.status === 'pendente');
  const recentes = itens.filter((c) => c.status !== 'pendente' && c.processado_em
    && Date.now() - Date.parse(c.processado_em) < 3 * 864e5);
  if (!pendentes.length && !recentes.length) return '';
  const linha = (c) => {
    const nome = c.tipo === 'cupom' ? 'Cupom' : 'Extrato';
    let estado = `<span class="estado pendente">${ICONES.relogio}Na fila</span>`;
    if (c.status === 'processado') estado = `<span class="estado ok">${ICONES.ok}${c.registros_criados} ${c.registros_criados === 1 ? 'registro' : 'registros'}</span>`;
    if (c.status === 'erro') estado = `<span class="estado erro">${ICONES.alerta}Não consegui ler</span>`;
    return `
      <li class="caixa-item" data-id="${c.id}">
        <span class="caixa-icone" aria-hidden="true">${c.tipo === 'cupom' ? ICONES.camera : ICONES.arquivo}</span>
        <span class="caixa-meio"><b>${nome}</b>${c.observacao ? ` · ${esc(c.observacao)}` : ''}
          ${c.status === 'erro' && c.mensagem ? `<small>${esc(c.mensagem)}</small>` : ''}</span>
        ${estado}
        ${c.status === 'pendente' ? `<button type="button" class="icone-btn pequeno remover-caixa" aria-label="Cancelar envio">${ICONES.fechar}</button>` : ''}
      </li>`;
  };
  return `
    <section class="cartao">
      <div class="cartao-topo"><h2>Caixa de entrada</h2>
</div>
      <ul class="caixa-lista">${[...pendentes, ...recentes].map(linha).join('')}</ul>
    </section>`;
}

export function ligarCaixa(raiz, app) {
  $$('.remover-caixa', raiz).forEach((b) => b.addEventListener('click', async () => {
    const item = store.caixa().find((c) => c.id === b.closest('.caixa-item').dataset.id);
    if (!item) return;
    try {
      await store.removerDaCaixa(item);
      aviso('Envio cancelado');
      app.render();
    } catch (err) {
      aviso(err.message, 'erro');
    }
  }));
}
