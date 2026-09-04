import { Produto, UnidadeMedida } from '../models/produto.model';

/**
 * Contrato de acesso a produtos.
 *
 * E uma classe abstrata (e nao uma interface) de proposito: interfaces
 * somem na compilacao e nao podem servir de token de injecao no Angular.
 * Assim os componentes injetam `ProdutoRepository` sem saber quem implementa.
 *
 * Para migrar para backend no futuro basta criar `ApiProdutoRepository`
 * e trocar o `useClass` no app.config.ts. Nenhuma tela muda.
 */
export abstract class ProdutoRepository {
  /** Sugestoes por prefixo/trecho do nome, mais comprados primeiro. */
  abstract sugerir(termo: string, limite?: number): Promise<Produto[]>;

  /** Busca pelo nome exato normalizado; cria se ainda nao existir. */
  abstract obterOuCriar(nome: string, unidade: UnidadeMedida): Promise<Produto>;

  abstract obterPorId(id: number): Promise<Produto | undefined>;

  abstract listarTodos(): Promise<Produto[]>;

  abstract atualizar(id: number, mudancas: Partial<Produto>): Promise<void>;

  abstract remover(id: number): Promise<void>;
}
