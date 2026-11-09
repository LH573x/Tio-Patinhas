// Tema: Claro (estilo A), Escuro (estilo B) ou Automático (segue o celular).
const CHAVE = 'tp.tema';
const midia = window.matchMedia('(prefers-color-scheme: dark)');
const ouvintes = new Set();
let memoria = null;

export function preferencia() {
  if (memoria) return memoria;
  try {
    return localStorage.getItem(CHAVE) || 'auto';
  } catch {
    return 'auto';
  }
}

export function efetivo() {
  const p = preferencia();
  if (p === 'claro') return 'claro';
  if (p === 'escuro') return 'escuro';
  return midia.matches ? 'escuro' : 'claro';
}

function aplicar() {
  const p = preferencia();
  const raiz = document.documentElement;
  if (p === 'auto') raiz.removeAttribute('data-theme');
  else raiz.setAttribute('data-theme', p === 'escuro' ? 'dark' : 'light');
  const cor = efetivo() === 'escuro' ? '#0b0d0c' : '#f5f6f4';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', cor);
  ouvintes.forEach((f) => f());
}

export function definir(p) {
  memoria = p;
  try {
    localStorage.setItem(CHAVE, p);
  } catch { /* sem armazenamento: vale só nesta sessão */ }
  aplicar();
}

export function aoMudar(f) {
  ouvintes.add(f);
}

midia.addEventListener('change', () => { if (preferencia() === 'auto') aplicar(); });
aplicar();
