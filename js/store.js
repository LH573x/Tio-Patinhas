// Armazenamento dos registros.
// Por enquanto fica só neste aparelho (localStorage). Na próxima etapa,
// a mesma interface passa a usar o Supabase, com login e sincronização.

const CHAVE_REGISTROS = 'tp.registros.v1';
const CHAVE_REGRAS = 'tp.regras.v1';

function ler(chave, padrao) {
  try {
    const v = localStorage.getItem(chave);
    return v ? JSON.parse(v) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch (e) {
    console.error('Não foi possível salvar', e);
  }
}

function novoId() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const store = {
  listar() {
    return ler(CHAVE_REGISTROS, []);
  },
  adicionar(lancamentos) {
    const lista = this.listar();
    const criados = lancamentos.map((l) => ({ ...l, id: novoId(), criadoEm: new Date().toISOString() }));
    gravar(CHAVE_REGISTROS, [...lista, ...criados]);
    return criados;
  },
  atualizar(id, mudancas) {
    const lista = this.listar().map((r) => (r.id === id ? { ...r, ...mudancas } : r));
    gravar(CHAVE_REGISTROS, lista);
  },
  remover(id) {
    gravar(CHAVE_REGISTROS, this.listar().filter((r) => r.id !== id));
  },
  regras() {
    return ler(CHAVE_REGRAS, []);
  },
  aprenderRegra(termo, categoria) {
    const t = termo.trim().toLowerCase();
    if (!t) return;
    const regras = this.regras().filter((r) => r.termo !== t);
    regras.unshift({ termo: t, categoria });
    gravar(CHAVE_REGRAS, regras);
  },
};
