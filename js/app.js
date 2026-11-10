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
    if (app.aba === 'inicio') raiz.insertAdjacentHTML('afterbegin', cartaoInstalar());
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
    $('#titulo-aba').textContent = app.aba === 'inicio' ? nomeDoMes() : ABAS[app.aba].nome;
    $('#app').classList.toggle('com-campo', app.aba === 'inicio');
    app.render();
    if (rolar) window.scrollTo({ top: 0 });
  },
};

function nomeDoMes() {
  const nome = new Date().toLocaleDateString('pt-BR', { month: 'long' });
  return nome.charAt(0).toUpperCase() + nome.slice(1);
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
    <h3 class="sec-titulo">Aplicativo</h3>
    ${blocoInstalar()}
    <p class="versao">Tio Patinhas · versão 4.5</p>`, (folha, fechar) => {
    $('#instalar-ajustes', folha)?.addEventListener('click', async () => {
      fechar();
      await instalar();
    });
    $$('[data-tema]', folha).forEach((b) => b.addEventListener('click', () => {
      tema.definir(b.dataset.tema);
      $$('[data-tema]', folha).forEach((x) => {
        const ativo = x === b;
        x.classList.toggle('ativo', ativo);
        x.setAttribute('aria-checked', String(ativo));
      });
    }));
    $('#trocar-senha', folha).addEventListener('click', () => abrirTrocarSenha());
    $('#sair', folha).addEventListener('click', async () => {
      if (!(await confirmar('Sair da conta neste aparelho? Seus dados continuam guardados na nuvem.', { sim: 'Sair', perigo: true }))) return;
      await store.sair();
      mostrarApp(false);
    });
  });
}

// ---------------------------------------------------------------- Instalar no celular
let pedidoInstalacao = null;
const instalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // mostramos o nosso botão em vez do aviso do Chrome
  pedidoInstalacao = e;
  app.render();
});
window.addEventListener('appinstalled', () => {
  pedidoInstalacao = null;
  aviso('App instalado ✓ Abra pelo ícone na tela inicial.');
  app.render();
});

export async function instalar() {
  if (!pedidoInstalacao) {
    abrirFolha('Instalar no celular', ajudaInstalar());
    return;
  }
  pedidoInstalacao.prompt();
  const { outcome } = await pedidoInstalacao.userChoice;
  if (outcome === 'accepted') pedidoInstalacao = null;
  app.render();
}

function ajudaInstalar() {
  return `
    <ol class="passos">
      <li>Abra <b>lh573x.github.io/Tio-Patinhas</b> no <b>Chrome</b>.</li>
      <li>Toque no menu <b>⋮</b> (canto de cima, à direita).</li>
      <li>Toque em <b>Instalar app</b>. Se só aparecer “Adicionar à tela inicial”, toque nele e depois em <b>Instalar</b>.</li>
      <li>Abra pelo novo ícone (o Tio Patinhas de cartola, no fundo dourado) na tela inicial.</li>
    </ol>
    <p class="dica">Se aparecer um ícone antigo que não abre, segure em cima dele e toque em <b>Desinstalar</b> ou <b>Remover</b>.</p>`;
}

function blocoInstalar() {
  if (instalado()) return `<p class="dica">${ICONES.ok} Você está usando o app instalado.</p>`;
  return `
    <div class="menu">
      <button type="button" class="menu-item" id="instalar-ajustes">${ICONES.importar}<span>Instalar no celular</span>${ICONES.avancar}</button>
    </div>`;
}

function cartaoInstalar() {
  let dispensado = false;
  try { dispensado = localStorage.getItem('tp.instalar.dispensado') === '1'; } catch { /* ignora */ }
  if (!pedidoInstalacao || instalado() || dispensado) return '';
  return `
    <section class="cartao instalar">
      <img src="icons/icon.svg" alt="" width="44" height="44">
      <div><b>Instale o app no celular</b><p class="dica">Abre direto da tela inicial, mais rápido.</p></div>
      <div class="instalar-acoes">
        <button type="button" class="btn primario" data-instalar>Instalar</button>
        <button type="button" class="link" data-instalar-depois>Agora não</button>
      </div>
    </section>`;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-instalar]')) instalar();
  if (e.target.closest('[data-instalar-depois]')) {
    try { localStorage.setItem('tp.instalar.dispensado', '1'); } catch { /* ignora */ }
    app.render();
  }
});

function abrirTrocarSenha(titulo = 'Trocar senha') {
  abrirFolha(titulo, `
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
  if (pedirNovaSenha) {
    pedirNovaSenha = false;
    abrirTrocarSenha('Crie sua nova senha');
  }
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

// Sem senha: o Supabase manda um link por email que abre o app já logado.
async function pedirLink(tipo) {
  const email = $('#login-email').value.trim();
  const msg = $('#login-aviso');
  msg.classList.remove('ok');
  if (!email) {
    msg.textContent = 'Digite seu email acima.';
    $('#login-email').focus();
    return;
  }
  msg.textContent = 'Enviando…';
  try {
    if (tipo === 'senha') await store.esqueciSenha(email);
    else await store.entrarComLink(email);
    msg.classList.add('ok');
    msg.textContent = tipo === 'senha'
      ? `Pronto! Abra o email que mandei para ${email} e toque no link pra criar uma senha nova.`
      : `Pronto! Abra o email que mandei para ${email} e toque no link pra entrar.`;
  } catch (e) {
    msg.textContent = e.message;
  }
}
$('#esqueci-senha').addEventListener('click', () => pedirLink('senha'));
$('#entrar-link').addEventListener('click', () => pedirLink('entrar'));

let pedirNovaSenha = window.__tpLinkEmail === 'senha';
store.aoMudarLogin((evento) => {
  if (evento === 'PASSWORD_RECOVERY') pedirNovaSenha = true;
  if (pedirNovaSenha && !$('#app').hidden) {
    pedirNovaSenha = false;
    abrirTrocarSenha('Crie sua nova senha');
  }
});

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
  .then((u) => {
    if (u) return aoEntrar();
    mostrarApp(false);
    if (window.__tpLinkEmail === 'expirado') {
      $('#login-aviso').textContent = 'Esse link do email expirou ou já foi usado. Peça outro abaixo.';
    }
    return null;
  })
  .catch(() => mostrarApp(false));

if ('serviceWorker' in navigator) {
  const tinhaVersao = Boolean(navigator.serviceWorker.controller);
  let versaoNova = false;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    // Ao voltar para o app, procura versão nova (o app instalado fica aberto por dias).
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  // Versão nova assumiu: recarrega quando for seguro (app em segundo plano ou sem folha aberta).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!tinhaVersao) return;
    versaoNova = true;
    if (!document.querySelector('.folha-fundo') && !($('#frase') && $('#frase').value)) location.reload();
  });
  document.addEventListener('visibilitychange', () => {
    if (versaoNova && document.visibilityState === 'hidden') location.reload();
  });
}
