// Contas fixas (aluguel, luz, internet...): lista do mês, cadastro e "Paguei".
import { CATEGORIAS_GASTO, METODOS } from '../parser.js';
import { statusContas, rotuloVencimento, refConta, mesDe } from '../analise.js';
import { store } from '../store.js';
import { $, $$, esc, reais, abrirFolha, confirmar, aviso, lerNumero, numeroParaCampo, ICONES, selo, hojeISO, horaAgora, dataCurta } from '../util.js';
import { avisoLimite } from './alertas.js';

const SELO_CONTA = { paga: 'ok', atrasada: 'estourou', hoje: 'atencao', breve: 'atencao', futura: 'neutro' };

function opcoes(lista, atual) {
  return lista.map((o) => `<option ${o === atual ? 'selected' : ''}>${esc(o)}</option>`).join('');
}

export function cardContas() {
  const status = statusContas(store.contas(), store.listar(), new Date());
  const total = status.reduce((t, s) => t + s.conta.valor, 0);
  const falta = status.filter((s) => !s.pagamento).reduce((t, s) => t + s.conta.valor, 0);
  return `
    <section class="cartao" id="contas">
      <div class="cartao-topo"><h2>Contas fixas</h2>
        <button type="button" class="chip-acao" id="nova-conta">${ICONES.mais}Nova conta</button></div>
      ${status.length ? `
        <p class="dica">${falta > 0 ? `Faltam <b>${reais(falta)}</b> de ${reais(total)} este mês.` : `Tudo pago este mês (${reais(total)}).`}</p>
        <ul class="lista-contas">${status.map((s) => `
          <li class="conta-linha" data-id="${s.conta.id}">
            <button type="button" class="conta-info editar-conta">
              <span class="conta-nome">${esc(s.conta.nome)}</span>
              <span class="conta-detalhe">${s.pagamento ? `pago em ${dataCurta(s.pagamento.data)}` : `vence ${dataCurta(s.vencimento)}`}${s.conta.metodo ? ` · ${esc(s.conta.metodo)}` : ''}</span>
            </button>
            <span class="conta-lado">
              <b>${reais(s.pagamento ? s.pagamento.valor : s.conta.valor)}</b>
              ${s.pagamento ? selo('Paga', 'ok')
                : `${selo(rotuloVencimento(s.dias, { diaDoMes: Number(s.vencimento.slice(8)) }), SELO_CONTA[s.estado])}`}
            </span>
            ${s.pagamento ? '' : '<button type="button" class="chip-acao pequeno pagar-conta">Paguei</button>'}
          </li>`).join('')}</ul>`
        : '<p class="vazio">Cadastre aluguel, luz, internet e assinaturas. Eu aviso quando estiver perto do vencimento e já conto na previsão do mês.</p>'}
    </section>`;
}

export function ligarContas(raiz, app) {
  $('#nova-conta', raiz)?.addEventListener('click', () => editarConta(null, app));
  $$('#contas .conta-linha', raiz).forEach((el) => {
    const conta = store.contas().find((c) => c.id === el.dataset.id);
    $('.editar-conta', el).addEventListener('click', () => editarConta(conta, app));
    $('.pagar-conta', el)?.addEventListener('click', () => pagarConta(conta, app));
  });
}

function editarConta(conta, app) {
  const nova = !conta;
  const c = conta || { nome: '', valor: '', dia_vencimento: '', categoria: 'Outros', metodo: '' };
  abrirFolha(nova ? 'Nova conta fixa' : 'Editar conta', `
    <form class="formulario" id="form-conta">
      <label class="campo">Nome<input name="nome" required placeholder="ex.: Conta de luz" value="${esc(c.nome)}"></label>
      <div class="dupla">
        <label class="campo">Valor por mês<input name="valor" inputmode="decimal" required placeholder="ex.: 180" value="${numeroParaCampo(c.valor)}"></label>
        <label class="campo">Dia do vencimento<input name="dia" inputmode="numeric" required placeholder="1 a 31" value="${c.dia_vencimento || ''}"></label>
      </div>
      <div class="dupla">
        <label class="campo">Categoria<select name="categoria">${opcoes(CATEGORIAS_GASTO, c.categoria)}</select></label>
        <label class="campo">Pagamento<select name="metodo"><option value="">—</option>${opcoes(METODOS, c.metodo)}</select></label>
      </div>
      <p class="dica">Se o valor muda todo mês (como a luz), coloque uma média. Na hora de pagar dá pra ajustar.</p>
      <div class="acoes-folha">
        ${nova ? '' : '<button type="button" class="btn perigo-texto" id="apagar-conta">Apagar</button>'}
        <button type="submit" class="btn primario">${nova ? 'Criar conta' : 'Salvar'}</button>
      </div>
    </form>`, (folha, fechar) => {
    $('#form-conta', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const valor = lerNumero(f.get('valor'));
      const dia = Number(String(f.get('dia')).trim());
      if (valor === null || valor < 0) { aviso('Diga o valor, ex.: 180', 'erro'); return; }
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) { aviso('O dia do vencimento vai de 1 a 31', 'erro'); return; }
      try {
        await store.salvarConta({ id: c.id, nome: f.get('nome').trim(), valor, dia_vencimento: dia, categoria: f.get('categoria'), metodo: f.get('metodo') || null });
        fechar();
        aviso(nova ? 'Conta criada ✓' : 'Conta salva ✓');
        app.render();
      } catch (err) {
        aviso(`Não salvou: ${err.message}`, 'erro');
      }
    });
    $('#apagar-conta', folha)?.addEventListener('click', async () => {
      if (!(await confirmar(`Apagar a conta “${c.nome}”? Os pagamentos já registrados continuam nos lançamentos.`, { sim: 'Apagar', perigo: true }))) return;
      try {
        await store.removerConta(c.id);
        aviso('Conta apagada');
        app.render();
      } catch (err) {
        aviso(err.message, 'erro');
      }
    });
  });
}

/** Registra o pagamento do mês: vira um gasto de hoje, marcado como conta fixa. */
export function pagarConta(conta, app) {
  const mes = mesDe(hojeISO());
  abrirFolha(`Pagar ${conta.nome}`, `
    <form class="formulario" id="form-pagar">
      <div class="dupla">
        <label class="campo">Valor pago<input name="valor" inputmode="decimal" required value="${numeroParaCampo(conta.valor)}"></label>
        <label class="campo">Pagamento<select name="metodo"><option value="">—</option>${opcoes(METODOS, conta.metodo)}</select></label>
      </div>
      <p class="dica">Vai para os lançamentos de hoje, em ${esc(conta.categoria)}.</p>
      <div class="acoes-folha"><button type="submit" class="btn primario largo">Registrar pagamento</button></div>
    </form>`, (folha, fechar) => {
    $('#form-pagar', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const valor = lerNumero(f.get('valor'));
      if (valor === null || valor < 0) { aviso('Valor inválido', 'erro'); return; }
      const metodo = f.get('metodo') || null;
      const cartoes = store.cartoes();
      const reg = { tipo: 'gasto', item: conta.nome, valor, metodo, categoria: conta.categoria || 'Outros',
        data: hojeISO(), hora: horaAgora(), origem: 'conta', refExterna: refConta(conta.id, mes),
        cartaoId: metodo === 'Crédito' && cartoes.length === 1 ? cartoes[0].id : null };
      try {
        const antes = store.listar();
        await store.adicionar([reg]);
        fechar();
        aviso([`${conta.nome} paga ✓`, avisoLimite(antes, [reg])].filter(Boolean).join('\n'));
        app.render();
      } catch (err) {
        aviso(`Não salvou: ${err.message}`, 'erro');
      }
    });
  });
}
