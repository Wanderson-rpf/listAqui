import { UnidadeMedida } from './produto.model';

export type TipoLista = 'mercado' | 'feira' | 'farmacia' | 'avulsa';

export interface DefinicaoTipo {
  valor: TipoLista;
  rotulo: string;
  icone: string;
  cor: string;
}

export const TIPOS_LISTA: DefinicaoTipo[] = [
  { valor: 'mercado', rotulo: 'Mercado', icone: 'cart-outline', cor: 'primary' },
  { valor: 'feira', rotulo: 'Feira', icone: 'storefront-outline', cor: 'success' },
  { valor: 'farmacia', rotulo: 'Farmacia', icone: 'medkit-outline', cor: 'danger' },
  { valor: 'avulsa', rotulo: 'Avulsa', icone: 'bag-handle-outline', cor: 'medium' },
];

export function definicaoTipo(valor: TipoLista): DefinicaoTipo {
  return TIPOS_LISTA.find((t) => t.valor === valor) ?? TIPOS_LISTA[3];
}

/**
 * Ciclo de vida de uma compra:
 *   montando  -> voce esta escrevendo o que precisa comprar
 *   comprando -> voce esta no mercado riscando os itens
 *   finalizada -> virou historico, nao muda mais
 *
 * A lista finalizada E a compra. Nao existe entidade separada de "compra":
 * isso mantem o modelo simples sem perder historico.
 */
export type StatusLista = 'montando' | 'comprando' | 'finalizada';

export interface Lista {
  id?: number;
  nome: string;
  tipo: TipoLista;
  /** Onde a compra foi feita. Usado para comparar preco entre mercados. */
  local?: string;
  status: StatusLista;
  /** Teto de gasto opcional, em reais. */
  orcamento?: number;
  observacao?: string;
  criadoEm: number;
  iniciadaEm?: number;
  finalizadaEm?: number;
  /**
   * Total desnormalizado no momento de finalizar.
   * Evita recalcular a soma toda vez que a tela de historico abre.
   */
  totalGasto?: number;
  totalItensComprados?: number;
}

export interface ItemLista {
  id?: number;
  listaId: number;
  produtoId: number;
  /** Snapshot do nome: se o produto for renomeado, o historico nao muda. */
  nomeProduto: string;
  unidade: UnidadeMedida;
  quantidadePlanejada: number;
  observacao?: string;
  ordem: number;

  // --- preenchido no momento em que o item e riscado ---
  comprado: boolean;
  quantidadeComprada?: number;
  /** Preco por unidade, em reais. */
  precoUnitario?: number;
  compradoEm?: number;

  /** Item que nao estava na lista e foi jogado no carrinho na hora. */
  foraDaLista?: boolean;
}

/** Total pago por um item ja comprado. */
export function totalDoItem(item: ItemLista): number {
  if (!item.comprado || item.precoUnitario == null) return 0;
  const qtd = item.quantidadeComprada ?? item.quantidadePlanejada;
  return arredondar(qtd * item.precoUnitario);
}

/** Arredonda para 2 casas evitando erro de ponto flutuante (0.1 + 0.2). */
export function arredondar(valor: number, casas = 2): number {
  const f = Math.pow(10, casas);
  return Math.round((valor + Number.EPSILON) * f) / f;
}
