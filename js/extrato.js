// Leitura de extratos bancários (OFX e CSV) direto no app, sem IA.
// Funciona com os formatos mais comuns dos bancos brasileiros
// (Nubank, Inter, Itaú, Bradesco, BB, Caixa, C6, Santander...).
import { semAcento, sugerirCategoria } from './parser.js';

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
 * Prepara a lista para o usuário revisar antes de importar.
 * Marca o que já foi importado, o que parece já ter sido registrado (à mão,
 * por foto de cupom ou por outro formato de extrato) e o que normalmente não
 * é gasto (fatura, investimento...).
 */
export function prepararImportacao(extrato, existentes, regras = []) {
  const refs = new Set(existentes.map((r) => r.ref_externa || r.refExterna).filter(Boolean));
  const usados = new Set();
  return extrato.transacoes.map((t) => {
    const nome = t.nome || t.descricao;
    const item = limparDescricao(nome);
    const metodo = t.tipo === 'gasto' ? metodoDaDescricao(t.descricao, extrato.cartao) : null;
    const cartao = descritorCartao(nome);
    const linha = {
      selecionado: true,
      tipo: t.tipo,
      item,
      descricao: t.descricao,
      data: t.data,
      valor: t.valor,
      categoria: sugerirCategoria(`${item} ${t.descricao}`, t.tipo, regras),
      metodo,
      // Compra no cartão: o estabelecimento vira o local do registro
      local: metodo === 'Débito' || metodo === 'Crédito' || cartao ? item : null,
      estabelecimento: chaveEstabelecimento(nome),
      ref: t.ref,
      situacao: 'novo',
      aviso: null,
    };
    if ((t.ref && refs.has(t.ref)) || (t.refsAntigas || []).some((r) => refs.has(r))) {
      return { ...linha, selecionado: false, situacao: 'importado', aviso: 'Já importado antes' };
    }
    // Mesmo valor e data próxima. Um registro que veio de outra linha do mesmo
    // tipo de extrato não conta: se fosse a mesma transação, a referência seria igual.
    const familia = familiaRef(t.ref);
    const candidatos = existentes.filter((r) => {
      if (usados.has(r.id) || r.tipo !== t.tipo || Math.abs(r.valor - t.valor) >= 0.01 || diasEntre(r.data, t.data) > 3) return false;
      const fr = familiaRef(r.ref_externa || r.refExterna);
      return !(fr && FAMILIAS_EXTRATO.has(fr) && fr === familia);
    });
    if (candidatos.length) {
      const nota = (r) => diasEntre(r.data, t.data) - parecidos(`${r.item} ${r.local || ''}`, `${item} ${t.descricao}`);
      const igual = candidatos.sort((x, y) => nota(x) - nota(y))[0];
      usados.add(igual.id);
      const [, m, d] = igual.data.split('-');
      return { ...linha, selecionado: false, situacao: 'duplicado', duplicadoDe: igual.id,
        aviso: `Parece ser "${igual.item}" (${d}/${m}), que você já registrou` };
    }
    if (extrato.cartao && t.tipo === 'entrada' && /pagamento/.test(semAcento(t.descricao))) {
      return { ...linha, selecionado: false, situacao: 'ignorar', aviso: 'Pagamento da fatura: as compras do cartão já contam' };
    }
    const motivo = motivoIgnorar(t.descricao);
    if (motivo) return { ...linha, selecionado: false, situacao: 'ignorar', aviso: motivo };
    return linha;
  });
}
