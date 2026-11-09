// Casca do app: login, abas, cabeçalho, ajustes (tema, senha, sair).
import { store } from './store.js';
import * as tema from './tema.js';
import { infoCategoria } from './categorias.js';
import { mesDe, iso } from './analise.js';
import { $, $$, esc, aviso, abrirFolha, confirmar, ICONES } from './util.js';
import { telaInicio } from './telas/inicio.js';
import { telaLancamentos } from './telas/lancamentos.js';
import { telaPainel } from './telas/painel.js';
import { telaMetas } from './telas/metas.js';

const ABAS = {
  inicio: { nome: 'Início', icone: ICONES.inicio, tela: telaInicio },
  lancamentos: { nome: 'Lançamentos', icone: ICONES.lista, tela: telaLancamentos },
  painel: { nome: 'Painel', icone: ICONES.painel, tela: telaPainel },
  metas: { nome: 'Metas', icone: ICONES.metas, tela: telaMetas },
};
const ANTIGAS = { registrar: 'inicio', ontem: 'inicio', mes: 'painel' }; // atalhos da versão anterior

const app = {
  aba: 'inicio',
  mes: mesDe(iso(new Date())),
  cor(categoria) {
    const info = infoCategoria(categoria);
    return tema.efetivo() === 'escuro' ? info.corEscura : info.cor;
  },
  render() {
    const raiz = $('#conteudo');
    if (!raiz || $('#app').hidden) return;
    ABAS[app.aba].tela(raiz, app);
  },
  irPara(aba, { rolar = true } = {}) {
    app.aba = ABAS[aba] ? aba : 'inicio';
    if (app.aba === 'inicio') app.mes = mesDe(iso(new Date()));
    $$('.abas button').forEach((b) => {
      const ativa = b.dataset.aba === app.aba;
      b.classList.toggle('ativa', ativa);
      if (ativa) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    $('#titulo-aba').textContent = app.aba === 'inicio' ? saudacao() : ABAS[app.aba].nome;
    app.render();
    if (rolar) window.scrollTo({ top: 0 });
  },
};

function saudacao() {
  const h = new Date().getHours();
  if (h < 5) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ---------------------------------------------------------------- Navegação
$('.abas').innerHTML = Object.entries(ABAS).map(([id, a]) => `
  <button type="button" data-aba="${id}">${a.icone}<span>${a.nome}</span></button>`).join('');
$$('.abas button').forEach((b) => b.addEventListener('click', () => app.irPara(b.dataset.aba)));

// Links internos: qualquer elemento com data-ir="aba"
document.addEventListener('click', (e) => {
  const alvo = e.target.closest('[data-ir]');
  if (alvo) {
    e.preventDefault();
    app.irPara(alvo.dataset.ir);
  }
});

tema.aoMudar(() => app.render());

// ---------------------------------------------------------------- Ajustes
const OPCOES_TEMA = [
  { id: 'claro', nome: 'Claro', icone: ICONES.sol },
  { id: 'escuro', nome: 'Escuro', icone: ICONES.lua },
  { id: 'auto', nome: 'Automático', icone: ICONES.auto },
];

function seletorTema() {
  const atual = tema.preferencia();
  return `
    <div class="seletor-tema" role="radiogroup" aria-label="Aparência">
      ${OPCOES_TEMA.map((o) => `
        <button type="button" role="radio" aria-checked="${o.id === atual}" data-tema="${o.id}" class="${o.id === atual ? 'ativo' : ''}">
          ${o.icone}<span>${o.nome}</span></button>`).join('')}
    </div>`;
}

function abrirAjustes() {
  const email = store.email();
  abrirFolha('Ajustes', `
    <div class="conta">
      <span class="avatar grande" aria-hidden="true">${esc((email[0] || '?').toUpperCase())}</span>
      <div><b>Sua conta</b><small>${esc(email)}</small></div>
    </div>
    <h3 class="sec-titulo">Aparência</h3>
    ${seletorTema()}
    <p class="dica">Automático segue o modo do celular.</p>
    <h3 class="sec-titulo">Conta</h3>
    <div class="menu">
      <button type="button" class="menu-item" id="trocar-senha">${ICONES.chave}<span>Trocar senha</span>${ICONES.avancar}</button>
      <button type="button" class="menu-item perigo-texto" id="sair">${ICONES.sair}<span>Sair deste aparelho</span></button>
    </div>
    <p class="versao">Tio Patinhas · versão 3</p>`, (folha) => {
    $$('[data-tema]', folha).forEach((b) => b.addEventListener('click', () => {
      tema.definir(b.dataset.tema);
      $$('[data-tema]', folha).forEach((x) => {
        const ativo = x === b;
        x.classList.toggle('ativo', ativo);
        x.setAttribute('aria-checked', String(ativo));
      });
    }));
    $('#trocar-senha', folha).addEventListener('click', abrirTrocarSenha);
    $('#sair', folha).addEventListener('click', async () => {
      if (!(await confirmar('Sair da conta neste aparelho? Seus dados continuam guardados na nuvem.', { sim: 'Sair', perigo: true }))) return;
      await store.sair();
      mostrarApp(false);
    });
  });
}

function abrirTrocarSenha() {
  abrirFolha('Trocar senha', `
    <form class="formulario" id="form-senha">
      <label class="campo">Nova senha<input name="senha" type="password" autocomplete="new-password" minlength="6" required></label>
      <label class="campo">Repita a nova senha<input name="repetir" type="password" autocomplete="new-password" minlength="6" required></label>
      <div class="acoes-folha"><button type="submit" class="btn primario largo">Salvar nova senha</button></div>
    </form>`, (folha, fechar) => {
    $('#form-senha', folha).addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      if (f.get('senha') !== f.get('repetir')) { aviso('As duas senhas não são iguais', 'erro'); return; }
      try {
        await store.trocarSenha(f.get('senha'));
        fechar();
        aviso('Senha trocada ✓');
      } catch (err) {
        aviso(err.message, 'erro');
      }
    });
  });
}

$('#btn-ajustes').addEventListener('click', abrirAjustes);

// ---------------------------------------------------------------- Login
function mostrarApp(logado) {
  $('#tela-login').hidden = logado;
  $('#app').hidden = !logado;
  $('.abas').hidden = !logado;
  $('.topo').hidden = !logado;
  if (logado) {
    $('#btn-ajustes').innerHTML = esc((store.email()[0] || '?').toUpperCase());
  }
}

async function aoEntrar() {
  mostrarApp(true);
  app.irPara(app.aba, { rolar: false }); // mostra a cópia local na hora
  try {
    await store.carregar();
    const migrados = await store.migrarDadosAntigos();
    if (migrados) aviso(`${migrados} registros antigos enviados para a nuvem ✓`);
  } catch (e) {
    aviso(`Sem sincronizar: ${e.message}`, 'erro');
  }
  app.render();
}

async function enviarLogin(modo) {
  const email = $('#login-email').value.trim();
  const senha = $('#login-senha').value;
  const msg = $('#login-aviso');
  if (!email || !senha) {
    msg.textContent = 'Preencha email e senha.';
    return;
  }
  msg.textContent = modo === 'cadastrar' ? 'Criando conta…' : 'Entrando…';
  try {
    if (modo === 'cadastrar') {
      const { precisaConfirmar } = await store.cadastrar(email, senha);
      if (precisaConfirmar) {
        msg.textContent = 'Conta criada. Abra o email de confirmação e depois toque em Entrar.';
        return;
      }
    } else {
      await store.entrar(email, senha);
    }
    msg.textContent = '';
    await aoEntrar();
  } catch (e) {
    msg.textContent = e.message;
  }
}

$('#form-login').addEventListener('submit', (e) => {
  e.preventDefault();
  enviarLogin('entrar');
});
$('#criar-conta').addEventListener('click', () => enviarLogin('cadastrar'));

// Ao voltar para o app depois de um tempo, busca novidades (ex.: cupons lidos de madrugada).
let ultimaCarga = Date.now();
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || $('#app').hidden || Date.now() - ultimaCarga < 5 * 60e3) return;
  ultimaCarga = Date.now();
  try {
    await store.carregar();
    app.render();
  } catch { /* sem internet: segue com a cópia local */ }
});

// ---------------------------------------------------------------- Início
const pedida = new URLSearchParams(location.search).get('aba');
app.aba = ABAS[pedida] ? pedida : ANTIGAS[pedida] || 'inicio';
store.usuario()
  .then((u) => (u ? aoEntrar() : mostrarApp(false)))
  .catch(() => mostrarApp(false));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
