// Sugestões de itens embaixo do campo onde você escreve o que foi o gasto:
// toque numa e o item fica escrito igual às outras vezes.
import { store } from '../store.js';
import { itensUsados, sugerirItens } from '../itens.js';
import { esc } from '../util.js';

/**
 * Liga as sugestões a um campo de texto.
 * - `caixa`: onde as sugestões aparecem (se não vier, é criada logo depois do campo).
 * - `tipo`: 'gasto' ou 'entrada' (sugere itens do mesmo tipo).
 * - `parte(valor)`: que pedaço do texto é o item e como trocar só ele
 *   (ex.: na frase "salg 8,50 pix", o item é "salg"). Padrão: o texto todo.
 */
export function ligarSugestoes(campo, { caixa, tipo = 'gasto', parte } = {}) {
  if (!campo || campo.dataset.sugestoes) return;
  campo.dataset.sugestoes = '1';
  if (!caixa) {
    caixa = document.createElement('div');
    campo.insertAdjacentElement('afterend', caixa);
  }
  caixa.classList.add('sugestoes-itens');
  caixa.hidden = true;
  caixa.setAttribute('aria-label', 'Itens que você já usou');
  const separar = parte || ((v) => ({ texto: v, trocar: (item) => item }));
  let itens = null; // calculado na primeira vez que precisar
  let atuais = [];

  const mostrar = () => {
    itens ||= itensUsados(store.listar(), tipo);
    atuais = sugerirItens(separar(campo.value).texto, itens);
    caixa.hidden = !atuais.length;
    caixa.innerHTML = atuais.map((it, i) => `<button type="button" class="chip-item" data-i="${i}">${esc(it.item)}${it.vezes > 1 ? `<small>${it.vezes}×</small>` : ''}</button>`).join('');
  };
  campo.addEventListener('input', mostrar);
  campo.addEventListener('focus', mostrar);
  campo.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== campo) caixa.hidden = true; }, 150));
  // Sem roubar o foco do campo (o teclado continua aberto no celular)
  caixa.addEventListener('pointerdown', (e) => e.preventDefault());
  caixa.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const it = atuais[Number(b.dataset.i)];
    if (!it) return;
    campo.value = separar(campo.value).trocar(it.item);
    campo.focus();
    const fim = campo.value.length;
    try { campo.setSelectionRange(fim, fim); } catch { /* campo sem seleção */ }
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
