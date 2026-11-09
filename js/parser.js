// Interpreta frases como "salgado 8,50 pix" em um registro estruturado.
// Funciona no navegador e no Node (testes).

export const CATEGORIAS_GASTO = [
  'Refeições',
  'Alimentação geral',
  'Carro',
  'Namorada',
  'Viagens',
  'Outros',
];

export const CATEGORIAS_ENTRADA = ['Salário', 'Outras entradas'];

export const METODOS = ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Vale'];

// Palavras-chave (sem acento, minúsculas) -> categoria.
// A ordem importa: categorias "de contexto" (Namorada, Viagens) vêm primeiro,
// porque "jantar com a namorada" deve cair em Namorada, não em Refeições.
const PALAVRAS_CATEGORIA = [
  ['Namorada', ['namorada', 'namo', 'mozao', 'amor', 'presente pra ela', 'date']],
  ['Viagens', ['viagem', 'hotel', 'pousada', 'airbnb', 'passagem', 'aviao', 'voo', 'rodoviaria', 'hospedagem', 'mala']],
  ['Carro', ['gasolina', 'etanol', 'alcool', 'diesel', 'combustivel', 'abasteci', 'abastecer', 'posto', 'oleo', 'pneu',
    'mecanico', 'oficina', 'estacionamento', 'estacionei', 'pedagio', 'lava jato', 'lavagem', 'ipva', 'seguro do carro',
    'licenciamento', 'multa', 'revisao', 'carro', 'zona azul']],
  ['Alimentação geral', ['mercado', 'supermercado', 'feira', 'acougue', 'hortifruti', 'sacolao', 'atacadao', 'assai',
    'carrefour', 'padaria', 'arroz', 'feijao', 'carne', 'frango', 'ovos', 'leite', 'verdura', 'fruta', 'compras do mes']],
  ['Refeições', ['salgado', 'coxinha', 'pastel', 'lanche', 'almoco', 'janta', 'jantar', 'cafe', 'restaurante', 'ifood',
    'delivery', 'pizza', 'hamburguer', 'burger', 'mcdonalds', 'bk', 'marmita', 'self service', 'sorvete', 'acai',
    'refrigerante', 'cerveja', 'bar', 'lanchonete', 'esfiha', 'sushi', 'pao de queijo', 'refeicao', 'quentinha']],
];

const PALAVRAS_ENTRADA = ['recebi', 'salario', 'entrada', 'ganhei', 'reembolso', 'rendimento', 'pagamento recebido', 'caiu'];

const PALAVRAS_METODO = [
  ['Pix', ['pix']],
  ['Débito', ['debito']],
  ['Crédito', ['credito', 'cartao de credito', 'cartao']],
  ['Dinheiro', ['dinheiro', 'especie', 'cash']],
  ['Vale', ['vr', 'va', 'vale', 'vale refeicao', 'vale alimentacao', 'alelo', 'sodexo', 'ticket']],
];

// Palavras que não fazem parte do nome do item.
const PALAVRAS_DESCARTE = new Set([
  'no', 'na', 'em', 'de', 'do', 'da', 'com', 'o', 'a', 'um', 'uma', 'pelo', 'pela', 'via', 'por', 'pra', 'para',
  'reais', 'real', 'conto', 'contos', 'r$', 'paguei', 'gastei', 'comprei', 'foi', 'ontem', 'anteontem', 'hoje',
  'vezes', 'parcelado', 'parcelas', 'e',
]);

export function semAcento(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function contemPalavra(textoNorm, palavra) {
  const re = new RegExp(`(^|[^a-z0-9])${palavra.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?($|[^a-z0-9])`);
  return re.test(textoNorm);
}

// Converte "8,50", "8.50", "1.200,50", "1200" e "R$12" em número.
function paraNumero(token) {
  let t = token.replace(/^r\$/i, '');
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function dataISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

export function somarMeses(iso, meses) {
  const [y, m, d] = iso.split('-').map(Number);
  const alvo = new Date(y, m - 1 + meses, 1);
  const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(d, ultimoDia));
  return dataISO(alvo);
}

/**
 * Sugere a categoria de um item.
 * `regras` = regras aprendidas: [{ termo: 'posto shell', categoria: 'Carro' }, ...]
 */
export function sugerirCategoria(texto, tipo = 'gasto', regras = []) {
  const norm = semAcento(texto);
  for (const r of regras) {
    if (r.termo && contemPalavra(norm, semAcento(r.termo))) return r.categoria;
  }
  if (tipo === 'entrada') return contemPalavra(norm, 'salario') ? 'Salário' : 'Outras entradas';
  for (const [categoria, palavras] of PALAVRAS_CATEGORIA) {
    if (palavras.some((p) => contemPalavra(norm, p))) return categoria;
  }
  return 'Outros';
}

/**
 * Interpreta uma frase livre.
 * Retorna { tipo, item, valor, metodo, categoria, data, parcelas, valorParcela, local, hora, textoOriginal, completo }
 */
export function interpretar(frase, { hoje = new Date(), regras = [], cartoes = [] } = {}) {
  const textoOriginal = frase.trim();
  const norm = semAcento(textoOriginal);

  // Data
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (contemPalavra(norm, 'anteontem')) base.setDate(base.getDate() - 2);
  else if (contemPalavra(norm, 'ontem')) base.setDate(base.getDate() - 1);
  const data = dataISO(base);

  // Tipo
  const tipo = PALAVRAS_ENTRADA.some((p) => contemPalavra(norm, p)) ? 'entrada' : 'gasto';

  // Método de pagamento (o termo mais longo vence: "cartao de credito" antes de "cartao")
  let metodo = null;
  let termoMetodo = null;
  for (const [nome, termos] of PALAVRAS_METODO) {
    for (const t of termos) {
      if (contemPalavra(norm, t) && (!termoMetodo || t.length > termoMetodo.length)) {
        metodo = nome;
        termoMetodo = t;
      }
    }
  }

  // Parcelas: "3x", "em 3 vezes", "10x"
  let parcelas = 1;
  const mParc = norm.match(/(?:^|\s)(\d{1,2})\s*x(?=\s|$)/) || norm.match(/(?:^|\s)(\d{1,2})\s*vezes(?=\s|$)/);
  if (mParc) parcelas = Math.max(1, Number(mParc[1]));
  if (parcelas > 1 && !metodo) metodo = 'Crédito';

  // Valor: tokens numéricos, ignorando o número das parcelas
  const tokens = textoOriginal.split(/\s+/);
  const candidatos = [];
  tokens.forEach((tok, i) => {
    const limpo = tok.replace(/[;:!?]+$/, '').replace(/^r\$$/i, '');
    if (!/^(r\$)?\d[\d.,]*$/i.test(limpo)) return;
    if (mParc && /x$/i.test(tok)) return;
    if (mParc && semAcento(tokens[i + 1] || '') === 'vezes') return;
    const n = paraNumero(limpo.replace(/[.,]$/, ''));
    if (n === null) return;
    const prev = semAcento(tokens[i - 1] || '');
    const forte = /^r\$/i.test(limpo) || prev === 'r$' || /,\d{1,2}$/.test(limpo) || /\.\d{2}$/.test(limpo);
    candidatos.push({ i, n, forte });
  });
  let escolhido = candidatos.filter((c) => c.forte).pop() || candidatos[candidatos.length - 1] || null;
  const valor = escolhido ? Math.round(escolhido.n * 100) / 100 : null;

  const termosMetodo = new Set(PALAVRAS_METODO.flatMap(([, ts]) => ts.filter((t) => !t.includes(' '))));
  const normTok = (tok) => semAcento(tok || '').replace(/[.,;:!?]+$/, '');
  const usados = new Set();

  // Cartão pelo nome: "mercado 200 nubank", "jantar 90 no itaú" (o nome mais longo vence)
  let cartaoId = null;
  let melhor = 0;
  for (const c of cartoes) {
    const partes = semAcento(c.nome || '').split(/\s+/).filter(Boolean);
    if (!partes.length) continue;
    for (let i = 0; i + partes.length <= tokens.length; i++) {
      if (!partes.every((p, k) => normTok(tokens[i + k]) === p)) continue;
      if (partes.length <= melhor) continue;
      melhor = partes.length;
      cartaoId = c.id;
      for (let k = 0; k < partes.length; k++) usados.add(i + k);
      if (['no', 'na', 'pelo', 'pela', 'com'].includes(normTok(tokens[i - 1]))) usados.add(i - 1);
    }
  }
  if (cartaoId && (!metodo || metodo === 'Crédito')) metodo = 'Crédito';
  else if (cartaoId) cartaoId = null; // "débito nubank": não é compra no cartão de crédito

  // Horário: "15h", "15h30", "15:30", "às 9h", "meio-dia"
  let hora = null;
  tokens.forEach((tok, i) => {
    if (hora) return;
    const n = semAcento(tok).replace(/[.,;!?]+$/, '');
    let h = null;
    let m = 0;
    const mh = n.match(/^([01]?\d|2[0-3])(?:h([0-5]\d)?|:([0-5]\d)h?)$/);
    if (mh) {
      h = Number(mh[1]);
      m = Number(mh[2] || mh[3] || 0);
    } else if (n === 'meio-dia' || (n === 'meio' && normTok(tokens[i + 1]) === 'dia')) {
      h = 12;
      if (n === 'meio') usados.add(i + 1);
    }
    if (h === null) return;
    hora = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    usados.add(i);
    if (['as', 'a', 'ao'].includes(normTok(tokens[i - 1]))) usados.add(i - 1);
  });

  // Local: "... no posto shell", "... na padaria do zé", "... em Floripa"
  const GATILHOS = new Set(['no', 'na', 'nos', 'nas', 'em']);
  const PARADAS = new Set(['com', 'pelo', 'pela', 'por', 'via', 'pra', 'para', 'ontem', 'anteontem', 'hoje', 'as', 'pago', 'paguei', 'e']);
  const ehNumero = (tok) => /^(r\$)?\d[\d.,]*x?$/i.test(tok.replace(/[;:!?]+$/, ''));
  const ehParada = (i) => usados.has(i) || (escolhido && i === escolhido.i) || PARADAS.has(normTok(tokens[i]))
    || termosMetodo.has(normTok(tokens[i])) || ehNumero(tokens[i]) || normTok(tokens[i]) === 'r$' || normTok(tokens[i]) === 'vezes';
  let local = null;
  for (let t = 1; t < tokens.length - 1 && !local; t++) {
    if (!GATILHOS.has(normTok(tokens[t])) || ehParada(t + 1)) continue;
    const antes = tokens.slice(0, t).some((tok, i) => !(escolhido && i === escolhido.i) && !PALAVRAS_DESCARTE.has(normTok(tok)) && !ehNumero(tok) && !termosMetodo.has(normTok(tok)));
    if (!antes) continue;
    let fim = t + 1;
    while (fim < tokens.length && !ehParada(fim) && !GATILHOS.has(normTok(tokens[fim]))) fim++;
    while (fim > t + 1 && PALAVRAS_DESCARTE.has(normTok(tokens[fim - 1]))) fim--;
    const partes = tokens.slice(t + 1, fim).map((x) => x.replace(/[.,;:!?]+$/, ''));
    if (!partes.length) continue;
    local = partes.join(' ');
    local = local.charAt(0).toUpperCase() + local.slice(1);
    for (let i = t; i < fim; i++) usados.add(i);
  }

  // Item: o que sobra
  const palavrasItem = tokens.filter((tok, i) => {
    if (escolhido && i === escolhido.i) return false;
    if (usados.has(i)) return false;
    const n = semAcento(tok).replace(/[.,;:!?]+$/, '');
    if (!n) return false;
    if (PALAVRAS_DESCARTE.has(n)) return false;
    if (termosMetodo.has(n)) return false;
    if (/^\d{1,2}x$/.test(n)) return false;
    if (mParc && n === mParc[1]) return false;
    if (n === 'r$') return false;
    return true;
  });
  // remove artefatos de métodos compostos ("cartao de credito" -> "cartao" já saiu)
  let item = palavrasItem.join(' ').trim();
  if (tipo === 'entrada') item = item.replace(/^(recebi|ganhei|caiu)\s+/i, '').trim();
  if (!item) item = tipo === 'entrada' ? 'Entrada' : 'Gasto';
  item = item.charAt(0).toUpperCase() + item.slice(1);

  // A categoria vem primeiro do item ("coxinha no posto" é Refeições, não Carro);
  // se o item não disser nada, olha a frase inteira.
  let categoria = sugerirCategoria(item, tipo, regras);
  if (categoria === 'Outros' || categoria === 'Outras entradas') categoria = sugerirCategoria(textoOriginal, tipo, regras);
  const valorParcela = valor !== null && parcelas > 1 ? Math.round((valor / parcelas) * 100) / 100 : valor;

  return {
    tipo,
    item,
    valor,
    metodo,
    categoria,
    data,
    parcelas,
    valorParcela,
    local,
    hora,
    cartaoId,
    textoOriginal,
    completo: valor !== null,
  };
}

/** Transforma um registro parcelado em N lançamentos mensais. */
export function gerarLancamentos(reg) {
  if (!reg.parcelas || reg.parcelas <= 1) return [{ ...reg, parcela: null }];
  const lista = [];
  let acumulado = 0;
  for (let p = 1; p <= reg.parcelas; p++) {
    const ultima = p === reg.parcelas;
    const v = ultima ? Math.round((reg.valor - acumulado) * 100) / 100 : reg.valorParcela;
    acumulado += v;
    lista.push({
      ...reg,
      valor: v,
      data: somarMeses(reg.data, p - 1),
      parcela: `${p}/${reg.parcelas}`,
    });
  }
  return lista;
}

export function formatarReais(v) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
