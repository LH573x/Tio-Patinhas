// Leitura de extratos bancários (OFX e CSV) direto no app, sem IA.
// Funciona com os formatos mais comuns dos bancos brasileiros
// (Nubank, Inter, Itaú, Bradesco, BB, Caixa, C6, Santander...).
import { semAcento, sugerirCategoria, A_DEFINIR } from './parser.js';

const r2 = (v) => Math.round(v * 100) / 100;

/** Converte os bytes do arquivo em texto (UTF-8 ou Windows-1252, comum em OFX). */
export function decodificar(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

/** "1.234,56", "-12,50", "12.50", "R$ 8,90", "(15,00)" -> número */
export function lerValor(txt) {
  if (txt === undefined || txt === null) return null;
  let s = String(txt).trim().replace(/\s|R\$|BRL/gi, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  const ultVirg = s.lastIndexOf(',');
  const ultPonto = s.lastIndexOf('.');
  if (ultVirg >= 0 && ultPonto >= 0) {
    s = ultVirg > ultPonto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (ultVirg >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

/** "09/11/2026", "9/11/26", "2026-11-09", "09-11-2026", "20261109" -> "2026-11-09" */
export function lerData(txt) {
  const s = String(txt || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// ---------------------------------------------------------------- OFX

function campo(bloco, tag) {
  const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'));
  return m ? m[1].trim() : '';
}

function lerOFX(texto) {
  const cartao = /<CCSTMTRS>/i.test(texto);
  const conta = campo(texto, 'ACCTID') || 'conta';
  const banco = campo(texto, 'ORG') || campo(texto, 'BANKID') || '';
  const transacoes = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  for (const b of blocos) {
    const bloco = b.split(/<\/STMTTRN>/i)[0];
    const valor = lerValor(campo(bloco, 'TRNAMT').replace(',', '.'));
    const data = lerData(campo(bloco, 'DTPOSTED'));
    if (valor === null || !data || valor === 0) continue;
    const descricao = campo(bloco, 'MEMO') || campo(bloco, 'NAME') || campo(bloco, 'TRNTYPE');
    const fitid = campo(bloco, 'FITID');
    transacoes.push({
      data,
      descricao,
      valor: r2(Math.abs(valor)),
      tipo: valor < 0 ? 'gasto' : 'entrada',
      ref: fitid ? `ofx:${conta}:${fitid}` : null,
    });
  }
  return { formato: 'OFX', cartao, banco, transacoes };
}

// ---------------------------------------------------------------- CSV

function dividirLinha(linha, sep) {
  const cel = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
    } else if (c === sep && !aspas) {
      cel.push(atual.trim());
      atual = '';
    } else atual += c;
  }
  cel.push(atual.trim());
  return cel;
}

const COLUNAS = {
  data: /^(data|date|dt)(\b|_| )|^data$/,
  valor: /^(valor|amount|quantia|montante)|valor \(r\$\)|^valor/,
  // "Descrição" vence "Histórico" quando o banco manda as duas (Inter: Histórico = "Pix enviado", Descrição = quem recebeu)
  descricaoExata: /^descri/,
  descricao: /(descri|title|titulo|historico|estabelecimento|memo|detalhe|lancamento|nome)/,
  historico: /^(historico|tipo( de)?( lancamento| transacao)?|lancamento)$/,
  saldo: /^saldo/,
  id: /^(identificador|id|fitid|codigo)$/,
  entrada: /^(credito|entrada|entradas)( \(r\$\))?$/,
  saida: /^(debito|saida|saidas)( \(r\$\))?$/,
};

function acharColunas(cabecalho) {
  const norm = cabecalho.map((c) => semAcento(c).replace(/["']/g, '').trim());
  const usado = new Set();
  const achar = (re) => {
    const i = norm.findIndex((c, idx) => !usado.has(idx) && re.test(c));
    if (i >= 0) usado.add(i);
    return i;
  };
  const col = {};
  col.data = achar(COLUNAS.data);
  col.id = achar(COLUNAS.id);
  col.entrada = achar(COLUNAS.entrada);
  col.saida = achar(COLUNAS.saida);
  col.valor = achar(COLUNAS.valor);
  // Coluna que as versões anteriores usavam como descrição (para reconhecer o que já foi importado).
  col.legado = norm.findIndex((c, idx) => !usado.has(idx) && COLUNAS.descricao.test(c));
  col.saldo = achar(COLUNAS.saldo);
  col.descricao = achar(COLUNAS.descricaoExata);
  if (col.descricao < 0) col.descricao = achar(COLUNAS.descricao);
  col.historico = achar(COLUNAS.historico);
  return { col, norm };
}

const chaveTexto = (t) => semAcento(t || '').replace(/\s+/g, ' ');

function lerCSV(texto) {
  const linhas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return { formato: 'CSV', cartao: false, banco: '', transacoes: [] };
  // Separador: o que mais aparece na linha de cabeçalho
  let idxCab = 0;
  let sep = ';';
  let col = null;
  let norm = [];
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    const s = (linhas[i].match(/;/g) || []).length >= (linhas[i].match(/,/g) || []).length ? ';' : ',';
    const tentativa = acharColunas(dividirLinha(linhas[i], s));
    const c = tentativa.col;
    if (c.data >= 0 && (c.valor >= 0 || c.entrada >= 0 || c.saida >= 0)) {
      idxCab = i;
      sep = s;
      col = c;
      norm = tentativa.norm;
      break;
    }
  }
  if (!col) throw new Error('Não encontrei as colunas de data e valor neste arquivo.');

  // Fatura de cartão do Nubank (date,title,amount): valor positivo = compra.
  const cartao = norm.includes('title') && norm.includes('amount');
  const brutas = [];
  for (const linha of linhas.slice(idxCab + 1)) {
    const c = dividirLinha(linha, sep);
    const data = lerData(c[col.data]);
    if (!data) continue;
    let valor = null;
    if (col.valor >= 0) valor = lerValor(c[col.valor]);
    if ((valor === null || valor === 0) && (col.entrada >= 0 || col.saida >= 0)) {
      const ent = col.entrada >= 0 ? lerValor(c[col.entrada]) : null;
      const sai = col.saida >= 0 ? lerValor(c[col.saida]) : null;
      if (ent) valor = Math.abs(ent);
      else if (sai) valor = -Math.abs(sai);
    }
    if (valor === null || valor === 0) continue;
    const nome = col.descricao >= 0 ? c[col.descricao] || '' : '';
    const historico = col.historico >= 0 ? c[col.historico] || '' : '';
    const descricao = historico && nome ? `${historico} - ${nome}` : historico || nome;
    const legado = col.legado >= 0 ? c[col.legado] || '' : descricao;
    const saldo = col.saldo >= 0 ? lerValor(c[col.saldo]) : null;
    const id = col.id >= 0 ? c[col.id] : '';
    brutas.push({ data, descricao, nome, legado, valor, saldo, id });
  }
  // Se todos os valores são positivos, é fatura: positivo = gasto.
  const todosPositivos = brutas.length > 0 && brutas.every((b) => b.valor > 0);
  const positivoEhGasto = cartao || todosPositivos;
  // Contagem separada por tipo de referência: duas transações iguais no mesmo dia viram #1 e #2.
  const contagens = { antiga: new Map(), nova: new Map() };
  const numerar = (tipo, base) => {
    const n = (contagens[tipo].get(base) || 0) + 1;
    contagens[tipo].set(base, n);
    return `csv:${base}#${n}`;
  };
  const transacoes = brutas.map((b) => {
    const v = Math.abs(b.valor).toFixed(2);
    // Referência estável: o id do banco; senão data + valor + saldo depois da transação
    // (não depende de como a descrição é lida); senão data + valor + descrição.
    let ref;
    const refsAntigas = [];
    const antiga = numerar('antiga', `${b.data}|${v}|${chaveTexto(b.legado)}`);
    if (b.id) ref = `csv:${b.id}`;
    else if (b.saldo !== null) ref = numerar('nova', `${b.data}|${v}|s${b.saldo.toFixed(2)}`);
    else ref = numerar('nova', `${b.data}|${v}|${chaveTexto(b.descricao)}`);
    if (!b.id && antiga !== ref) refsAntigas.push(antiga);
    const gasto = positivoEhGasto ? b.valor > 0 : b.valor < 0;
    return {
      data: b.data,
      descricao: b.descricao,
      nome: b.nome,
      valor: r2(Math.abs(b.valor)),
      tipo: gasto ? 'gasto' : 'entrada',
      ref,
      refsAntigas,
      saldo: b.saldo,
      valorAssinado: b.valor,
    };
  });
  return { formato: 'CSV', cartao: positivoEhGasto, banco: '', transacoes };
}

/** Lê o texto de um extrato (OFX ou CSV). */
export function lerExtrato(texto) {
  if (/<OFX>|OFXHEADER/i.test(texto)) return lerOFX(texto);
  return lerCSV(texto);
}

// ---------------------------------------------------------------- Limpeza

const PREFIXOS = [
  /^compra (no|com|de) (cartao de )?(debito|credito)( via nupay)?/,
  /^compra (no |com )?cartao( de (debito|credito))?/,
  /^transferencia (enviada|recebida)( pelo pix)?/,
  /^pix (enviado|recebido|transf\.?|qrs|qr code)/,
  /^pagamento (de boleto|efetuado|recebido)/,
  /^(compra|debito|credito|pagto|pag|pix)\b/,
];

/**
 * Descritor de compra no cartão no padrão das maquininhas: 22 letras de nome,
 * 13 de cidade e o país ("Garagem Cingo         Sao Paulo    Bra").
 * Retorna { nome, cidade } ou null se o texto não segue esse padrão.
 */
export function descritorCartao(txt) {
  const s = String(txt || '').replace(/\s+$/, '');
  const m = s.match(/^(.{22})(.{13})(bra|br)$/i);
  if (!m || !/\S/.test(m[1])) return null;
  let nome = m[1].trim();
  let cidade = m[2].trim();
  // Nome maior que 22 letras invade a cidade ("Uber *trip Help.usp")
  if (cidade && !/\s/.test(m[2].trim()) && cidade.length <= 3 && /\S$/.test(m[1])) {
    nome = `${m[1]}${cidade}`.trim();
    cidade = '';
  }
  return { nome: nome.replace(/\s+/g, ' '), cidade: cidade.replace(/\s+/g, ' ') };
}

function capitalizar(s) {
  let t = s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  t = t.replace(/\b(De|Da|Do|Das|Dos|E|Em|No|Na)\b/g, (w) => w.toLowerCase());
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function limparDescricao(desc) {
  const cartao = descritorCartao(desc);
  if (cartao) {
    // "Uber Uber *trip" -> "Uber *trip"; "Drogasil 1536" -> "Drogasil" (número da loja)
    const nome = cartao.nome.replace(/^(\S+)\s+\1\b/i, '$1').replace(/\s+\d{2,6}$/, '');
    return capitalizar(nome || cartao.nome).slice(0, 60);
  }
  let s = String(desc || '').replace(/\s+/g, ' ').trim();
  const norm = semAcento(s);
  for (const re of PREFIXOS) {
    const m = norm.match(re);
    if (m) {
      s = s.slice(m[0].length);
      break;
    }
  }
  s = s
    .replace(/^[\s\-–:•|]+/, '')
    .replace(/["“”]/g, '')
    .replace(/\s*[-–]\s*[•*.\d]{3,}[\s\S]*$/, '') // CPF/CNPJ mascarado e dados bancários no fim
    .replace(/\b\d{2}\/\d{2}\b/, '') // datas no meio do texto
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) s = String(desc || '').trim() || 'Transação';
  return capitalizar(s).slice(0, 60);
}

/**
 * Chave do estabelecimento (ou da pessoa do Pix) para reconhecer a mesma
 * origem em extratos diferentes: sem acento, minúsculas, espaços únicos.
 * Mantém o código da loja ("posto shell 1234"), que diferencia unidades.
 */
export function chaveEstabelecimento(nome) {
  const cartao = descritorCartao(nome);
  const base = cartao ? cartao.nome : String(nome || '');
  return semAcento(base).replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
}

export function metodoDaDescricao(desc, cartao) {
  if (cartao) return 'Crédito';
  const n = semAcento(desc || '');
  if (/\bpix\b/.test(n)) return 'Pix';
  if (/debito/.test(n)) return 'Débito';
  if (/credito/.test(n)) return 'Crédito';
  if (/boleto/.test(n)) return null;
  return null;
}

const IGNORAR = [
  [/pagamento (de |da )?fatura|pagto fatura|fatura (do )?cartao/, 'Pagamento de fatura: as compras do cartão já contam'],
  [/aplicacao|resgate|\brdb\b|\bcdb\b|investimento|poupanca/, 'Movimento de investimento'],
  [/transferencia entre contas|mesma titularidade/, 'Transferência entre suas contas'],
  [/^saldo|saldo (anterior|do dia|final)/, 'Linha de saldo'],
];

export function motivoIgnorar(desc) {
  const n = semAcento(desc || '');
  for (const [re, motivo] of IGNORAR) if (re.test(n)) return motivo;
  return null;
}

function diasEntre(a, b) {
  return Math.abs((Date.parse(a) - Date.parse(b)) / 864e5);
}

const familiaRef = (ref) => (ref ? String(ref).split(':')[0] : null);
// Referências que vêm de uma linha de extrato (cada linha tem a sua).
const FAMILIAS_EXTRATO = new Set(['csv', 'ofx']);

/** Quanto dois nomes se parecem (0 a 1), por palavras em comum. */
function parecidos(a, b) {
  const palavras = (t) => new Set(semAcento(t || '').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((p) => p.length > 2));
  const pa = palavras(a);
  const pb = palavras(b);
  if (!pa.size || !pb.size) return 0;
  let comum = 0;
  for (const p of pa) if (pb.has(p)) comum++;
  return comum / Math.min(pa.size, pb.size);
}

/**
 * Quem recebeu (ou pagou) um registro que veio do extrato.
 * Retorna { chave, original } ou null se o registro não tem essa informação.
 * Registros antigos sem a chave gravada: o nome vem do texto do banco
 * ("Pix enviado - Fulana de Tal") ou do local.
 */
export function quemDoRegistro(r) {
  const texto = String(r.textoOriginal || '');
  const i = texto.indexOf(' - ');
  const bruto = i >= 0 ? texto.slice(i + 3) : r.local || null;
  if (!r.estabelecimento && !(r.origem === 'extrato' && bruto)) return null;
  const chave = r.estabelecimento || chaveEstabelecimento(bruto);
  return { chave, original: bruto ? limparDescricao(bruto) : capitalizar(chave) };
}

/** Chave do estabelecimento de um registro (a gravada na importação, ou a partir do local/nome). */
export function chaveDoRegistro(r) {
  const quem = quemDoRegistro(r);
  return quem ? quem.chave : chaveEstabelecimento(r.local || r.item);
}

// Nome para comparar: sem acento, sem pontuação e sem o número da loja no fim.
const nomeComparavel = (r) => semAcento(String(r.local || r.item || ''))
  .replace(/[^a-z0-9 ]/g, ' ').replace(/(\s+\d+)+\s*$/, '').replace(/\s+/g, ' ').trim();

/**
 * Outros gastos "A definir" que parecem ser a mesma coisa que `r`, para definir
 * todos de uma vez. Retorna [{ registro, certeza }]:
 * - certeza true: mesmo lugar ou pessoa (mesma chave ou mesmo nome) — já vem marcado;
 * - certeza false: só o nome parecido (palavras em comum) — vem desmarcado, para conferir.
 * Os certos primeiro; dentro de cada grupo, os mais recentes primeiro.
 */
export function gastosParecidos(r, candidatos) {
  const chave = chaveDoRegistro(r);
  const nome = nomeComparavel(r);
  const achados = [];
  for (const x of candidatos) {
    if (x.id === r.id || x.tipo !== r.tipo) continue;
    const nx = nomeComparavel(x);
    if ((chave && chaveDoRegistro(x) === chave) || (nome && nx === nome)) achados.push({ registro: x, certeza: true });
    else if (parecidos(r.local || r.item, x.local || x.item) >= 0.5) achados.push({ registro: x, certeza: false });
  }
  return achados.sort((a, b) => (b.certeza - a.certeza) || b.registro.data.localeCompare(a.registro.data)
    || (b.registro.hora || '').localeCompare(a.registro.hora || ''));
}

/** Gasto do extrato sem pista do que foi: "A definir" (não "Outros"), para revisar depois. */
function categoriaInicial(texto, tipo, regras) {
  const c = sugerirCategoria(texto, tipo, regras);
  return tipo === 'gasto' && c === 'Outros' ? A_DEFINIR : c;
}

/**
 * Chave de "quem recebeu + valor": o mesmo Pix de R$ 8,00 para a mesma pessoa
 * é a mesma coisa (ex.: "Cookie do Slack"). Guardada na mesma tabela dos estabelecimentos.
 */
export function chaveValor(chave, valor) {
  return `${chave}#${Number(valor).toFixed(2)}`;
}

/**
 * Lembranças por valor a partir do que você confirmou: [{ chave, valor, nome, item, categoria }].
 * Valem já na próxima importação (não precisam de 3 repetições).
 */
export function lembrarPorValor(confirmadas) {
  const lista = new Map();
  for (const c of confirmadas) {
    if (!c.chave || !c.item || !c.categoria || c.categoria === A_DEFINIR || !(c.valor > 0)) continue;
    const chave = chaveValor(c.chave, c.valor);
    lista.set(chave, { chave, nome: c.nome || null, item: c.item, categoria: c.categoria, vezes: VEZES_PARA_AUTOMATICO });
  }
  return [...lista.values()];
}

/** Quantas vezes seguidas a mesma resposta precisa aparecer para o app preencher sozinho. */
export const VEZES_PARA_AUTOMATICO = 3;

const normalizar = (t) => semAcento(String(t || '')).replace(/\s+/g, ' ').trim();

/**
 * Prepara a lista para o usuário revisar antes de importar.
 * - já importado (mesma referência): fica de fora;
 * - já registrado (à mão, por foto de cupom ou outro extrato) com mesmo valor e
 *   nome parecido: fica de fora e o registro existente é ajustado com os dados
 *   do extrato (o extrato vale mais que o digitado);
 * - parecido mas sem certeza (nome diferente ou valor quase igual): pergunta;
 * - fatura, investimento...: fica desmarcado.
 * `estabelecimentos` = respostas aprendidas: [{ chave, item, categoria, vezes }]
 */
export function prepararImportacao(extrato, existentes, regras = [], estabelecimentos = []) {
  const refs = new Set(existentes.map((r) => r.ref_externa || r.refExterna).filter(Boolean));
  const aprendidos = new Map(estabelecimentos.map((e) => [e.chave, e]));
  const usados = new Set();
  // Só registros até 3 dias perto das datas do extrato podem ser a mesma transação:
  // separa esses antes, em vez de comparar cada linha com o histórico inteiro.
  let ini = Infinity;
  let fim = -Infinity;
  for (const t of extrato.transacoes) {
    const ms = Date.parse(t.data);
    if (ms < ini) ini = ms;
    if (ms > fim) fim = ms;
  }
  const proximos = existentes.filter((r) => { const ms = Date.parse(r.data); return ms >= ini - 3 * 864e5 && ms <= fim + 3 * 864e5; });
  return extrato.transacoes.map((t) => {
    const nomeBruto = t.nome || t.descricao;
    const nome = limparDescricao(nomeBruto);
    const metodo = t.tipo === 'gasto' ? metodoDaDescricao(t.descricao, extrato.cartao) : null;
    const cartao = descritorCartao(nomeBruto);
    const chave = chaveEstabelecimento(nomeBruto);
    const est = aprendidos.get(chave) || null;
    // Mesmo destino e mesmo valor que você já corrigiu antes: usa direto o que você disse
    const porValor = aprendidos.get(chaveValor(chave, t.valor));
    const lembrado = porValor && porValor.item ? porValor : null;
    // Nome que você deu para essa pessoa ou lugar ("Mãe", "Posto Rodovia X") vale em todas as transações
    const apelido = est && est.apelido ? est.apelido : null;
    const automatico = Boolean(lembrado || (est && est.vezes >= VEZES_PARA_AUTOMATICO && est.item));
    const fonte = lembrado || est;
    const linha = {
      selecionado: true,
      tipo: t.tipo,
      nome: apelido || nome, // estabelecimento ou pessoa (com o nome que você deu, se deu)
      item: automatico ? fonte.item : apelido || nome,
      resposta: automatico ? fonte.item : '', // "O que foi?"
      automatico,
      sugestao: est && !automatico && est.item ? est.item : null,
      sugestaoCategoria: est && !automatico ? est.categoria : null,
      descricao: t.descricao,
      data: t.data,
      valor: t.valor,
      categoria: automatico && fonte.categoria ? fonte.categoria : categoriaInicial(`${nome} ${t.descricao}`, t.tipo, regras),
      metodo,
      // Compra no cartão: o estabelecimento vira o local do registro
      local: apelido || (metodo === 'Débito' || metodo === 'Crédito' || cartao ? nome : null),
      estabelecimento: chave,
      ref: t.ref,
      situacao: 'novo',
      aviso: null,
    };
    if ((t.ref && refs.has(t.ref)) || (t.refsAntigas || []).some((r) => refs.has(r))) {
      return { ...linha, selecionado: false, situacao: 'importado', aviso: 'Já importado antes' };
    }
    if (extrato.cartao && t.tipo === 'entrada' && /pagamento/.test(semAcento(t.descricao))) {
      return { ...linha, selecionado: false, situacao: 'ignorar', aviso: 'Pagamento da fatura: as compras do cartão já contam' };
    }
    const motivo = motivoIgnorar(t.descricao);
    if (motivo) return { ...linha, selecionado: false, situacao: 'ignorar', aviso: motivo };

    // Registros parecidos: valor igual ou quase (até 2%) e data a até 3 dias.
    // Um registro que veio de outra linha do mesmo tipo de extrato não conta:
    // se fosse a mesma transação, a referência seria igual.
    const familia = familiaRef(t.ref);
    const textoLinha = `${nome} ${t.descricao} ${est ? est.item : ''}`;
    const candidatos = proximos
      .filter((r) => {
        if (usados.has(r.id) || r.tipo !== t.tipo || diasEntre(r.data, t.data) > 3) return false;
        if (Math.abs(r.valor - t.valor) > Math.max(0.01, t.valor * 0.02)) return false;
        const fr = familiaRef(r.ref_externa || r.refExterna);
        return !(fr && FAMILIAS_EXTRATO.has(fr) && fr === familia);
      })
      .map((r) => {
        const valorIgual = Math.abs(r.valor - t.valor) < 0.01;
        const nomeParecido = parecidos(`${r.item} ${r.local || ''}`, textoLinha) >= 0.5;
        return { r, certo: valorIgual && nomeParecido, nota: diasEntre(r.data, t.data) - (nomeParecido ? 2 : 0) - (valorIgual ? 1 : 0) };
      })
      .sort((x, y) => x.nota - y.nota);
    if (!candidatos.length) return linha;
    const { r: igual, certo } = candidatos[0];
    usados.add(igual.id);
    const [, m, d] = igual.data.split('-');
    const valorTxt = igual.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (certo) {
      return { ...linha, selecionado: false, situacao: 'duplicado', duplicadoDe: igual.id,
        aviso: `Já registrado como "${igual.item}" (${d}/${m}). Ajusto com os dados do extrato.` };
    }
    return { ...linha, selecionado: false, situacao: 'pergunta', duplicadoDe: igual.id, resposta_duplicado: null,
      aviso: `É o mesmo que "${igual.item}" ${valorTxt} (${d}/${m})?` };
  });
}

/**
 * Ajuste do registro já existente com os dados do extrato (o extrato vale mais):
 * valor, data e forma de pagamento do banco; o nome e a categoria que você deu continuam.
 */
export function ajusteDoExtrato(existente, linha) {
  const m = { ...existente, valor: linha.valor, data: linha.data };
  if (linha.metodo) m.metodo = linha.metodo;
  if (!m.local && linha.local) m.local = linha.local;
  if (m.metodo !== 'Crédito') m.cartaoId = null;
  // Conta fixa guarda o mês na referência ("conta:..."): essa não muda.
  if (!String(existente.refExterna || '').startsWith('conta:')) m.refExterna = linha.ref;
  return m;
}

/**
 * Novas respostas aprendidas depois da importação.
 * A contagem sobe quando a resposta se repete e volta a 1 quando muda.
 * `confirmadas` = [{ chave, item, categoria }]
 */
export function aprenderEstabelecimentos(confirmadas, estabelecimentos = []) {
  const atual = new Map(estabelecimentos.map((e) => [e.chave, { ...e }]));
  const mudou = new Map();
  for (const c of confirmadas) {
    if (!c.chave || !c.item) continue;
    const antes = mudou.get(c.chave) || atual.get(c.chave);
    const igual = antes && normalizar(antes.item) === normalizar(c.item) && antes.categoria === c.categoria;
    mudou.set(c.chave, { chave: c.chave, nome: c.nome || (antes && antes.nome) || null, apelido: (antes && antes.apelido) || null,
      item: c.item, categoria: c.categoria, vezes: igual ? antes.vezes + 1 : 1 });
  }
  return [...mudou.values()];
}

/**
 * Confere a coluna Saldo: cada saldo tem que ser o anterior mais o valor da linha.
 * Retorna os pontos onde a conta não fecha (provável linha faltando):
 * [{ de, ate }] com as datas em volta do buraco. Lista vazia = completo (ou sem saldo).
 */
export function conferirSaldo(transacoes) {
  const ts = transacoes.filter((t) => t.saldo !== null && t.saldo !== undefined && t.valorAssinado !== undefined);
  if (ts.length < 2 || ts.length !== transacoes.length) return [];
  const fecha = (a, b) => Math.abs(a - b) < 0.015;
  // Arquivo do mais novo para o mais antigo, ou o contrário.
  const furosDesc = [];
  const furosAsc = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    const [x, y] = [ts[i], ts[i + 1]];
    if (!fecha(x.saldo, y.saldo + x.valorAssinado)) furosDesc.push({ de: y.data, ate: x.data });
    if (!fecha(y.saldo, x.saldo + y.valorAssinado)) furosAsc.push({ de: x.data, ate: y.data });
  }
  return furosDesc.length <= furosAsc.length ? furosDesc : furosAsc;
}
