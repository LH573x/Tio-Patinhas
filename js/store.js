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
    ref_externa: r.refExterna || null,
    local: r.local || null,
    hora: r.hora || null,
  };
}

// Banco ainda sem as colunas local/hora: grava sem elas até o schema.sql ser rodado de novo.
let semLocalHora = false;
function paraBancoCompat(r) {
  const b = paraBanco(r);
  if (semLocalHora) {
    delete b.local;
    delete b.hora;
  }
  return b;
}
const faltaLocalHora = (error) => /could not find the '(local|hora)' column|column .*(local|hora).* does not exist/i.test((error && error.message) || '');

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
    refExterna: row.ref_externa || null,
    local: row.local || null,
    hora: row.hora ? String(row.hora).slice(0, 5) : null,
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
  if (/duplicate key|23505/i.test(m)) return 'Algumas transações já tinham sido importadas.';
  if (/relation .* does not exist|could not find the table|schema cache/i.test(m)) {
    return 'O banco precisa ser atualizado: rode de novo o arquivo schema.sql no Supabase.';
  }
  if (/bucket not found/i.test(m)) return 'O banco precisa ser atualizado: rode de novo o arquivo schema.sql no Supabase.';
  if (/new password should be different/i.test(m)) return 'A nova senha precisa ser diferente da atual.';
  return m;
}

function numerosMeta(m) {
  return { ...m, valor_alvo: Number(m.valor_alvo), valor_atual: Number(m.valor_atual) };
}

function falhar(error) {
  throw new Error(erroLegivel(error));
}

const VAZIO = () => ({ registros: [], regras: [], orcamentos: [], metas: [], caixa: [] });
let cache = { ...VAZIO(), ...lerLocal(CHAVE_CACHE, {}) };
let usuarioAtual = null;

function salvarCache() {
  gravarLocal(CHAVE_CACHE, cache);
}

export const store = {
  // ---------- Login ----------
  async usuario() {
    const { data } = await cliente.auth.getSession();
    usuarioAtual = data.session ? data.session.user : null;
    return usuarioAtual;
  },
  email() {
    return usuarioAtual ? usuarioAtual.email : '';
  },
  async trocarSenha(nova) {
    const { error } = await cliente.auth.updateUser({ password: nova });
    if (error) falhar(error);
  },
  async entrar(email, senha) {
    const { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });
    if (error) falhar(error);
    usuarioAtual = data.user;
  },
  async cadastrar(email, senha) {
    const { data, error } = await cliente.auth.signUp({ email, password: senha });
    if (error) falhar(error);
    if (data.session) usuarioAtual = data.user;
    return { precisaConfirmar: !data.session };
  },
  async sair() {
    await cliente.auth.signOut();
    usuarioAtual = null;
    cache = VAZIO();
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
      if (de === 0 && data.length && !('hora' in data[0])) semLocalHora = true;
      registros.push(...data.map(doBanco));
      if (data.length < passo) break;
    }
    const [regras, orcamentos, metas, caixa] = await Promise.all([
      cliente.from('regras').select('termo, categoria').order('criado_em', { ascending: false }),
      cliente.from('orcamentos').select('id, categoria, limite'),
      cliente.from('metas').select('*').order('criado_em'),
      cliente.from('caixa_entrada').select('*').order('criado_em', { ascending: false }).limit(30),
    ]);
    if (regras.error) falhar(regras.error);
    cache = {
      registros,
      regras: regras.data,
      // Tabelas novas: se o banco ainda não foi atualizado, o app continua funcionando.
      orcamentos: orcamentos.error ? [] : orcamentos.data.map((o) => ({ ...o, limite: Number(o.limite) })),
      metas: metas.error ? [] : metas.data.map(numerosMeta),
      caixa: caixa.error ? [] : caixa.data,
    };
    this.bancoDesatualizado = Boolean(orcamentos.error || metas.error || caixa.error || semLocalHora);
    salvarCache();
  },
  bancoDesatualizado: false,
  listar() {
    return [...cache.registros];
  },
  regras() {
    return cache.regras;
  },
  async adicionar(lancamentos) {
    let { data, error } = await cliente.from('registros').insert(lancamentos.map(paraBancoCompat)).select();
    if (error && faltaLocalHora(error) && !semLocalHora) {
      semLocalHora = true;
      this.bancoDesatualizado = true;
      ({ data, error } = await cliente.from('registros').insert(lancamentos.map(paraBancoCompat)).select());
    }
    if (error) falhar(error);
    cache.registros.push(...data.map(doBanco));
    salvarCache();
  },
  async atualizar(id, m) {
    let { data, error } = await cliente.from('registros').update(paraBancoCompat(m)).eq('id', id).select().single();
    if (error && faltaLocalHora(error) && !semLocalHora) {
      semLocalHora = true;
      this.bancoDesatualizado = true;
      ({ data, error } = await cliente.from('registros').update(paraBancoCompat(m)).eq('id', id).select().single());
    }
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

  // ---------- Limites por categoria ----------
  orcamentos() {
    return cache.orcamentos;
  },
  async salvarLimite(categoria, limite) {
    if (!limite) {
      const { error } = await cliente.from('orcamentos').delete().eq('categoria', categoria);
      if (error) falhar(error);
      cache.orcamentos = cache.orcamentos.filter((o) => o.categoria !== categoria);
    } else {
      const { data, error } = await cliente.from('orcamentos')
        .upsert({ categoria, limite }, { onConflict: 'user_id,categoria' }).select().single();
      if (error) falhar(error);
      cache.orcamentos = [...cache.orcamentos.filter((o) => o.categoria !== categoria), { ...data, limite: Number(data.limite) }];
    }
    salvarCache();
  },

  // ---------- Metas de economia ----------
  metas() {
    return cache.metas;
  },
  async salvarMeta(meta) {
    const campos = { nome: meta.nome, valor_alvo: meta.valor_alvo, valor_atual: meta.valor_atual || 0, prazo: meta.prazo || null };
    const consulta = meta.id
      ? cliente.from('metas').update(campos).eq('id', meta.id).select().single()
      : cliente.from('metas').insert(campos).select().single();
    const { data, error } = await consulta;
    if (error) falhar(error);
    const salva = numerosMeta(data);
    cache.metas = meta.id ? cache.metas.map((m) => (m.id === meta.id ? salva : m)) : [...cache.metas, salva];
    salvarCache();
    return salva;
  },
  async removerMeta(id) {
    const { error } = await cliente.from('metas').delete().eq('id', id);
    if (error) falhar(error);
    cache.metas = cache.metas.filter((m) => m.id !== id);
    salvarCache();
  },

  // ---------- Caixa de entrada (fotos e extratos para a rotina do Claude) ----------
  caixa() {
    return cache.caixa;
  },
  async enviarParaCaixa(arquivo, tipo, observacao) {
    if (!usuarioAtual) await this.usuario();
    const ext = (arquivo.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    const caminho = `${usuarioAtual.id}/${crypto.randomUUID()}.${ext}`;
    const up = await cliente.storage.from('anexos').upload(caminho, arquivo, { contentType: arquivo.type || undefined });
    if (up.error) falhar(up.error);
    const { data, error } = await cliente.from('caixa_entrada')
      .insert({ tipo, caminho, nome_arquivo: arquivo.name, observacao: observacao || null }).select().single();
    if (error) {
      await cliente.storage.from('anexos').remove([caminho]);
      falhar(error);
    }
    cache.caixa = [data, ...cache.caixa];
    salvarCache();
    return data;
  },
  async removerDaCaixa(item) {
    await cliente.storage.from('anexos').remove([item.caminho]);
    const { error } = await cliente.from('caixa_entrada').delete().eq('id', item.id);
    if (error) falhar(error);
    cache.caixa = cache.caixa.filter((c) => c.id !== item.id);
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
