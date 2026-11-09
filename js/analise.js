// Cálculos do painel: totais, comparações, limites, semana e dicas.
// Funções puras (sem tela), para poderem ser testadas.
import { semAcento } from './parser.js';

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto',
  'setembro', 'outubro', 'novembro', 'dezembro'];
export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const r2 = (v) => Math.round(v * 100) / 100;

export function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function deISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function somarDias(s, n) {
  const d = deISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

export function mesDe(s) {
  return s.slice(0, 7);
}

export function somarMesesMes(mes, n) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function diasNoMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function nomeMes(mes, { ano = true } = {}) {
  const [y, m] = mes.split('-').map(Number);
  return ano ? `${MESES[m - 1]} de ${y}` : MESES[m - 1];
}

const soma = (lista) => r2(lista.reduce((s, r) => s + r.valor, 0));
const gastos = (lista) => lista.filter((r) => r.tipo === 'gasto');
const entradas = (lista) => lista.filter((r) => r.tipo === 'entrada');

/** Registros de um mês, opcionalmente só até um dia (inclusive). */
export function doMes(registros, mes, ateDia = 31) {
  return registros.filter((r) => mesDe(r.data) === mes && Number(r.data.slice(8)) <= ateDia);
}

export function porCategoria(registros) {
  const mapa = new Map();
  for (const r of registros) mapa.set(r.categoria, r2((mapa.get(r.categoria) || 0) + r.valor));
  return [...mapa.entries()].map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
}

/**
 * Resumo de um mês. Se for o mês atual, inclui a projeção até o fim do mês
 * e compara com o mês anterior até o mesmo dia (comparação justa).
 */
export function resumoMes(registros, mes, hoje) {
  const hojeISO = iso(hoje);
  const mesAtual = mesDe(hojeISO);
  const emAndamento = mes === mesAtual;
  const dia = emAndamento ? hoje.getDate() : diasNoMes(mes);
  const regs = doMes(registros, mes).filter((r) => r.data <= hojeISO || !emAndamento);
  const g = soma(gastos(regs));
  const e = soma(entradas(regs));
  const anterior = somarMesesMes(mes, -1);
  const gAnteriorMesmoPeriodo = soma(gastos(doMes(registros, anterior, dia)));
  const gAnteriorTotal = soma(gastos(doMes(registros, anterior)));
  const total = diasNoMes(mes);
  return {
    mes,
    emAndamento,
    gasto: g,
    entrada: e,
    saldo: r2(e - g),
    dia,
    diasNoMes: total,
    projecao: emAndamento && dia > 0 ? r2((g / dia) * total) : g,
    anteriorMesmoPeriodo: gAnteriorMesmoPeriodo,
    anteriorTotal: gAnteriorTotal,
    variacao: gAnteriorMesmoPeriodo > 0 ? (g - gAnteriorMesmoPeriodo) / gAnteriorMesmoPeriodo : null,
    categorias: porCategoria(gastos(regs)),
  };
}

/** Gastos (e entradas) dos últimos n meses terminando em `mes`. */
export function historicoMeses(registros, mes, n = 6, hoje = null) {
  const hojeISO = hoje ? iso(hoje) : '9999-12-31';
  const lista = [];
  for (let i = n - 1; i >= 0; i--) {
    const m = somarMesesMes(mes, -i);
    const regs = doMes(registros, m).filter((r) => r.data <= hojeISO);
    lista.push({ mes: m, gasto: soma(gastos(regs)), entrada: soma(entradas(regs)) });
  }
  return lista;
}

/**
 * Situação de cada limite do mês.
 * estado: 'ok' | 'atencao' (passou de 80% ou a projeção passa do limite) | 'estourou'
 */
export function statusLimites(registros, orcamentos, mes, hoje) {
  const r = resumoMes(registros, mes, hoje);
  const gastoCat = new Map(r.categorias.map((c) => [c.categoria, c.valor]));
  return orcamentos
    .filter((o) => o.limite > 0)
    .map((o) => {
      const gasto = gastoCat.get(o.categoria) || 0;
      const projecao = r.emAndamento ? r2((gasto / Math.max(r.dia, 1)) * r.diasNoMes) : gasto;
      const pct = gasto / o.limite;
      let estado = 'ok';
      if (gasto > o.limite) estado = 'estourou';
      else if (pct >= 0.8 || (r.emAndamento && r.dia >= 5 && projecao > o.limite)) estado = 'atencao';
      return { categoria: o.categoria, limite: o.limite, gasto, pct, projecao, restante: r2(o.limite - gasto), estado };
    });
}

/** Última semana completa (segunda a domingo) antes de `hoje`, comparada com a anterior. */
export function resumoSemana(registros, hoje) {
  const diaSemana = (hoje.getDay() + 6) % 7; // 0 = segunda
  const segundaAtual = somarDias(iso(hoje), -diaSemana);
  const inicio = somarDias(segundaAtual, -7);
  const fim = somarDias(segundaAtual, -1);
  const naSemana = (a, b) => gastos(registros).filter((r) => r.data >= a && r.data <= b);
  const regs = naSemana(inicio, fim);
  const anteriores = naSemana(somarDias(inicio, -7), somarDias(inicio, -1));
  const total = soma(regs);
  const totalAnterior = soma(anteriores);
  return {
    inicio,
    fim,
    total,
    totalAnterior,
    variacao: totalAnterior > 0 ? (total - totalAnterior) / totalAnterior : null,
    quantidade: regs.length,
    categorias: porCategoria(regs),
    maiores: [...regs].sort((a, b) => b.valor - a.valor).slice(0, 3),
  };
}

function chaveItem(item) {
  return semAcento(item).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

const fmt = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

/**
 * Dicas de onde economizar, em ordem de importância (máx. `limite`).
 * Cada dica: { tipo, titulo, texto, economia? }
 */
export function dicas(registros, orcamentos, hoje, limite = 4) {
  const lista = [];
  const mes = mesDe(iso(hoje));
  const r = resumoMes(registros, mes, hoje);

  // 1) Limites estourados ou a caminho
  for (const s of statusLimites(registros, orcamentos, mes, hoje)) {
    if (s.estado === 'estourou') {
      lista.push({ tipo: 'limite', categoria: s.categoria, peso: 100, titulo: `${s.categoria} passou do limite`,
        texto: `Já foram ${fmt(s.gasto)} de ${fmt(s.limite)} este mês.` });
    } else if (s.estado === 'atencao' && s.projecao > s.limite) {
      lista.push({ tipo: 'limite', categoria: s.categoria, peso: 90, titulo: `${s.categoria} vai passar do limite`,
        texto: `No ritmo atual, fecha o mês em ${fmt(s.projecao)}, ${fmt(s.projecao - s.limite)} acima de ${fmt(s.limite)}.` });
    }
  }

  // 2) Categoria bem acima da média dos 3 meses anteriores (comparando o mesmo período)
  if (r.emAndamento && r.dia >= 7) {
    const jaAvisadas = new Set(lista.map((d) => d.categoria));
    for (const c of r.categorias) {
      if (jaAvisadas.has(c.categoria)) continue;
      const anteriores = [1, 2, 3].map((i) => {
        const m = somarMesesMes(mes, -i);
        return soma(gastos(doMes(registros, m, r.dia)).filter((x) => x.categoria === c.categoria));
      });
      const comDados = anteriores.filter((v) => v > 0);
      if (!comDados.length) continue;
      const media = comDados.reduce((a, b) => a + b, 0) / comDados.length;
      if (c.valor > media * 1.25 && c.valor - media >= 50) {
        const pct = Math.round(((c.valor - media) / media) * 100);
        lista.push({ tipo: 'alta', peso: 70 + Math.min(pct / 10, 15), titulo: `${c.categoria} está ${pct}% acima do normal`,
          texto: `Até hoje: ${fmt(c.valor)}. Nos meses anteriores, até este dia, a média era ${fmt(media)}.` });
      }
    }
  }

  // 3) Pequenos gastos que se repetem nos últimos 30 dias
  const desde = somarDias(iso(hoje), -29);
  const recentes = gastos(registros).filter((x) => x.data >= desde && x.data <= iso(hoje) && !x.parcela);
  const grupos = new Map();
  for (const x of recentes) {
    const k = chaveItem(x.item);
    if (!k) continue;
    const g = grupos.get(k) || { item: x.item, vezes: 0, total: 0 };
    g.vezes += 1;
    g.total = r2(g.total + x.valor);
    grupos.set(k, g);
  }
  const frequentes = [...grupos.values()].filter((g) => g.vezes >= 4 && g.total >= 40).sort((a, b) => b.total - a.total);
  if (frequentes.length) {
    const g = frequentes[0];
    lista.push({ tipo: 'frequente', peso: 60, titulo: `${g.item}: ${g.vezes} vezes em 30 dias`,
      texto: `Somou ${fmt(g.total)}. Cortar pela metade economiza uns ${fmt(g.total / 2)} por mês.`, economia: r2(g.total / 2) });
  }

  // 4) Comer fora x cozinhar
  const fora = r.categorias.find((c) => c.categoria === 'Refeições')?.valor || 0;
  const mercado = r.categorias.find((c) => c.categoria === 'Alimentação geral')?.valor || 0;
  if (fora >= 200 && fora > mercado * 1.5) {
    lista.push({ tipo: 'comida', peso: 50, titulo: 'Comer fora pesa mais que o mercado',
      texto: `Este mês: ${fmt(fora)} em refeições e ${fmt(mercado)} no mercado. Trocar algumas refeições fora por comida feita em casa costuma render boa economia.` });
  }

  // 5) Gastou mais do que entrou
  if (r.entrada > 0 && r.gasto > r.entrada) {
    lista.push({ tipo: 'saldo', peso: 95, titulo: 'Os gastos passaram das entradas',
      texto: `Saíram ${fmt(r.gasto)} e entraram ${fmt(r.entrada)} este mês.` });
  } else if (r.entrada === 0 && r.gasto > 0 && r.dia >= 10) {
    lista.push({ tipo: 'entradas', peso: 10, titulo: 'Registre suas entradas',
      texto: 'Escreva algo como "recebi salário 3500" para ver quanto sobra no mês.' });
  }

  return lista.sort((a, b) => b.peso - a.peso).slice(0, limite).map(({ peso, ...d }) => d);
}

/** Quanto guardar por mês para chegar na meta até o prazo. */
export function planoMeta(meta, hoje) {
  const falta = r2(Math.max(meta.valor_alvo - meta.valor_atual, 0));
  const pct = Math.min(meta.valor_atual / meta.valor_alvo, 1);
  let porMes = null;
  let mesesRestantes = null;
  if (meta.prazo && falta > 0) {
    const p = deISO(meta.prazo);
    mesesRestantes = (p.getFullYear() - hoje.getFullYear()) * 12 + (p.getMonth() - hoje.getMonth());
    mesesRestantes = Math.max(mesesRestantes, 1);
    porMes = r2(falta / mesesRestantes);
  }
  return { falta, pct, porMes, mesesRestantes, concluida: falta === 0 };
}
