#!/usr/bin/env node
// Ferramenta da rotina diária: lê a caixa de entrada (fotos de cupom, PDFs e
// prints de extrato) e grava os registros que o Claude extraiu.
//
//   node scripts/caixa.mjs baixar  [pasta]          baixa os pendentes e gera pasta/pendentes.json
//   node scripts/caixa.mjs gravar  pasta/saida.json  cria os registros e marca cada envio
//
// Acesso ao Supabase: a chave secreta vem da variável SUPABASE_SECRET_KEY ou é
// injetada pelo proxy da rede (Network secrets do ambiente). Nunca escreva a chave aqui.
import fs from 'node:fs/promises';
import path from 'node:path';

const URL_BASE = process.env.SUPABASE_URL || 'https://senrhuxfjomqppluwgsx.supabase.co';
const CHAVE = process.env.SUPABASE_SECRET_KEY || '';
const CATEGORIAS_GASTO = ['Refeições', 'Alimentação geral', 'Carro', 'Namorada', 'Viagens', 'Outros'];
const CATEGORIAS_ENTRADA = ['Salário', 'Outras entradas'];
const METODOS = ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Vale'];

function cabecalhos(extra = {}) {
  const h = { ...extra };
  if (CHAVE) {
    h.apikey = CHAVE;
    // chaves novas (sb_secret_...) não são JWT; as antigas (service_role) também vão no Authorization
    if (!CHAVE.startsWith('sb_')) h.Authorization = `Bearer ${CHAVE}`;
  }
  return h;
}

async function api(caminho, { metodo = 'GET', corpo, headers = {} } = {}) {
  const r = await fetch(`${URL_BASE}${caminho}`, {
    method: metodo,
    headers: Object.fromEntries(Object.entries(cabecalhos({ 'Content-Type': 'application/json', ...headers })).filter(([, v]) => v)),
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`${metodo} ${caminho}: ${r.status} ${await r.text()}`);
  const tipo = r.headers.get('content-type') || '';
  return tipo.includes('json') ? r.json() : r.arrayBuffer();
}

const iso = (d) => d.toISOString().slice(0, 10);

async function baixar(pasta = 'caixa-hoje') {
  await fs.mkdir(pasta, { recursive: true });
  const pendentes = await api('/rest/v1/caixa_entrada?status=eq.pendente&order=criado_em.asc&select=*');
  const desde = iso(new Date(Date.now() - 75 * 864e5));
  const itens = [];
  const porUsuario = new Map();
  for (const c of pendentes) {
    const ext = path.extname(c.caminho) || '.bin';
    const arquivo = path.join(pasta, `${c.id}${ext}`);
    try {
      const dados = await api(`/storage/v1/object/authenticated/anexos/${c.caminho.split('/').map(encodeURIComponent).join('/')}`, { headers: { 'Content-Type': undefined } });
      await fs.writeFile(arquivo, Buffer.from(dados));
    } catch (e) {
      itens.push({ id: c.id, erroDownload: e.message });
      continue;
    }
    if (!porUsuario.has(c.user_id)) {
      const [registros, regras] = await Promise.all([
        api(`/rest/v1/registros?user_id=eq.${c.user_id}&data=gte.${desde}&select=item,valor,data,tipo,categoria,metodo&order=data.desc`),
        api(`/rest/v1/regras?user_id=eq.${c.user_id}&select=termo,categoria`),
      ]);
      porUsuario.set(c.user_id, { registros, regras });
    }
    itens.push({
      id: c.id, tipo: c.tipo, arquivo, nome_arquivo: c.nome_arquivo, observacao: c.observacao,
      enviado_em: c.criado_em, user_id: c.user_id,
    });
  }
  const saida = {
    gerado_em: new Date().toISOString(),
    categorias_gasto: CATEGORIAS_GASTO,
    categorias_entrada: CATEGORIAS_ENTRADA,
    metodos: METODOS,
    itens,
    // para não duplicar e para categorizar como o usuário costuma
    contexto: Object.fromEntries([...porUsuario].map(([u, v]) => [u, v])),
  };
  await fs.writeFile(path.join(pasta, 'pendentes.json'), JSON.stringify(saida, null, 2));
  console.log(`${itens.length} pendente(s) em ${pasta}/pendentes.json`);
}

function validar(r, i) {
  const erros = [];
  if (!['gasto', 'entrada'].includes(r.tipo)) erros.push('tipo');
  if (!r.item || typeof r.item !== 'string') erros.push('item');
  if (!(Number(r.valor) > 0)) erros.push('valor');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data || '')) erros.push('data');
  const cats = r.tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_GASTO;
  if (!cats.includes(r.categoria)) erros.push('categoria');
  if (r.metodo && !METODOS.includes(r.metodo)) erros.push('metodo');
  if (r.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.hora)) erros.push('hora');
  if (erros.length) throw new Error(`registro ${i + 1} inválido (${erros.join(', ')})`);
}

async function gravar(arquivoSaida) {
  const { itens } = JSON.parse(await fs.readFile(arquivoSaida, 'utf8'));
  const pendentes = new Map((await api('/rest/v1/caixa_entrada?status=eq.pendente&select=*')).map((c) => [c.id, c]));
  for (const it of itens) {
    const c = pendentes.get(it.id);
    if (!c) { console.log(`${it.id}: não está mais pendente, pulei`); continue; }
    const marcar = (campos) => api(`/rest/v1/caixa_entrada?id=eq.${c.id}`, {
      metodo: 'PATCH', corpo: { ...campos, processado_em: new Date().toISOString() },
    });
    if (it.erro) {
      await marcar({ status: 'erro', mensagem: String(it.erro).slice(0, 300) });
      console.log(`${c.id}: marcado com erro`);
      continue;
    }
    try {
      const regs = it.registros || [];
      regs.forEach(validar);
      const linhas = regs.map((r, i) => ({
        user_id: c.user_id, tipo: r.tipo, item: r.item.trim().slice(0, 120), valor: Math.round(Number(r.valor) * 100) / 100,
        metodo: r.metodo || null, categoria: r.categoria, data: r.data, parcela: null,
        local: r.local ? String(r.local).trim().slice(0, 80) : null, hora: r.hora || null,
        origem: c.tipo === 'cupom' ? 'cupom' : 'extrato',
        texto_original: r.descricao || c.observacao || null,
        ref_externa: `caixa:${c.id}:${i}`,
      }));
      // se uma execução anterior caiu no meio, não cria de novo o que já entrou
      const ja = new Set((await api(`/rest/v1/registros?ref_externa=like.caixa:${c.id}:*&select=ref_externa`)).map((r) => r.ref_externa));
      const novas = linhas.filter((l) => !ja.has(l.ref_externa));
      if (novas.length) await api('/rest/v1/registros', { metodo: 'POST', corpo: novas, headers: { Prefer: 'return=minimal' } });
      await marcar({ status: 'processado', registros_criados: linhas.length, mensagem: it.mensagem || null });
      await api('/storage/v1/object/anexos', { metodo: 'DELETE', corpo: { prefixes: [c.caminho] } }).catch(() => {});
      console.log(`${c.id}: ${linhas.length} registro(s) criados`);
    } catch (e) {
      await marcar({ status: 'erro', mensagem: e.message.slice(0, 300) });
      console.log(`${c.id}: erro: ${e.message}`);
    }
  }
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'baixar') await baixar(arg);
else if (cmd === 'gravar' && arg) await gravar(arg);
else {
  console.log('Uso: node scripts/caixa.mjs baixar [pasta] | gravar <saida.json>');
  process.exit(1);
}
