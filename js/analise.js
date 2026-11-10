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
 * Lugares onde mais gastou no mês (só gastos com local preenchido).
 * Junta "Padaria do Zé" e "padaria do ze". Retorna [{ local, valor, vezes, categoria }]
 */
export function porLocal(registros, mes, hoje) {
  const mapa = new Map();
  const ateDia = hoje && mesDe(iso(hoje)) === mes ? hoje.getDate() : 31;
  for (const r of doMes(registros, mes, ateDia)) {
    if (r.tipo !== 'gasto' || !r.local) continue;
    const chave = r.local.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const atual = mapa.get(chave) || { local: r.local, valor: 0, vezes: 0, cats: new Map() };
    atual.valor = r2(atual.valor + r.valor);
    atual.vezes += 1;
    atual.cats.set(r.categoria, (atual.cats.get(r.categoria) || 0) + r.valor);
    mapa.set(chave, atual);
  }
  return [...mapa.values()]
    .map(({ cats, ...l }) => ({ ...l, categoria: [...cats.entries()].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => b.valor - a.valor);
}

/**
 * Resumo de um mês. Se for o mês atual, inclui a projeção até o fim do mês
 * e compara com o mês anterior até o mesmo dia (comparação justa).
 */
export function resumoMes(registros, mes, hoje, { contas = [], previsao = true } = {}) {
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
    projecao: previsao && emAndamento && dia > 0 ? previsaoGastos(registros, contas, hoje) : g,
    anteriorMesmoPeriodo: gAnteriorMesmoPeriodo,
    anteriorTotal: gAnteriorTotal,
    variacao: gAnteriorMesmoPeriodo > 0 ? (g - gAnteriorMesmoPeriodo) / gAnteriorMesmoPeriodo : null,
    categorias: porCategoria(gastos(regs)),
  };
}

/** Gasto que já tem valor certo: conta fixa paga ou parcela. Não entra no "ritmo" do dia a dia. */
const ehFixo = (r) => Boolean(r.parcela) || ehPagamentoConta(r);

/**
 * Previsão de gastos do mês atual:
 * ritmo dos gastos do dia a dia até hoje, projetado até o fim do mês
 * + contas fixas e parcelas (pagas ou ainda por vir, pelo valor certo).
 */
export function previsaoGastos(registros, contas, hoje) {
  const hojeISO = iso(hoje);
  const mes = mesDe(hojeISO);
  const dia = hoje.getDate();
  const doMesTodo = gastos(doMes(registros, mes));
  const ateHoje = doMesTodo.filter((r) => r.data <= hojeISO);
  const variaveis = soma(ateHoje.filter((r) => !ehFixo(r)));
  const fixosAteHoje = soma(ateHoje.filter(ehFixo));
  const jaLancadosDepois = soma(doMesTodo.filter((r) => r.data > hojeISO));
  const contasPendentes = statusContas(contas, registros, hoje)
    .filter((s) => !s.pagamento).reduce((t, s) => t + s.conta.valor, 0);
  return r2((variaveis / Math.max(dia, 1)) * diasNoMes(mes) + fixosAteHoje + jaLancadosDepois + contasPendentes);
}

// ---------------------------------------------------------------- Contas fixas

/** Referência do pagamento de uma conta fixa num mês (fica em registros.ref_externa). */
export const refConta = (id, mes) => `conta:${id}:${mes}`;
export const ehPagamentoConta = (r) => Boolean(r.refExterna && r.refExterna.startsWith('conta:'));

/** Data de um dia do mês, sem passar do último dia (dia 31 em fevereiro vira 28 ou 29). */
export function diaNoMes(dia, mes) {
  return `${mes}-${String(Math.min(dia, diasNoMes(mes))).padStart(2, '0')}`;
}

/** Dias de a até b (datas ISO). Positivo se b é depois de a. */
export function diasEntre(a, b) {
  return Math.round((deISO(b) - deISO(a)) / 864e5);
}

/**
 * Situação das contas fixas ativas no mês de `hoje`, por ordem de vencimento.
 * estado: paga | atrasada | hoje | breve (até 5 dias) | futura
 */
export function statusContas(contas, registros, hoje) {
  const hojeISO = iso(hoje);
  const mes = mesDe(hojeISO);
  const pagas = new Map(registros.filter(ehPagamentoConta).map((r) => [r.refExterna, r]));
  return contas
    .filter((c) => c.ativa !== false)
    .map((conta) => {
      const vencimento = diaNoMes(conta.dia_vencimento, mes);
      const pagamento = pagas.get(refConta(conta.id, mes)) || null;
      const dias = diasEntre(hojeISO, vencimento);
      let estado = 'futura';
      if (pagamento) estado = 'paga';
      else if (dias < 0) estado = 'atrasada';
      else if (dias === 0) estado = 'hoje';
      else if (dias <= 5) estado = 'breve';
      return { conta, vencimento, dias, pagamento, estado };
    })
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
}

/** Texto curto do vencimento: "Vence hoje", "Vence amanhã", "Em 3 dias", "Atrasada há 2 dias", "Dia 20". */
export function rotuloVencimento(dias, { pago = false, diaDoMes = null } = {}) {
  if (pago) return 'Paga';
  if (dias < 0) return dias === -1 ? 'Venceu ontem' : `Atrasada há ${-dias} dias`;
  if (dias === 0) return 'Vence hoje';
  if (dias === 1) return 'Vence amanhã';
  if (dias <= 5 || diaDoMes === null) return `Em ${dias} dias`;
  return `Dia ${diaDoMes}`;
}

// ---------------------------------------------------------------- Cartões e faturas

/**
 * Em qual fatura cai uma compra feita em `data`.
 * Compras a partir do dia do fechamento vão para a fatura seguinte.
 * Retorna { fechamento, vencimento } (datas ISO).
 */
export function faturaDaCompra(data, cartao) {
  const mesCompra = mesDe(data);
  const dia = Number(data.slice(8));
  const fechaEsteMes = diaNoMes(cartao.dia_fechamento, mesCompra);
  const mesFechamento = dia >= Number(fechaEsteMes.slice(8)) ? somarMesesMes(mesCompra, 1) : mesCompra;
  const fechamento = diaNoMes(cartao.dia_fechamento, mesFechamento);
  const mesVencimento = cartao.dia_vencimento > cartao.dia_fechamento ? mesFechamento : somarMesesMes(mesFechamento, 1);
  return { fechamento, vencimento: diaNoMes(cartao.dia_vencimento, mesVencimento) };
}

/**
 * Faturas de cada cartão. Gastos no crédito com `cartaoId`; cada parcela já é um
 * registro com a própria data, então cai sozinha na fatura certa.
 * Fatura com vencimento já passado é considerada paga.
 * Retorna [{ cartao, atual, proxima, usado, disponivel }], onde atual/proxima =
 * { fechamento, vencimento, valor, itens, fechada }.
 */
export function faturasCartoes(registros, cartoes, hoje) {
  const hojeISO = iso(hoje);
  return cartoes.map((cartao) => {
    const grupos = new Map();
    for (const r of registros) {
      if (r.tipo !== 'gasto' || r.cartaoId !== cartao.id) continue;
      const f = faturaDaCompra(r.data, cartao);
      if (f.vencimento < hojeISO) continue;
      const g = grupos.get(f.vencimento) || { ...f, valor: 0, itens: [] };
      g.valor = r2(g.valor + r.valor);
      g.itens.push(r);
      grupos.set(f.vencimento, g);
    }
    const abertas = [...grupos.values()].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    const corrente = faturaDaCompra(hojeISO, cartao);
    const atual = abertas[0] || { ...corrente, valor: 0, itens: [] };
    const proxima = abertas.find((f) => f.vencimento > atual.vencimento) || null;
    const usado = r2(abertas.reduce((t, f) => t + f.valor, 0));
    const marcar = (f) => f && { ...f, fechada: f.fechamento <= hojeISO };
    return {
      cartao,
      atual: marcar(atual),
      proxima: marcar(proxima),
      usado,
      disponivel: cartao.limite ? r2(cartao.limite - usado) : null,
    };
  });
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
  const r = resumoMes(registros, mes, hoje, { previsao: false });
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

/**
 * Categorias que cruzaram 80% ou 100% do limite com os gastos `novos`.
 * Retorna [{ categoria, pct, marco: 0.8 | 1 }]
 */
export function cruzouLimite(antes, novos, orcamentos, hoje) {
  const hojeISO = iso(hoje);
  const mes = mesDe(hojeISO);
  const doMesAteHoje = (lista, cat) => soma(gastos(lista).filter((r) => r.categoria === cat && mesDe(r.data) === mes && r.data <= hojeISO));
  const lista = [];
  for (const cat of new Set(gastos(novos).map((r) => r.categoria))) {
    const o = orcamentos.find((x) => x.categoria === cat && x.limite > 0);
    if (!o) continue;
    const a = doMesAteHoje(antes, cat) / o.limite;
    const d = (doMesAteHoje(antes, cat) + doMesAteHoje(novos, cat)) / o.limite;
    const marco = [1, 0.8].find((m) => a < m && d >= m);
    if (marco) lista.push({ categoria: cat, pct: d, marco });
  }
  return lista;
}

/**
 * Avisos do card do dia, por prioridade (máx. `maximo`):
 * contas e faturas vencendo, limites perto de estourar, quanto dá pra gastar por dia, caixa de entrada.
 * Cada aviso: { tipo, texto, selo?, tom } (tom: estourou | atencao | ok | neutro)
 */
export function avisosDoDia({ registros, orcamentos = [], contas = [], cartoes = [], caixaPendentes = 0, hoje, maximo = 4 }) {
  const lista = [];
  const hojeISO = iso(hoje);
  const mes = mesDe(hojeISO);
  const fmt0 = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const fmt2 = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // 1) Contas fixas atrasadas ou vencendo em até 3 dias
  for (const s of statusContas(contas, registros, hoje)) {
    if (s.pagamento || s.dias > 3) continue;
    const peso = s.dias < 0 ? 100 : 90 - s.dias;
    const texto = s.dias < 0 ? `${s.conta.nome} venceu ${s.dias === -1 ? 'ontem' : `há ${-s.dias} dias`}` : s.dias === 0 ? `${s.conta.nome} vence hoje` : `${s.conta.nome} vence ${s.dias === 1 ? 'amanhã' : `em ${s.dias} dias`}`;
    lista.push({ tipo: 'conta', id: s.conta.id, peso, texto, valor: fmt2(s.conta.valor), tom: s.dias <= 0 ? 'estourou' : 'atencao' });
  }

  // 2) Faturas fechadas vencendo em até 5 dias
  for (const f of faturasCartoes(registros, cartoes, hoje)) {
    if (!f.atual.fechada || f.atual.valor <= 0) continue;
    const dias = diasEntre(hojeISO, f.atual.vencimento);
    if (dias > 5) continue;
    lista.push({ tipo: 'fatura', peso: 85 - dias, tom: dias === 0 ? 'estourou' : 'atencao', valor: fmt2(f.atual.valor),
      texto: `Fatura do ${f.cartao.nome} ${dias === 0 ? 'vence hoje' : dias === 1 ? 'vence amanhã' : `vence em ${dias} dias`}` });
  }

  // 3) Limites de categoria em 80% ou mais
  for (const s of statusLimites(registros, orcamentos, mes, hoje)) {
    if (s.pct < 0.8) continue;
    const passou = s.gasto > s.limite;
    lista.push({ tipo: 'limite', peso: passou ? 70 : 60, tom: passou ? 'estourou' : 'atencao',
      texto: passou ? `${s.categoria} passou ${fmt0(s.gasto - s.limite)} do limite` : `${s.categoria} já usou ${Math.round(s.pct * 100)}% do limite`,
      valor: `${fmt0(s.gasto)} de ${fmt0(s.limite)}` });
  }

  // 4) Quanto dá pra gastar por dia até o fim do mês (se houver limites)
  const planejado = orcamentos.filter((o) => o.limite > 0).reduce((t, o) => t + o.limite, 0);
  if (planejado > 0) {
    const gasto = soma(gastos(doMes(registros, mes)).filter((r) => r.data <= hojeISO));
    const restantes = diasNoMes(mes) - hoje.getDate() + 1;
    const sobra = planejado - gasto;
    lista.push(sobra > 0
      ? { tipo: 'ritmo', peso: 40, tom: 'ok', texto: `Dá pra gastar ${fmt0(Math.floor(sobra / restantes))} por dia até o fim do mês` }
      : { tipo: 'ritmo', peso: 65, tom: 'estourou', texto: `O mês já passou ${fmt0(-sobra)} do planejado` });
  }

  // 5) Caixa de entrada
  if (caixaPendentes > 0) {
    lista.push({ tipo: 'caixa', peso: 30, tom: 'neutro',
      texto: caixaPendentes === 1 ? '1 envio esperando a leitura de madrugada' : `${caixaPendentes} envios esperando a leitura de madrugada` });
  }

  return lista.sort((a, b) => b.peso - a.peso).slice(0, maximo).map(({ peso, ...a }) => a);
}
