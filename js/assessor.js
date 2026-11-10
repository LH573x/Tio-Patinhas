// O que o Tio Patinhas tem a dizer hoje. Função pura (sem tela), para poder ser testada.
// Prioridade: um alerta ou dica de economia de verdade; senão um elogio; e, de vez em quando, um ditado.
import { dicas, resumoMes, mesDe, iso, nomeMes, somarMesesMes, formatador } from './analise.js';

const REAIS_0 = formatador({ style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmt = (v) => REAIS_0.format(v);

export const DITADOS = [
  { titulo: 'De grão em grão…', texto: 'Um cafezinho de R$ 6 todo dia útil vira uns R$ 130 no fim do mês. O miúdo é onde o dinheiro escapa.' },
  { titulo: 'Espere um dia antes de comprar', texto: 'Se amanhã você ainda quiser, compre. Metade das vontades passa sozinha.' },
  { titulo: 'Guarde primeiro, gaste depois', texto: 'Quando o salário cair, separe logo o que vai guardar. Gastar só o que sobra é mais fácil que sobrar o que não gastou.' },
  { titulo: 'Fatura inteira, sempre', texto: 'Pagar só o mínimo do cartão é o gasto mais caro que existe. Os juros comem tudo.' },
  { titulo: 'Promoção boa é a do que você já ia comprar', texto: 'Desconto em coisa que você não precisava não é economia, é gasto.' },
  { titulo: 'Anote até o chiclete', texto: 'Quem anota tudo sabe para onde o dinheiro vai. E o que a gente vê, a gente controla.' },
  { titulo: 'Assinatura esquecida é dinheiro jogado fora', texto: 'Dê uma olhada nos streamings e apps que cobram todo mês. Algum você nem usa mais?' },
];

const ALERTA = new Set(['limite', 'saldo', 'alta']);

function diaDoAno(hoje) {
  return Math.floor((hoje - new Date(hoje.getFullYear(), 0, 0)) / 864e5);
}

/**
 * Conselho do dia: { humor: normal | feliz | alerta, titulo, texto, ir? } ou null.
 * Os ditados aparecem só em alguns dias (um a cada `cadaDitado`), para o tio não ficar chato.
 */
export function conselhoDoDia({ registros = [], orcamentos = [], hoje = new Date(), cadaDitado = 3 } = {}) {
  // 1) Alerta ou dica com os números da pessoa ("registre suas entradas" fica para depois do elogio)
  const todas = dicas(registros, orcamentos, hoje, 10);
  const daDica = (d) => ({ humor: ALERTA.has(d.tipo) ? 'alerta' : 'normal', titulo: d.titulo, texto: d.texto,
    ir: d.tipo === 'limite' ? 'metas' : d.tipo === 'entradas' ? undefined : 'painel' });
  const d = todas.find((x) => x.tipo !== 'entradas');
  if (d) return daDica(d);

  // 2) Elogio: gastando menos que no mesmo ponto do mês passado
  const mes = mesDe(iso(hoje));
  const r = resumoMes(registros, mes, hoje, { previsao: false });
  if (r.dia >= 5 && r.variacao !== null && r.variacao <= -0.1 && r.anteriorMesmoPeriodo - r.gasto >= 50) {
    const menos = Math.round(-r.variacao * 100);
    return { humor: 'feliz', titulo: `Muito bem! ${menos}% a menos que no mês passado`,
      texto: `Até hoje foram ${fmt(r.gasto)}. Em ${nomeMes(somarMesesMes(mes, -1), { ano: false })}, até este dia, tinham sido ${fmt(r.anteriorMesmoPeriodo)}.`,
      ir: 'painel' };
  }

  const entradas = todas.find((x) => x.tipo === 'entradas');
  if (entradas) return daDica(entradas);

  // 3) Um ditado, de vez em quando
  const n = diaDoAno(hoje);
  if (n % cadaDitado !== 0) return null;
  const dit = DITADOS[Math.floor(n / cadaDitado) % DITADOS.length];
  return { humor: 'normal', ...dit };
}
