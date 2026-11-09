// Texto do aviso de limite que aparece junto da confirmação de um gasto.
import { cruzouLimite } from '../analise.js';
import { store } from '../store.js';
import { pct } from '../util.js';

/** "Refeições chegou a 82% do limite" quando o gasto cruza 80% ou 100%; senão ''. */
export function avisoLimite(antes, novos) {
  const [c] = cruzouLimite(antes, novos, store.orcamentos(), new Date());
  if (!c) return '';
  return c.marco === 1 ? `${c.categoria} passou do limite (${pct(c.pct)})` : `${c.categoria} chegou a ${pct(c.pct)} do limite`;
}
