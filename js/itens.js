// Itens que você já usou ("Gasolina", "Almoço"...), para sugerir enquanto você
// escreve. Assim cada coisa fica sempre com o mesmo nome e dá para somar por item.
import { semAcento, A_DEFINIR, NAO_LEMBRO } from './parser.js';
import { quemDoRegistro } from './extrato.js';

/** Nome para comparar: sem acento, sem pontuação, minúsculo. */
export const chaveItem = (texto) => semAcento(String(texto || '')).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Nomes que o app põe sozinho quando não há item de verdade.
const GENERICOS = new Set(['gasto', 'entrada', chaveItem(NAO_LEMBRO)]);

/**
 * Lista os itens já usados, do mais frequente para o menos.
 * Cada item aparece uma vez, escrito do jeito que você mais usou.
 * Ficam de fora os que ainda são só o nome do banco (gastos "A definir",
 * "Pix enviado - Fulana") e os "Não lembro".
 * Retorna [{ item, chave, vezes, ultimo }].
 */
export function itensUsados(registros, tipo = 'gasto') {
  const grupos = new Map();
  for (const r of registros) {
    if (r.tipo !== tipo || !r.item || r.categoria === A_DEFINIR || r.categoria === NAO_LEMBRO) continue;
    const chave = chaveItem(r.item);
    if (!chave || GENERICOS.has(chave)) continue;
    const quem = quemDoRegistro(r);
    if (quem && [quem.original, quem.chave, r.local].some((n) => n && chaveItem(n) === chave)) continue;
    let g = grupos.get(chave);
    if (!g) grupos.set(chave, g = { chave, vezes: 0, ultimo: '', escritas: new Map() });
    g.vezes++;
    if ((r.data || '') > g.ultimo) g.ultimo = r.data || '';
    const nome = r.item.trim();
    g.escritas.set(nome, (g.escritas.get(nome) || 0) + 1);
  }
  return [...grupos.values()]
    .map(({ escritas, ...g }) => ({ ...g, item: [...escritas].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.vezes - a.vezes || b.ultimo.localeCompare(a.ultimo) || a.item.localeCompare(b.item));
}

/**
 * Sugestões para o que você está digitando: primeiro os itens em que alguma
 * palavra começa com o texto, depois os que só contêm o texto.
 * Não sugere o próprio texto quando ele já está escrito igual a um item.
 */
export function sugerirItens(texto, itens, limite = 5) {
  const t = chaveItem(texto);
  if (t.length < 2) return [];
  const comeco = [];
  const meio = [];
  for (const it of itens) {
    if (it.item === String(texto).trim()) continue;
    if (it.chave.startsWith(t) || it.chave.includes(` ${t}`)) comeco.push(it);
    else if (it.chave.includes(t)) meio.push(it);
  }
  return [...comeco, ...meio].slice(0, limite);
}

/**
 * Na frase do Início ("salgado 8,50 pix") o item é o começo, antes do primeiro número.
 * Trocar mantém o resto: "salg 8,50 pix" -> "Salgado 8,50 pix".
 */
export function itemDaFrase(valor) {
  const m = /^(\D*?)(\s*\d.*)?$/s.exec(valor) || ['', valor, ''];
  const resto = m[2] || '';
  return {
    texto: m[1],
    trocar: (item) => (resto ? `${item}${/^\s/.test(resto) ? '' : ' '}${resto}` : `${item} `),
  };
}
