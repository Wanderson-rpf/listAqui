import { Injectable } from '@angular/core';
import { db } from '../../db/app-db';
import { Produto, UnidadeMedida, normalizarNome } from '../../models/produto.model';
import { ProdutoRepository } from '../produto.repository';

@Injectable()
export class DexieProdutoRepository extends ProdutoRepository {
  async sugerir(termo: string, limite = 8): Promise<Produto[]> {
    const chave = normalizarNome(termo);
    if (!chave) {
      // Sem termo digitado, sugere os mais comprados.
      const todos = await db.produtos.orderBy('vezesComprado').reverse().limit(limite).toArray();
      return todos;
    }

    // startsWithIgnoreCase usa o indice; o filtro extra pega ocorrencias no meio
    // do nome ("integral" encontrando "leite integral").
    const porPrefixo = await db.produtos.where('chaveBusca').startsWith(chave).toArray();
    const porTrecho = await db.produtos
      .filter((p) => p.chaveBusca.includes(chave) && !p.chaveBusca.startsWith(chave))
      .toArray();

    return [...ordenar(porPrefixo), ...ordenar(porTrecho)].slice(0, limite);
  }

  async obterOuCriar(nome: string, unidade: UnidadeMedida): Promise<Produto> {
    const chave = normalizarNome(nome);
    const existente = await db.produtos.where('chaveBusca').equals(chave).first();
    if (existente) return existente;

    const agora = Date.now();
    const novo: Produto = {
      nome: nome.trim(),
      chaveBusca: chave,
      unidadePadrao: unidade,
      vezesComprado: 0,
      criadoEm: agora,
      atualizadoEm: agora,
    };
    novo.id = await db.produtos.add(novo);
    return novo;
  }

  obterPorId(id: number): Promise<Produto | undefined> {
    return db.produtos.get(id);
  }

  async listarTodos(): Promise<Produto[]> {
    const todos = await db.produtos.toArray();
    return todos.sort((a, b) => a.chaveBusca.localeCompare(b.chaveBusca, 'pt-BR'));
  }

  async atualizar(id: number, mudancas: Partial<Produto>): Promise<void> {
    const patch: Partial<Produto> = { ...mudancas, atualizadoEm: Date.now() };
    if (mudancas.nome) patch.chaveBusca = normalizarNome(mudancas.nome);
    await db.produtos.update(id, patch);
  }

  async remover(id: number): Promise<void> {
    await db.produtos.delete(id);
  }
}

function ordenar(lista: Produto[]): Produto[] {
  return lista.sort(
    (a, b) => b.vezesComprado - a.vezesComprado || a.chaveBusca.localeCompare(b.chaveBusca, 'pt-BR'),
  );
}
