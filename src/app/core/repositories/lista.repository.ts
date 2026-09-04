import { ItemLista, Lista } from '../models/lista.model';

/** Uma ocorrencia de compra de um produto, para montar historico de preco. */
export interface RegistroPreco {
  itemId: number;
  listaId: number;
  listaNome: string;
  local?: string;
  data: number;
  quantidade: number;
  precoUnitario: number;
  total: number;
  unidade: string;
}

/** Numeros agregados de uma compra em andamento ou finalizada. */
export interface ResumoCompra {
  totalGasto: number;
  itensComprados: number;
  itensTotal: number;
}

/**
 * Contrato de acesso a listas e seus itens.
 * A lista e o "aggregate root": os itens so existem dentro de uma lista,
 * entao ficam no mesmo repositorio em vez de um repositorio proprio.
 */
export abstract class ListaRepository {
  // --- listas ---
  abstract criar(dados: Omit<Lista, 'id' | 'criadoEm' | 'status'>): Promise<number>;
  abstract obter(id: number): Promise<Lista | undefined>;
  abstract listarAtivas(): Promise<Lista[]>;
  abstract listarFinalizadas(): Promise<Lista[]>;
  abstract atualizar(id: number, mudancas: Partial<Lista>): Promise<void>;
  abstract remover(id: number): Promise<void>;
  abstract duplicar(id: number, novoNome: string): Promise<number>;

  // --- itens ---
  abstract itensDaLista(listaId: number): Promise<ItemLista[]>;
  abstract adicionarItem(item: Omit<ItemLista, 'id' | 'ordem' | 'comprado'>): Promise<number>;
  abstract atualizarItem(id: number, mudancas: Partial<ItemLista>): Promise<void>;
  abstract removerItem(id: number): Promise<void>;

  /** Marca como comprado gravando quantidade e preco daquele momento. */
  abstract registrarCompra(
    itemId: number,
    quantidade: number,
    precoUnitario: number,
  ): Promise<void>;

  /** Desfaz o registro, devolvendo o item para a lista de pendentes. */
  abstract desfazerCompra(itemId: number): Promise<void>;

  // --- ciclo de vida ---
  abstract iniciarCompra(listaId: number): Promise<void>;
  abstract finalizar(listaId: number): Promise<void>;
  abstract reabrir(listaId: number): Promise<void>;

  // --- consultas ---
  abstract resumo(listaId: number): Promise<ResumoCompra>;
  abstract historicoPreco(produtoId: number): Promise<RegistroPreco[]>;
  abstract totalPorPeriodo(desde: number, ate: number): Promise<number>;
}
