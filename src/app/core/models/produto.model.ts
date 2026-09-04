/**
 * Unidades de medida suportadas.
 * `fator` normaliza para a unidade base da familia, permitindo comparar
 * precos entre embalagens diferentes (ex: 500g vs 1kg).
 */
export type UnidadeMedida = 'un' | 'kg' | 'g' | 'L' | 'ml' | 'cx' | 'pct' | 'dz';

export interface DefinicaoUnidade {
  sigla: UnidadeMedida;
  rotulo: string;
  /** Unidade base usada para normalizar o preco. */
  base: UnidadeMedida;
  /** Quanto vale 1 desta unidade na unidade base. */
  fator: number;
  /** Se aceita valores fracionados (0,750 kg). */
  fracionada: boolean;
}

export const UNIDADES: DefinicaoUnidade[] = [
  { sigla: 'un', rotulo: 'unidade', base: 'un', fator: 1, fracionada: false },
  { sigla: 'kg', rotulo: 'quilo', base: 'kg', fator: 1, fracionada: true },
  { sigla: 'g', rotulo: 'grama', base: 'kg', fator: 0.001, fracionada: true },
  { sigla: 'L', rotulo: 'litro', base: 'L', fator: 1, fracionada: true },
  { sigla: 'ml', rotulo: 'mililitro', base: 'L', fator: 0.001, fracionada: true },
  { sigla: 'cx', rotulo: 'caixa', base: 'un', fator: 1, fracionada: false },
  { sigla: 'pct', rotulo: 'pacote', base: 'un', fator: 1, fracionada: false },
  { sigla: 'dz', rotulo: 'duzia', base: 'un', fator: 12, fracionada: false },
];

export function definicaoUnidade(sigla: UnidadeMedida): DefinicaoUnidade {
  return UNIDADES.find((u) => u.sigla === sigla) ?? UNIDADES[0];
}

/**
 * Um produto existe independente das listas: e o fio que costura o
 * historico de preco ao longo do tempo.
 */
export interface Produto {
  id?: number;
  /** Nome como o usuario digitou. */
  nome: string;
  /** Nome normalizado (minusculo, sem acento) usado para busca e deduplicacao. */
  chaveBusca: string;
  unidadePadrao: UnidadeMedida;
  categoria?: string;
  /** Quantas vezes o produto ja foi comprado - usado para ordenar sugestoes. */
  vezesComprado: number;
  criadoEm: number;
  atualizadoEm: number;
}

/** Remove acentos e normaliza para comparacao/busca. */
export function normalizarNome(valor: string): string {
  return valor
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}
