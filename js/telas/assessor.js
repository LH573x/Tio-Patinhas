// Card do Tio Patinhas no Início: aparece quando ele tem um conselho, no máximo um por dia.
// Depois do "Valeu", ele só volta amanhã (ou antes, se aparecer um alerta novo), e não repete
// o mesmo conselho por alguns dias.
import { conselhoDoDia } from '../assessor.js';
import { mascote } from '../mascote.js';
import { store } from '../store.js';
import { esc, hojeISO, ICONES } from '../util.js';

const CHAVE = 'tp.assessor';
const DIAS_SILENCIO = 3;

function lerEstado() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; }
}
function guardarEstado(e) {
  try { localStorage.setItem(CHAVE, JSON.stringify(e)); } catch { /* ignora */ }
}

const APRESENTACAO = {
  humor: 'feliz',
  titulo: 'Muito prazer, eu sou o Tio Patinhas',
  texto: 'Sou seu assessor. De vez em quando apareço aqui com um conselho para o seu dinheiro render mais.',
};

function conselhoAtual() {
  const estado = lerEstado();
  if (!estado.apresentado) return { ...APRESENTACAO, apresentacao: true };
  const c = conselhoDoDia({ registros: store.listar(), orcamentos: store.orcamentos(), hoje: new Date() });
  if (!c) return null;
  // O mesmo conselho, depois do "Valeu", só volta daqui a uns dias.
  const visto = (estado.vistos || {})[c.titulo];
  if (visto && visto > hojeISO(-DIAS_SILENCIO)) return null;
  // Já dispensou um hoje: só aparece outro se for um alerta novo.
  if (estado.dia === hojeISO() && c.humor !== 'alerta') return null;
  return c;
}

const NOMES_ABA = { painel: 'Ver painel', metas: 'Ver metas' };

export function cardAssessor() {
  const c = conselhoAtual();
  if (!c) return '';
  return `
    <section class="assessor" data-humor="${c.humor}" aria-label="Conselho do Tio Patinhas">
      <div class="assessor-avatar">${mascote({ humor: c.humor })}</div>
      <div class="assessor-balao">
        <div class="assessor-nome">Tio Patinhas</div>
        <p class="assessor-titulo">${esc(c.titulo)}</p>
        <p class="assessor-texto">${esc(c.texto)}</p>
        <div class="assessor-acoes">
          <button type="button" class="link" data-assessor-ok data-titulo="${esc(c.titulo)}">${c.apresentacao ? 'Prazer!' : 'Valeu, tio'}</button>
          ${c.ir ? `<button type="button" class="link secundario" data-ir="${c.ir}">${NOMES_ABA[c.ir]}${ICONES.avancar}</button>` : ''}
        </div>
      </div>
    </section>`;
}

export function ligarAssessor(raiz, app) {
  raiz.querySelector('[data-assessor-ok]')?.addEventListener('click', (e) => {
    const b = e.currentTarget;
    const estado = lerEstado();
    const desde = hojeISO(-DIAS_SILENCIO);
    const vistos = Object.fromEntries(Object.entries(estado.vistos || {}).filter(([, dia]) => dia > desde));
    vistos[b.dataset.titulo] = hojeISO();
    guardarEstado({ apresentado: true, dia: hojeISO(), vistos });
    const card = raiz.querySelector('.assessor');
    if (card && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      card.classList.add('saindo');
      card.addEventListener('animationend', () => app.render(), { once: true });
    } else app.render();
  });
}
