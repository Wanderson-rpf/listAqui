import Dexie, { Table } from 'dexie';
import { Produto } from '../models/produto.model';
import { ItemLista, Lista } from '../models/lista.model';

/**
 * Banco local (IndexedDB) via Dexie.
 *
 * Nenhum componente de tela deve importar esta classe diretamente.
 * O acesso a dados passa sempre pelos repositorios, para que trocar
 * IndexedDB por uma API HTTP no futuro nao encoste na camada de UI.
 */
export class AppDb extends Dexie {
  produtos!: Table<Produto, number>;
  listas!: Table<Lista, number>;
  itens!: Table<ItemLista, number>;

  constructor() {
    super('compras-db');

    this.version(1).stores({
      produtos: '++id, chaveBusca, categoria, vezesComprado',
      listas: '++id, status, tipo, criadoEm, finalizadaEm',
      itens: '++id, listaId, produtoId, comprado, [listaId+comprado], compradoEm',
    });
  }
}

/**
 * Instancia unica. Dexie ja gerencia a conexao internamente,
 * entao um singleton de modulo e suficiente e evita abrir o banco duas vezes
 * durante o hot reload em desenvolvimento.
 */
export const db = new AppDb();
