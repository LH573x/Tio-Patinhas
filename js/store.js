// Armazenamento dos registros no Supabase (com login).
// Mantém uma cópia local para o app abrir rápido, mesmo sem internet.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { categoriaAtual, NAO_LEMBRO } from './parser.js';

const CHAVE_CACHE = 'tp.cache.v2';
// Chaves da versão anterior, que guardava tudo só no aparelho.
const CHAVE_LOCAL_ANTIGA = 'tp.registros.v1';
const CHAVE_REGRAS_ANTIGA = 'tp.regras.v1';

const cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
// Onde o Supabase guarda a sessão neste aparelho (nome padrão dele).
const CHAVE_SESSAO = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

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
    cartao_id: r.cartaoId || null,
    estabelecimento: r.estabelecimento || null,
  };
}

// Nome da coluna no banco, quando é diferente do nome no app.
const COLUNAS_BANCO = { textoOriginal: 'texto_original', refExterna: 'ref_externa', cartaoId: 'cartao_id', criadoEm: 'criado_em' };

// Banco ainda sem colunas novas (local, hora, cartao_id): grava sem elas até o schema.sql ser rodado de novo.
const COLUNAS_NOVAS = ['local', 'hora', 'cartao_id', 'estabelecimento'];
const colunasFaltando = new Set();
function paraBancoCompat(r) {
  const b = paraBanco(r);
  for (const c of colunasFaltando) delete b[c];
  return b;
}
function colunaFaltando(error) {
  const m = (error && error.message) || '';
  return COLUNAS_NOVAS.find((c) => new RegExp(`could not find the '${c}' column|column .*${c}.* does not exist`, 'i').test(m)) || null;
}
// Tenta gravar; se faltar uma coluna nova no banco, tira a coluna e tenta de novo.
async function gravarCompat(fazer) {
  for (;;) {
    const res = await fazer();
    const falta = res.error && colunaFaltando(res.error);
    if (!falta || colunasFaltando.has(falta)) return res;
    colunasFaltando.add(falta);
    store.bancoDesatualizado = true;
  }
}

// Só alguns campos (para atualizar vários registros de uma vez).
function paraBancoParcial(campos) {
  const b = { ...campos };
  for (const c of colunasFaltando) delete b[c];
  return b;
}

/** Limites por categoria; se "Álcool" e "Rolê" tinham limite, somam no "Rolê". */
function juntarLimites(linhas) {
  const porCat = new Map();
  for (const o of linhas) {
    const categoria = categoriaAtual(o.categoria);
    const antes = porCat.get(categoria);
    if (antes) antes.limite += Number(o.limite);
    else porCat.set(categoria, { ...o, categoria, limite: Number(o.limite) });
  }
  return [...porCat.values()];
}

function doBanco(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    item: row.item,
    valor: Number(row.valor),
    metodo: row.metodo,
    categoria: categoriaAtual(row.categoria),
    data: row.data,
    parcela: row.parcela,
    origem: row.origem,
    textoOriginal: row.texto_original,
    refExterna: row.ref_externa || null,
    local: row.local || null,
    hora: row.hora ? String(row.hora).slice(0, 5) : null,
    cartaoId: row.cartao_id || null,
    estabelecimento: row.estabelecimento || null,
    criadoEm: row.criado_em,
  };
}

function urlDoApp() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

function erroLegivel(error) {
  const m = (error && error.message) || String(error);
  if (/invalid login credentials/i.test(m)) return 'Email ou senha incorretos.';
  if (/email not confirmed/i.test(m)) return 'Falta confirmar o email (veja sua caixa de entrada).';
  if (/user already registered/i.test(m)) return 'Este email já tem conta. Use "Entrar".';
  if (/password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/signups not allowed for otp|user not found/i.test(m)) return 'Não achei conta com esse email.';
  if (/signups not allowed/i.test(m)) return 'Novos cadastros estão desativados.';
  if (/rate limit|security purposes|over_email_send_rate/i.test(m)) return 'Muitos pedidos seguidos. Espere alguns minutos e tente de novo.';
  if (/failed to fetch|network/i.test(m)) return 'Sem conexão com a internet.';
  if (/duplicate key|23505/i.test(m)) return 'Isso já tinha sido registrado antes.';
  if (/relation .* does not exist|could not find the table|schema cache/i.test(m)) {
    return 'O banco precisa ser atualizado: rode de novo o arquivo schema.sql no Supabase.';
  }
  if (/bucket not found/i.test(m)) return 'O banco precisa ser atualizado: rode de novo o arquivo schema.sql no Supabase.';
  if (/new password should be different/i.test(m)) return 'A nova senha precisa ser diferente da atual.';
  return m;
}

function numerosConta(c) {
  return { ...c, valor: Number(c.valor), dia_vencimento: Number(c.dia_vencimento) };
}

function numerosCartao(c) {
  return { ...c, dia_fechamento: Number(c.dia_fechamento), dia_vencimento: Number(c.dia_vencimento), limite: c.limite === null ? null : Number(c.limite) };
}

function numerosMeta(m) {
  return { ...m, valor_alvo: Number(m.valor_alvo), valor_atual: Number(m.valor_atual) };
}

function falhar(error) {
  throw new Error(erroLegivel(error));
}

const VAZIO = () => ({ registros: [], regras: [], orcamentos: [], metas: [], caixa: [], contas: [], cartoes: [], estabelecimentos: [] });
let cache = { ...VAZIO(), ...lerLocal(CHAVE_CACHE, {}) };
let usuarioAtual = null;

function usuarioDaSessaoGuardada() {
  const s = lerLocal(CHAVE_SESSAO, null);
  return s && s.refresh_token && s.user && s.user.id ? s.user : null;
}

/** A cópia local e a fila são de quem entrou: se outra pessoa entrar neste aparelho, começam do zero. */
function definirUsuario(u) {
  usuarioAtual = u;
  if (!u) return;
  if (cache.dono && cache.dono !== u.id) {
    cache = VAZIO();
    pendentes = [];
    gravarLocal(CHAVE_PENDENTES, pendentes);
  }
  if (cache.dono !== u.id) {
    cache.dono = u.id;
    salvarCache();
  }
}

// Sem sessão válida (login vencido e sem internet para renovar), o Supabase manda os pedidos
// como visitante: a nuvem responde tudo vazio e recusa as gravações. Então nada vai sem sessão.
async function exigirSessao() {
  const { data } = await cliente.auth.getSession();
  if (!data || !data.session) throw Object.assign(new Error('Sem conexão com a internet.'), { temporario: true });
  definirUsuario(data.session.user);
}

// Mudanças feitas enquanto a cópia da nuvem está sendo baixada valem por cima do que chegar
// (senão um gasto registrado logo ao abrir o app sumia da tela até a próxima sincronização).
const rastreios = new Set();
function marcar(tabela, chaves) {
  for (const r of rastreios) {
    const s = r[tabela] || (r[tabela] = new Set());
    for (const c of chaves) s.add(c);
  }
}
const TUDO = ['*'];
function sobrepor(daNuvem, local, mudou, chaveDe) {
  if (!mudou) return daNuvem;
  if (mudou.has('*')) return local;
  const locais = new Map(local.map((x) => [chaveDe(x), x]));
  return [...daNuvem.filter((x) => !mudou.has(chaveDe(x))), ...[...mudou].map((k) => locais.get(k)).filter(Boolean)];
}

// Gravar a cópia local (centenas de KB) trava a tela por dezenas de ms no celular:
// junta várias mudanças e grava quando o aparelho estiver livre (ou ao sair do app).
let cacheSujo = false;
function gravarCacheJa() {
  if (!cacheSujo) return;
  cacheSujo = false;
  gravarLocal(CHAVE_CACHE, cache);
}
function salvarCache() {
  if (cacheSujo) return;
  cacheSujo = true;
  if (typeof requestIdleCallback === 'function') requestIdleCallback(gravarCacheJa, { timeout: 1500 });
  else setTimeout(gravarCacheJa, 300);
}
if (typeof addEventListener === 'function') {
  addEventListener('pagehide', gravarCacheJa);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') gravarCacheJa(); });
}

// ---------- Envio em segundo plano ----------
// Salvar, editar e apagar mudam a tela na hora; o envio ao Supabase vai numa fila que fica
// guardada no aparelho. Sem internet, espera e manda quando voltar. Todos os envios podem
// ser repetidos sem duplicar (id gerado aqui, upsert, update e delete por id).
const CHAVE_PENDENTES = 'tp.pendentes.v1';
let pendentes = lerLocal(CHAVE_PENDENTES, []);
let fila = Promise.resolve();
let avisarErro = () => {};
const semRede = (e) => /failed to fetch|network|load failed|fetch failed|timeout|offline/i.test(`${(e && e.message) || e}`);
// Passa sozinho: sem internet, login vencido (renova e tenta de novo) ou o servidor fora do ar.
const temporario = (e) => Boolean(e && (e.temporario || semRede(e) || e.status === 401 || e.status === 429 || e.status >= 500
  || /PGRST30[13]|jwt expired/i.test(`${e.code || ''} ${e.message || ''}`)));

async function enviar(o) {
  const tabela = cliente.from(o.tabela);
  const compat = o.tabela === 'registros' ? paraBancoParcial : (x) => x;
  let res = { error: null };
  if (o.op === 'inserir') {
    res = await gravarCompat(() => cliente.from(o.tabela).upsert(o.linhas.map(compat), { onConflict: 'id', ignoreDuplicates: true }));
  } else if (o.op === 'upsert') {
    res = await tabela.upsert(o.linhas, { onConflict: o.conflito });
  } else if (o.op === 'atualizar') {
    for (let i = 0; i < o.ids.length && !res.error; i += 100) { // em lotes, para o endereço não ficar grande demais
      const lote = o.ids.slice(i, i + 100);
      res = await gravarCompat(() => (lote.length === 1
        ? cliente.from(o.tabela).update(compat(o.campos)).eq('id', lote[0])
        : cliente.from(o.tabela).update(compat(o.campos)).in('id', lote)));
    }
  } else if (o.op === 'apagar') {
    for (let i = 0; i < o.ids.length && !res.error; i += 100) res = await cliente.from(o.tabela).delete().in('id', o.ids.slice(i, i + 100));
  }
  if (res.error) throw Object.assign(new Error(res.error.message || String(res.error)), { code: res.error.code, status: res.status });
}

/**
 * Manda o que estiver pendente, em ordem. Sem internet (ou com o login vencido), para e tenta
 * de novo depois, sem perder nada. Se a nuvem recusar um envio, só ele sai da fila.
 */
function processarFila() {
  fila = fila.then(async () => {
    if (!pendentes.length) return;
    try {
      await exigirSessao();
    } catch {
      return; // sem login válido agora: tudo continua guardado
    }
    let recusado = null;
    while (pendentes.length) {
      try {
        await enviar(pendentes[0]);
      } catch (err) {
        if (temporario(err)) break; // continua guardado; tenta quando der
        recusado = err; // ex.: o banco recusou o valor: descarta só este envio e segue com os outros
      }
      pendentes.shift();
      gravarLocal(CHAVE_PENDENTES, pendentes);
    }
    if (recusado) {
      try { await baixarTudo(); } catch { /* sem internet: fica a cópia local */ }
      avisarErro(erroLegivel(recusado));
    }
  });
  return fila;
}

function enfileirar(...ops) {
  pendentes.push(...ops);
  gravarLocal(CHAVE_PENDENTES, pendentes);
  salvarCache();
  processarFila();
}
if (typeof addEventListener === 'function') addEventListener('online', () => processarFila());
// Login renovado: manda o que ficou esperando. Fora do aviso do Supabase, que não pode
// esperar outro pedido dele mesmo.
cliente.auth.onAuthStateChange((evento) => {
  if ((evento === 'TOKEN_REFRESHED' || evento === 'SIGNED_IN') && pendentes.length) setTimeout(processarFila, 0);
});

/** Registro como fica na cópia local (mesmo formato do que vem do banco). */
function comoNoBanco(id, r, criadoEm) {
  return doBanco({ id, ...paraBanco(r), criado_em: criadoEm || r.criadoEm || new Date().toISOString() });
}

// Busca tudo do Supabase (o carregar público espera a fila de envio antes).
let baixarTudo = async () => {};

export const store = {
  // ---------- Login ----------
  /** Quem está com a sessão válida (renova o login se precisar); null se não der. */
  async usuario() {
    const { data } = await cliente.auth.getSession();
    if (data.session) definirUsuario(data.session.user);
    else if (!usuarioDaSessaoGuardada()) usuarioAtual = null; // sem internet, mas ainda é a mesma pessoa
    return data.session ? usuarioAtual : null;
  },
  /**
   * Quem entrou neste aparelho, lido direto da sessão guardada (sem esperar a internet).
   * Serve para abrir o app na hora com a cópia local; a sessão é conferida em seguida.
   */
  usuarioGuardado() {
    const u = usuarioDaSessaoGuardada();
    if (u && !usuarioAtual) definirUsuario(u);
    return u;
  },
  email() {
    return usuarioAtual ? usuarioAtual.email : '';
  },
  // Link no email: abre o app de volta neste mesmo endereço.
  async esqueciSenha(email) {
    const { error } = await cliente.auth.resetPasswordForEmail(email, { redirectTo: urlDoApp() });
    if (error) falhar(error);
  },
  async entrarComLink(email) {
    const { error } = await cliente.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: urlDoApp() } });
    if (error) falhar(error);
  },
  aoMudarLogin(f) {
    cliente.auth.onAuthStateChange((evento, sessao) => {
      if (sessao) usuarioAtual = sessao.user;
      // Avisa a tela fora do aviso do Supabase (que não pode esperar outro pedido dele mesmo).
      setTimeout(() => f(evento), 0);
    });
  },
  async trocarSenha(nova) {
    const { error } = await cliente.auth.updateUser({ password: nova });
    if (error) falhar(error);
  },
  async entrar(email, senha) {
    const { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });
    if (error) falhar(error);
    definirUsuario(data.user);
  },
  async cadastrar(email, senha) {
    const { data, error } = await cliente.auth.signUp({ email, password: senha });
    if (error) falhar(error);
    if (data.session) definirUsuario(data.user);
    return { precisaConfirmar: !data.session };
  },
  async sair() {
    await processarFila().catch(() => {});
    await cliente.auth.signOut();
    usuarioAtual = null;
    cache = VAZIO();
    pendentes = [];
    gravarLocal(CHAVE_PENDENTES, pendentes);
    cacheSujo = true;
    gravarCacheJa();
  },

  // ---------- Dados ----------
  async carregar() {
    await processarFila();
    if (pendentes.length) throw new Error('Sem conexão com a internet.'); // mudanças guardadas esperando a internet
    await baixarTudo();
  },
  /** Mudanças feitas sem internet que ainda vão ser enviadas. */
  pendentes() {
    return pendentes.length;
  },
  /** Espera os envios em segundo plano (para testes e antes de sair). */
  sincronizar() {
    return processarFila();
  },
  aoFalharEnvio(f) {
    avisarErro = f;
  },
  async _baixarTudo() {
    const mudou = {};
    rastreios.add(mudou);
    try {
      await exigirSessao();
      await this._baixarTudoDaNuvem(mudou);
    } finally {
      rastreios.delete(mudou);
    }
  },
  async _baixarTudoDaNuvem(mudou) {
    // As tabelas pequenas vão junto com a primeira página de registros (uma ida ao servidor, não duas).
    const outras = Promise.all([
      cliente.from('regras').select('termo, categoria').order('criado_em', { ascending: false }),
      cliente.from('orcamentos').select('id, categoria, limite'),
      cliente.from('metas').select('*').order('criado_em'),
      cliente.from('caixa_entrada').select('*').order('criado_em', { ascending: false }).limit(30),
      cliente.from('contas_fixas').select('*').order('dia_vencimento'),
      cliente.from('cartoes').select('*').order('criado_em'),
      cliente.from('estabelecimentos').select('*'),
    ]);
    // Primeira página já diz quantos são; as outras vêm todas ao mesmo tempo (não uma depois da outra).
    const passo = 1000;
    const pagina = (de, contar) => cliente.from('registros').select('*', contar ? { count: 'exact' } : undefined)
      .order('data', { ascending: false }).order('id').range(de, de + passo - 1);
    const primeira = await pagina(0, true);
    if (primeira.error) falhar(primeira.error);
    if (primeira.data.length) for (const c of COLUNAS_NOVAS) if (!(c in primeira.data[0])) colunasFaltando.add(c);
    const total = primeira.count ?? primeira.data.length;
    const resto = [];
    for (let de = passo; de < total; de += passo) resto.push(pagina(de));
    const paginas = [primeira, ...(await Promise.all(resto))];
    // Sem a contagem (não deveria acontecer): segue página por página até acabar
    if (primeira.count == null) {
      for (let de = passo, ultima = primeira; ultima.data && ultima.data.length === passo; de += passo) {
        ultima = await pagina(de);
        paginas.push(ultima);
      }
    }
    const registros = [];
    for (const pg of paginas) {
      if (pg.error) falhar(pg.error);
      for (const row of pg.data) registros.push(doBanco(row));
    }
    const [regras, orcamentos, metas, caixa, contas, cartoes, estabelecimentos] = await outras;
    if (regras.error) falhar(regras.error);
    const local = cache;
    cache = {
      dono: local.dono,
      registros: sobrepor(registros, local.registros, mudou.registros, (r) => r.id),
      // Categorias antigas ("Álcool") já aparecem com o nome novo, mesmo antes do SQL de migração.
      regras: sobrepor(regras.data.map((r) => ({ ...r, categoria: categoriaAtual(r.categoria) })), local.regras, mudou.regras, (r) => r.termo),
      // Tabelas novas: se o banco ainda não foi atualizado, o app continua funcionando.
      orcamentos: sobrepor(orcamentos.error ? [] : juntarLimites(orcamentos.data), local.orcamentos, mudou.orcamentos),
      metas: sobrepor(metas.error ? [] : metas.data.map(numerosMeta), local.metas, mudou.metas),
      caixa: sobrepor(caixa.error ? [] : caixa.data, local.caixa, mudou.caixa),
      contas: sobrepor(contas.error ? [] : contas.data.map((c) => numerosConta({ ...c, categoria: categoriaAtual(c.categoria) })), local.contas || [], mudou.contas),
      cartoes: sobrepor(cartoes.error ? [] : cartoes.data.map(numerosCartao), local.cartoes || [], mudou.cartoes),
      estabelecimentos: sobrepor(estabelecimentos.error ? [] : estabelecimentos.data.map((e) => ({ ...e,
        categoria: e.categoria && categoriaAtual(e.categoria), vezes: Number(e.vezes) })), local.estabelecimentos || [], mudou.estabelecimentos, (e) => e.chave),
    };
    this.semEstabelecimentos = Boolean(estabelecimentos.error);
    this.bancoDesatualizado = Boolean(orcamentos.error || metas.error || caixa.error || contas.error || cartoes.error || estabelecimentos.error || colunasFaltando.size);
    salvarCache();
  },
  bancoDesatualizado: false,
  /**
   * Todos os registros. A lista não muda de lugar enquanto nada muda (as telas reaproveitam
   * os cálculos feitos sobre ela); cada mudança cria uma lista nova. Não altere a lista.
   */
  listar() {
    return cache.registros;
  },
  regras() {
    return cache.regras;
  },
  /** Novo registro: aparece na hora; o envio segue em segundo plano. */
  async adicionar(lancamentos) {
    const agora = new Date().toISOString();
    const novos = lancamentos.map((l) => comoNoBanco(l.id || crypto.randomUUID(), l, agora));
    cache.registros = [...cache.registros, ...novos];
    marcar('registros', novos.map((r) => r.id));
    enfileirar({ op: 'inserir', tabela: 'registros', linhas: novos.map((r) => ({ id: r.id, ...paraBanco(r) })) });
    return novos;
  },
  /**
   * Grava registros de extrato sem repetir: pula referências que já existem.
   * Se outro aparelho importou o mesmo extrato nesse meio-tempo, recarrega e tenta de novo.
   * Retorna quantos foram gravados.
   */
  async importar(lancamentos) {
    await processarFila();
    await exigirSessao();
    for (let tentativa = 0; ; tentativa++) {
      const refs = new Set(cache.registros.map((r) => r.refExterna).filter(Boolean));
      const novos = lancamentos.filter((l) => !l.refExterna || !refs.has(l.refExterna));
      if (!novos.length) return 0;
      const { data, error } = await gravarCompat(() => cliente.from('registros').insert(novos.map(paraBancoCompat)).select());
      if (!error) {
        cache.registros = [...cache.registros, ...data.map(doBanco)];
        marcar('registros', data.map((r) => r.id));
        salvarCache();
        return data.length;
      }
      if (tentativa > 0 || !/duplicate key|23505/i.test(`${error.code} ${error.message}`)) falhar(error);
      await this.carregar();
    }
  },
  // ---------- O que foi em cada estabelecimento (aprendido na importação de extrato) ----------
  estabelecimentos() {
    return cache.estabelecimentos || [];
  },
  semEstabelecimentos: false,
  async salvarEstabelecimentos(lista) {
    if (!lista.length || this.semEstabelecimentos) return;
    const agora = new Date().toISOString();
    const linhas = lista.map((e) => ({ chave: e.chave, nome: e.nome || null, apelido: e.apelido || null, item: e.item || null,
      categoria: e.categoria || null, vezes: e.vezes ?? 1, atualizado_em: agora }));
    const novas = new Map(linhas.map((e) => [e.chave, e]));
    cache.estabelecimentos = [...this.estabelecimentos().filter((e) => !novas.has(e.chave)), ...novas.values()];
    marcar('estabelecimentos', [...novas.keys()]);
    enfileirar({ op: 'upsert', tabela: 'estabelecimentos', linhas, conflito: 'user_id,chave' });
  },
  /**
   * Dá um nome seu para quem recebeu ("Mãe", "Posto Rodovia X") e aplica em
   * todos os registros dessa pessoa ou lugar (`ids`); as próximas importações também usam.
   */
  async renomearQuem(chave, apelido, ids, original) {
    const antes = this.estabelecimentos().find((e) => e.chave === chave);
    await this.salvarEstabelecimentos([{ ...(antes || { chave, nome: original, vezes: 1 }), apelido: apelido || null }]);
    const nome = apelido || original || null;
    const dele = new Set(ids);
    // Onde o nome do item ainda é o nome antigo (você não disse o que foi), troca também.
    const antigos = new Set([original, antes && antes.apelido].filter(Boolean).map((t) => t.toLowerCase()));
    const comNomeAntigo = [];
    cache.registros = cache.registros.map((r) => {
      if (!dele.has(r.id)) return r;
      const trocarItem = nome && antigos.has(String(r.item).toLowerCase());
      if (trocarItem) comNomeAntigo.push(r.id);
      return { ...r, local: nome, estabelecimento: chave, ...(trocarItem ? { item: nome } : {}) };
    });
    marcar('registros', ids);
    const ops = [{ op: 'atualizar', tabela: 'registros', ids, campos: { local: nome, estabelecimento: chave } }];
    if (comNomeAntigo.length) ops.push({ op: 'atualizar', tabela: 'registros', ids: comNomeAntigo, campos: { item: nome } });
    enfileirar(...ops);
  },
  async atualizar(id, m) {
    const antigo = cache.registros.find((r) => r.id === id);
    const novo = comoNoBanco(id, m, antigo && antigo.criadoEm);
    cache.registros = cache.registros.map((r) => (r.id === id ? novo : r));
    marcar('registros', [id]);
    enfileirar({ op: 'atualizar', tabela: 'registros', ids: [id], campos: paraBanco(novo) });
  },
  /**
   * Os mesmos campos (ex.: { item, categoria }) em vários registros de uma vez:
   * a tela muda numa passada só e vai um envio só para a nuvem.
   */
  async atualizarVarios(ids, campos) {
    if (!ids.length) return;
    const alvo = new Set(ids);
    cache.registros = cache.registros.map((r) => (alvo.has(r.id) ? { ...r, ...campos } : r));
    marcar('registros', ids);
    const banco = Object.fromEntries(Object.entries(campos).map(([k, v]) => [COLUNAS_BANCO[k] || k, v]));
    enfileirar({ op: 'atualizar', tabela: 'registros', ids: [...alvo], campos: banco });
  },
  async remover(id) {
    return this.removerVarios([id]);
  },
  /** Apaga vários de uma vez. */
  async removerVarios(ids) {
    const apagados = new Set(ids);
    cache.registros = cache.registros.filter((r) => !apagados.has(r.id));
    marcar('registros', apagados);
    enfileirar({ op: 'apagar', tabela: 'registros', ids: [...ids] });
  },
  async aprenderRegra(termo, categoria) {
    const t = termo.trim().toLowerCase();
    // "Não lembro" é daquele gasto só: não ensina que o item é sempre isso.
    if (!t || categoria === NAO_LEMBRO) return;
    cache.regras = [{ termo: t, categoria }, ...cache.regras.filter((r) => r.termo !== t)];
    marcar('regras', [t]);
    enfileirar({ op: 'upsert', tabela: 'regras', linhas: [{ termo: t, categoria }], conflito: 'user_id,termo' });
  },

  // ---------- Limites por categoria ----------
  orcamentos() {
    return cache.orcamentos;
  },
  async salvarLimite(categoria, limite) {
    await exigirSessao();
    marcar('orcamentos', TUDO);
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
    await exigirSessao();
    marcar('metas', TUDO);
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
    await exigirSessao();
    marcar('metas', TUDO);
    const { error } = await cliente.from('metas').delete().eq('id', id);
    if (error) falhar(error);
    cache.metas = cache.metas.filter((m) => m.id !== id);
    salvarCache();
  },

  // ---------- Contas fixas ----------
  contas() {
    return cache.contas || [];
  },
  async salvarConta(conta) {
    await exigirSessao();
    marcar('contas', TUDO);
    const campos = { nome: conta.nome, valor: conta.valor, dia_vencimento: conta.dia_vencimento, categoria: conta.categoria || 'Outros',
      metodo: conta.metodo || null, ativa: conta.ativa !== false };
    const consulta = conta.id
      ? cliente.from('contas_fixas').update(campos).eq('id', conta.id).select().single()
      : cliente.from('contas_fixas').insert(campos).select().single();
    const { data, error } = await consulta;
    if (error) falhar(error);
    const salva = numerosConta(data);
    const lista = this.contas();
    cache.contas = conta.id ? lista.map((c) => (c.id === conta.id ? salva : c)) : [...lista, salva];
    salvarCache();
    return salva;
  },
  async removerConta(id) {
    await exigirSessao();
    marcar('contas', TUDO);
    const { error } = await cliente.from('contas_fixas').delete().eq('id', id);
    if (error) falhar(error);
    cache.contas = this.contas().filter((c) => c.id !== id);
    salvarCache();
  },

  // ---------- Cartões de crédito ----------
  cartoes() {
    return cache.cartoes || [];
  },
  async salvarCartao(cartao) {
    await exigirSessao();
    marcar('cartoes', TUDO);
    const campos = { nome: cartao.nome, dia_fechamento: cartao.dia_fechamento, dia_vencimento: cartao.dia_vencimento,
      limite: cartao.limite || null, cor: cartao.cor || null };
    const consulta = cartao.id
      ? cliente.from('cartoes').update(campos).eq('id', cartao.id).select().single()
      : cliente.from('cartoes').insert(campos).select().single();
    const { data, error } = await consulta;
    if (error) falhar(error);
    const salvo = numerosCartao(data);
    const lista = this.cartoes();
    cache.cartoes = cartao.id ? lista.map((c) => (c.id === cartao.id ? salvo : c)) : [...lista, salvo];
    salvarCache();
    return salvo;
  },
  async removerCartao(id) {
    await exigirSessao();
    marcar('cartoes', TUDO);
    const { error } = await cliente.from('cartoes').delete().eq('id', id);
    if (error) falhar(error);
    cache.cartoes = this.cartoes().filter((c) => c.id !== id);
    // o banco tira o cartão dos gastos (on delete set null); a cópia local acompanha
    marcar('registros', cache.registros.filter((r) => r.cartaoId === id).map((r) => r.id));
    cache.registros = cache.registros.map((r) => (r.cartaoId === id ? { ...r, cartaoId: null } : r));
    salvarCache();
  },

  // ---------- Caixa de entrada (fotos e extratos para a rotina do Claude) ----------
  caixa() {
    return cache.caixa;
  },
  async enviarParaCaixa(arquivo, tipo, observacao) {
    await exigirSessao();
    marcar('caixa', TUDO);
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
    await exigirSessao();
    marcar('caixa', TUDO);
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

baixarTudo = () => store._baixarTudo();
