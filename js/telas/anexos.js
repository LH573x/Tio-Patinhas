// Envio de cupom (foto) e de extrato (CSV/OFX lido na hora; PDF/print vai
// para a caixa de entrada que a rotina diária do Claude lê).
import { CATEGORIAS_GASTO, CATEGORIAS_ENTRADA, METODOS, sugerirCategoria } from '../parser.js';
import { lerExtrato, decodificar, prepararImportacao, ajusteDoExtrato, aprenderEstabelecimentos, conferirSaldo } from '../extrato.js';
import { paraImportar } from './lembrancas.js';
import { store } from '../store.js';
import { $, $$, esc, reais, abrirFolha, aviso, dataCurta, selo, ICONES } from '../util.js';
import { bolinha } from './registro.js';
import { ligarSugestoes } from './sugestoes.js';

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

const QUIETAS = new Set(['importado', 'duplicado', 'ignorar']);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Linha já registrada que vai ser ajustada com os dados do extrato (e não importada de novo). */
const vaiAjustar = (l) => !l.selecionado && l.duplicadoDe
  && (l.situacao === 'duplicado' || (l.situacao === 'pergunta' && l.resposta_duplicado === 'mesmo'));

function revisarImportacao(extrato, nomeArquivo, app) {
  const regras = store.regras();
  const linhas = prepararImportacao(extrato, store.listar(), regras, paraImportar());
  const datas = linhas.map((l) => l.data).sort();
  const furos = conferirSaldo(extrato.transacoes);

  const desenharLinha = (l, i) => {
    const cats = l.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_GASTO;
    const perguntar = l.selecionado || !QUIETAS.has(l.situacao);
    let aviso = l.aviso ? `<div class="imp-aviso ${l.situacao}">${esc(l.aviso)}</div>` : '';
    if (l.situacao === 'pergunta') {
      const r = l.resposta_duplicado;
      aviso = `
        <div class="imp-pergunta">
          <span>${esc(l.aviso)}</span>
          <div class="imp-pergunta-botoes">
            <button type="button" class="chip-resposta ${r === 'mesmo' ? 'ativo' : ''}" data-dup="mesmo">É o mesmo</button>
            <button type="button" class="chip-resposta ${r === 'diferente' ? 'ativo' : ''}" data-dup="diferente">São diferentes</button>
          </div>
          ${r === 'mesmo' ? '<small>Ajusto o seu registro com o valor e a data do extrato.</small>' : ''}
        </div>`;
    }
    return `
      <div class="imp-linha ${l.selecionado ? '' : 'desmarcada'}" data-i="${i}">
        <label class="imp-check"><input type="checkbox" ${l.selecionado ? 'checked' : ''} aria-label="Importar ${esc(l.nome)}"></label>
        ${bolinha(l.categoria, app)}
        <div class="imp-meio">
          <div class="imp-nome">${esc(l.nome)}${l.automatico ? selo('automático', 'destaque') : ''}</div>
          ${perguntar ? `
            <input class="imp-oque" value="${esc(l.resposta)}" placeholder="O que foi? ex.: ${l.tipo === 'entrada' ? 'reembolso' : 'gasolina'}" aria-label="O que foi?" enterkeyhint="next">
            ${l.sugestao && !l.resposta ? `<div class="imp-sugestoes"><button type="button" class="chip-sugestao">${esc(l.sugestao)}</button></div>` : ''}` : ''}
          <div class="imp-detalhe">
            <span>${dataCurta(l.data)}</span>
            <select class="imp-cat" aria-label="Categoria">${opcoes(cats, l.categoria)}</select>
            <select class="imp-met" aria-label="Pagamento"><option value="">—</option>${opcoes(METODOS, l.metodo)}</select>
          </div>
          ${aviso}
        </div>
        <span class="registro-valor ${l.tipo}">${l.tipo === 'entrada' ? '+' : ''}${reais(l.valor)}</span>
      </div>`;
  };

  const conta = (sit) => linhas.filter((l) => l.situacao === sit).length;
  const avisosTopo = [
    conta('importado') ? plural(conta('importado'), 'linha já tinha sido importada', 'linhas já tinham sido importadas') : null,
    conta('duplicado') ? `${plural(conta('duplicado'), 'já estava registrada', 'já estavam registradas')} por você (ajusto com os dados do extrato)` : null,
    conta('ignorar') ? `${plural(conta('ignorar'), 'linha desmarcada', 'linhas desmarcadas')} (fatura, investimento ou transferência)` : null,
  ].filter(Boolean);

  abrirFolha('Revisar extrato', `
    <p class="dica">${esc(nomeArquivo)} · ${extrato.formato}${extrato.cartao ? ' · cartão de crédito' : ''} ·
      ${dataCurta(datas[0])} a ${dataCurta(datas[datas.length - 1])}</p>
    ${furos.length ? `<p class="imp-alerta">${ICONES.alerta}<span>O saldo não fecha ${furos.slice(0, 3).map((f) => `entre ${dataCurta(f.de)} e ${dataCurta(f.ate)}`).join(', ')}${furos.length > 3 ? ' e em outros pontos' : ''}.
      Pode estar faltando linha no arquivo: confira se exportou o período todo.</span></p>` : ''}
    ${avisosTopo.length ? `<p class="dica">${avisosTopo.join('. ')}. Marque uma linha se quiser incluir mesmo assim.</p>` : ''}
    ${conta('pergunta') ? `<p class="dica"><b>${plural(conta('pergunta'), 'linha parece', 'linhas parecem')} com algo que você já registrou.</b> Responda “É o mesmo” ou “São diferentes”; sem resposta, fica de fora.</p>` : ''}
    <p class="dica">Sem tempo agora? O que ficar sem resposta e sem categoria vai para <b>A definir</b>, e você revisa depois pelo Início.</p>
    <div class="imp-lista" id="imp-lista">${linhas.map(desenharLinha).join('')}</div>
    <div class="acoes-folha fixa">
      <span id="imp-resumo" class="imp-resumo"></span>
      <button type="button" class="btn primario" id="imp-ok">Importar</button>
    </div>`, (folha, fechar) => {
    const lista = $('#imp-lista', folha);
    const redesenhar = (el, i) => { el.outerHTML = desenharLinha(linhas[i], i); };
    const atualizar = () => {
      const sel = linhas.filter((l) => l.selecionado);
      const g = sel.filter((l) => l.tipo === 'gasto').reduce((s2, l) => s2 + l.valor, 0);
      const e = sel.filter((l) => l.tipo === 'entrada').reduce((s2, l) => s2 + l.valor, 0);
      const ajustes = linhas.filter(vaiAjustar).length;
      const semResposta = linhas.filter((l) => l.situacao === 'pergunta' && !l.resposta_duplicado).length;
      $('#imp-resumo', folha).innerHTML = [
        `${plural(sel.length, 'item', 'itens')} · <b>${reais(g)}</b> em gastos${e ? ` · ${reais(e)} em entradas` : ''}`,
        ajustes ? `${plural(ajustes, 'registro seu ajustado', 'registros seus ajustados')}` : '',
        semResposta ? `${plural(semResposta, 'pergunta sem resposta', 'perguntas sem resposta')}` : '',
      ].filter(Boolean).join(' · ');
      const total = sel.length + ajustes;
      $('#imp-ok', folha).textContent = sel.length ? `Importar ${sel.length}` : ajustes ? 'Ajustar' : 'Nada marcado';
      $('#imp-ok', folha).disabled = !total;
    };
    const definirResposta = (l, el, texto, categoria = null) => {
      l.resposta = texto.trim();
      l.item = l.resposta || l.nome;
      if (l.automatico) l.automatico = false;
      if (!l.categoriaManual) {
        const cat = categoria || (l.resposta ? sugerirCategoria(l.resposta, l.tipo, regras) : null);
        if (cat && cat !== 'Outros' && cat !== 'Outras entradas') {
          l.categoria = cat;
          el.querySelector('.imp-cat').value = cat;
          el.querySelector('.bolinha').outerHTML = bolinha(cat, app);
        }
      }
    };
    // Sugestões de itens já usados no "O que foi?" de cada linha
    lista.addEventListener('focusin', (e) => {
      if (!e.target.classList.contains('imp-oque')) return;
      const l = linhas[Number(e.target.closest('.imp-linha').dataset.i)];
      ligarSugestoes(e.target, { tipo: l.tipo });
      e.target.dispatchEvent(new Event('focus'));
    });
    lista.addEventListener('input', (e) => {
      if (!e.target.classList.contains('imp-oque')) return;
      const el = e.target.closest('.imp-linha');
      definirResposta(linhas[Number(el.dataset.i)], el, e.target.value);
    });
    lista.addEventListener('click', (e) => {
      const el = e.target.closest('.imp-linha');
      if (!el) return;
      const i = Number(el.dataset.i);
      const l = linhas[i];
      const sug = e.target.closest('.chip-sugestao');
      if (sug) {
        definirResposta(l, el, l.sugestao, l.sugestaoCategoria);
        el.querySelector('.imp-oque').value = l.resposta;
        sug.parentElement.remove();
        return;
      }
      const dup = e.target.closest('[data-dup]');
      if (dup) {
        l.resposta_duplicado = dup.dataset.dup;
        l.selecionado = l.resposta_duplicado === 'diferente';
        redesenhar(el, i);
        atualizar();
      }
    });
    lista.addEventListener('change', (e) => {
      const el = e.target.closest('.imp-linha');
      if (!el) return;
      const i = Number(el.dataset.i);
      const l = linhas[i];
      if (e.target.type === 'checkbox') {
        l.selecionado = e.target.checked;
        if (l.situacao === 'pergunta') l.resposta_duplicado = l.selecionado ? 'diferente' : null;
        redesenhar(el, i);
      } else if (e.target.classList.contains('imp-cat')) {
        l.categoria = e.target.value;
        l.categoriaManual = true;
        el.querySelector('.bolinha').outerHTML = bolinha(l.categoria, app);
      } else if (e.target.classList.contains('imp-met')) {
        l.metodo = e.target.value || null;
      }
      atualizar();
    });
    atualizar();
    $('#imp-ok', folha).addEventListener('click', async () => {
      const escolhidas = linhas.filter((l) => l.selecionado);
      const ajustes = linhas.filter(vaiAjustar);
      const botao = $('#imp-ok', folha);
      botao.disabled = true;
      botao.textContent = 'Importando…';
      try {
        const n = await store.importar(escolhidas.map((l) => ({
          tipo: l.tipo, item: l.item, valor: l.valor, metodo: l.metodo, categoria: l.categoria, data: l.data,
          local: l.local, origem: 'extrato', textoOriginal: l.descricao, refExterna: l.ref, estabelecimento: l.estabelecimento,
        })));
        // O extrato vale mais: o que você já tinha registrado fica com o valor, a data e a forma de pagamento do banco.
        const confirmadas = escolhidas.filter((l) => l.resposta)
          .map((l) => ({ chave: l.estabelecimento, nome: l.nome, item: l.resposta, categoria: l.categoria }));
        let ajustados = 0;
        for (const l of ajustes) {
          const existente = store.listar().find((r) => r.id === l.duplicadoDe);
          if (!existente) continue;
          try {
            await store.atualizar(existente.id, ajusteDoExtrato(existente, l));
            ajustados++;
            confirmadas.push({ chave: l.estabelecimento, nome: l.nome, item: existente.item, categoria: existente.categoria });
          } catch { /* segue com os outros */ }
        }
        const regrasNovas = new Map();
        escolhidas.filter((l) => l.categoriaManual).forEach((l) => regrasNovas.set(l.item, l.categoria));
        // Aprender não pode atrapalhar a importação, que já foi feita.
        await Promise.all([
          ...[...regrasNovas].map(([item, cat]) => store.aprenderRegra(item, cat).catch(() => {})),
          store.salvarEstabelecimentos(aprenderEstabelecimentos(confirmadas, store.estabelecimentos()))
            .catch(() => {}),
        ]);
        fechar();
        const pulados = escolhidas.length - n;
        aviso([
          `${plural(n, 'registro importado', 'registros importados')} ✓`,
          ajustados ? plural(ajustados, 'ajustado com o extrato', 'ajustados com o extrato') : '',
          pulados ? `${pulados} já estavam lá` : '',
        ].filter(Boolean).join(' · '));
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
