// Armazenamento dos registros no Supabase (com login).
// Mantém uma cópia local para o app abrir rápido, mesmo sem internet.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const CHAVE_CACHE = 'tp.cache.v2';
// Chaves da versão anterior, que guardava tudo só no aparelho.
const CHAVE_LOCAL_ANTIGA = 'tp.registros.v1';
const CHAVE_REGRAS_ANTIGA = 'tp.regras.v1';

const cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

function lerLocal(chave, padrao) {
  try {
    const v = localStorage.getItem(chave);
    return v ? JSON.parse(v) : padrao;
  } catch {
    return padrao;
  }
}

function gravarLocal(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sem espaço ou modo privado: segue só em memória */
  }
}

function paraBanco(r) {
  return {
    tipo: r.tipo,
    item: r.item,
    valor: r.valor,
    metodo: r.metodo || null,
    categoria: r.categoria,
    data: r.data,
    parcela: r.parcela || null,
    origem: r.origem || 'texto',
    texto_original: r.textoOriginal || null,
  };
}

function doBanco(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    item: row.item,
    valor: Number(row.valor),
    metodo: row.metodo,
    categoria: row.categoria,
    data: row.data,
    parcela: row.parcela,
    origem: row.origem,
    textoOriginal: row.texto_original,
    criadoEm: row.criado_em,
  };
}

function erroLegivel(error) {
  const m = (error && error.message) || String(error);
  if (/invalid login credentials/i.test(m)) return 'Email ou senha incorretos.';
  if (/email not confirmed/i.test(m)) return 'Falta confirmar o email (veja sua caixa de entrada).';
  if (/user already registered/i.test(m)) return 'Este email já tem conta. Use "Entrar".';
  if (/password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/signups not allowed/i.test(m)) return 'Novos cadastros estão desativados.';
  if (/failed to fetch|network/i.test(m)) return 'Sem conexão com a internet.';
  return m;
}

function falhar(error) {
  throw new Error(erroLegivel(error));
}

let cache = lerLocal(CHAVE_CACHE, { registros: [], regras: [] });

function salvarCache() {
  gravarLocal(CHAVE_CACHE, cache);
}

export const store = {
  // ---------- Login ----------
  async usuario() {
    const { data } = await cliente.auth.getSession();
    return data.session ? data.session.user : null;
  },
  async entrar(email, senha) {
    const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
    if (error) falhar(error);
  },
  async cadastrar(email, senha) {
    const { data, error } = await cliente.auth.signUp({ email, password: senha });
    if (error) falhar(error);
    return { precisaConfirmar: !data.session };
  },
  async sair() {
    await cliente.auth.signOut();
    cache = { registros: [], regras: [] };
    salvarCache();
  },

  // ---------- Dados ----------
  async carregar() {
    const registros = [];
    const passo = 1000;
    for (let de = 0; ; de += passo) {
      const { data, error } = await cliente
        .from('registros').select('*').order('data', { ascending: false }).range(de, de + passo - 1);
      if (error) falhar(error);
      registros.push(...data.map(doBanco));
      if (data.length < passo) break;
    }
    const { data: regras, error } = await cliente.from('regras').select('termo, categoria').order('criado_em', { ascending: false });
    if (error) falhar(error);
    cache = { registros, regras };
    salvarCache();
  },
  listar() {
    return [...cache.registros];
  },
  regras() {
    return cache.regras;
  },
  async adicionar(lancamentos) {
    const { data, error } = await cliente.from('registros').insert(lancamentos.map(paraBanco)).select();
    if (error) falhar(error);
    cache.registros.push(...data.map(doBanco));
    salvarCache();
  },
  async atualizar(id, m) {
    const { data, error } = await cliente.from('registros').update(paraBanco(m)).eq('id', id).select().single();
    if (error) falhar(error);
    cache.registros = cache.registros.map((r) => (r.id === id ? doBanco(data) : r));
    salvarCache();
  },
  async remover(id) {
    const { error } = await cliente.from('registros').delete().eq('id', id);
    if (error) falhar(error);
    cache.registros = cache.registros.filter((r) => r.id !== id);
    salvarCache();
  },
  async aprenderRegra(termo, categoria) {
    const t = termo.trim().toLowerCase();
    if (!t) return;
    const { error } = await cliente.from('regras').upsert({ termo: t, categoria }, { onConflict: 'user_id,termo' });
    if (error) falhar(error);
    cache.regras = [{ termo: t, categoria }, ...cache.regras.filter((r) => r.termo !== t)];
    salvarCache();
  },

  // Envia ao banco o que foi registrado na versão anterior (só no aparelho).
  async migrarDadosAntigos() {
    const antigos = lerLocal(CHAVE_LOCAL_ANTIGA, []);
    const regrasAntigas = lerLocal(CHAVE_REGRAS_ANTIGA, []);
    let enviados = 0;
    if (antigos.length) {
      await this.adicionar(antigos.map((r) => ({ ...r, origem: r.origem || 'texto' })));
      enviados = antigos.length;
    }
    for (const r of regrasAntigas.reverse()) await this.aprenderRegra(r.termo, r.categoria);
    try {
      localStorage.removeItem(CHAVE_LOCAL_ANTIGA);
      localStorage.removeItem(CHAVE_REGRAS_ANTIGA);
    } catch { /* ignora */ }
    return enviados;
  },
};
