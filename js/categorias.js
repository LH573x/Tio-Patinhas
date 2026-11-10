// Aparência de cada categoria: ícone e cor (a cor acompanha a categoria em
// todos os gráficos, nunca a posição no ranking).
// Cores da paleta validada para daltonismo (ordem fixa), com variação para o
// modo escuro. "Outros" é cinza de propósito: é o grupo de sobras.

export const CATEGORIAS_INFO = {
  'Refeições': { icone: '🍽️', cor: '#eb6834', corEscura: '#d95926' },
  'Alimentação geral': { icone: '🛒', cor: '#1baf7a', corEscura: '#199e70' },
  Carro: { icone: '🚗', cor: '#2a78d6', corEscura: '#3987e5' },
  Namorada: { icone: '❤️', cor: '#e87ba4', corEscura: '#d55181' },
  Viagens: { icone: '✈️', cor: '#6250d6', corEscura: '#9085e9' },
  Besteira: { icone: '🍫', cor: '#c2255c', corEscura: '#e8598a' },
  'Rolê': { icone: '🎉', cor: '#c99700', corEscura: '#e0b000' },
  'Álcool': { icone: '🍺', cor: '#8a2a2a', corEscura: '#d06a5a' },
  Entretenimento: { icone: '🎬', cor: '#0b8fa3', corEscura: '#2bb3c7' },
  Outros: { icone: '📦', cor: '#8b8a85', corEscura: '#8b8a85' },
  // Ainda não se sabe o que foi: cor de atenção, para chamar a revisão.
  'A definir': { icone: '❔', cor: '#b4570b', corEscura: '#f0a050' },
  'Salário': { icone: '💼', cor: '#008300', corEscura: '#2a9d2a' },
  'Outras entradas': { icone: '💰', cor: '#eda100', corEscura: '#c98500' },
};

export function infoCategoria(nome) {
  return CATEGORIAS_INFO[nome] || CATEGORIAS_INFO.Outros;
}
