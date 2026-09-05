import { Injectable } from '@angular/core';
import { db } from '../../db/app-db';
import { ItemLista, Lista, arredondar, totalDoItem } from '../../models/lista.model';
import { ListaRepository, RegistroPreco, ResumoCompra } from '../lista.repository';

@Injectable()
export class DexieListaRepository extends ListaRepository {
  // ------------------------------------------------------------------ listas

  async criar(dados: Omit<Lista, 'id' | 'criadoEm' | 'status'>): Promise<number> {
    const lista: Lista = { ...dados, status: 'montando', criadoEm: Date.now() };
    return db.listas.add(lista);
  }

  obter(id: number): Promise<Lista | undefined> {
    return db.listas.get(id);
  }

  async listarAtivas(): Promise<Lista[]> {
    const listas = await db.listas.where('status').anyOf('montando', 'comprando').toArray();
    // Compras em andamento sobem para o topo: e o que voce quer ver no mercado.
    return listas.sort(
      (a, b) =>
        peso(b.status) - peso(a.status) ||
        (b.iniciadaEm ?? b.criadoEm) - (a.iniciadaEm ?? a.criadoEm),
    );
  }

  async listarFinalizadas(): Promise<Lista[]> {
    const listas = await db.listas.where('status').equals('finalizada').toArray();
    return listas.sort((a, b) => (b.finalizadaEm ?? 0) - (a.finalizadaEm ?? 0));
  }

  async atualizar(id: number, mudancas: Partial<Lista>): Promise<void> {
    await db.listas.update(id, mudancas);
  }

  async remover(id: number): Promise<void> {
    await db.transaction('rw', db.listas, db.itens, async () => {
      await db.itens.where('listaId').equals(id).delete();
      await db.listas.delete(id);
    });
  }

  async duplicar(id: number, novoNome: string): Promise<number> {
    const original = await db.listas.get(id);
    if (!original) throw new Error('Lista nao encontrada');
    const itens = await this.itensDaLista(id);

    return db.transaction('rw', db.listas, db.itens, async () => {
      const novoId = await db.listas.add({
        nome: novoNome,
        tipo: original.tipo,
        local: original.local,
        orcamento: original.orcamento,
        status: 'montando',
        criadoEm: Date.now(),
      });

      // Copia apenas o que foi planejado: preco e quantidade real ficam para tras.
      await db.itens.bulkAdd(
        itens.map((item, i) => ({
          listaId: novoId,
          produtoId: item.produtoId,
          nomeProduto: item.nomeProduto,
          unidade: item.unidade,
          quantidadePlanejada: item.quantidadePlanejada,
          observacao: item.observacao,
          ordem: i,
          comprado: false,
        })),
      );

      return novoId;
    });
  }

  // ------------------------------------------------------------------- itens

  async itensDaLista(listaId: number): Promise<ItemLista[]> {
    const itens = await db.itens.where('listaId').equals(listaId).toArray();
    return itens.sort((a, b) => a.ordem - b.ordem);
  }

  async adicionarItem(item: Omit<ItemLista, 'id' | 'ordem' | 'comprado'>): Promise<number> {
    const ultimos = await db.itens.where('listaId').equals(item.listaId).toArray();
    const ordem = ultimos.length ? Math.max(...ultimos.map((i) => i.ordem)) + 1 : 0;
    return db.itens.add({ ...item, ordem, comprado: false });
  }

  async atualizarItem(id: number, mudancas: Partial<ItemLista>): Promise<void> {
    await db.itens.update(id, mudancas);
  }

  async removerItem(id: number): Promise<void> {
    await db.itens.delete(id);
  }

  async registrarCompra(itemId: number, quantidade: number, precoUnitario: number): Promise<void> {
    await db.transaction('rw', db.itens, db.produtos, async () => {
      const item = await db.itens.get(itemId);
      if (!item) throw new Error('Item nao encontrado');

      await db.itens.update(itemId, {
        comprado: true,
        quantidadeComprada: quantidade,
        precoUnitario: arredondar(precoUnitario, 4),
        compradoEm: Date.now(),
      });

      // Contador alimenta a ordenacao das sugestoes de autocomplete.
      if (!item.comprado) {
        const produto = await db.produtos.get(item.produtoId);
        if (produto?.id) {
          await db.produtos.update(produto.id, {
            vezesComprado: (produto.vezesComprado ?? 0) + 1,
            atualizadoEm: Date.now(),
          });
        }
      }
    });
  }

  async desfazerCompra(itemId: number): Promise<void> {
    await db.transaction('rw', db.itens, db.produtos, async () => {
      const item = await db.itens.get(itemId);
      if (!item) return;

      await db.itens.update(itemId, {
        comprado: false,
        quantidadeComprada: undefined,
        precoUnitario: undefined,
        compradoEm: undefined,
      });

      if (item.comprado) {
        const produto = await db.produtos.get(item.produtoId);
        if (produto?.id) {
          await db.produtos.update(produto.id, {
            vezesComprado: Math.max(0, (produto.vezesComprado ?? 1) - 1),
          });
        }
      }
    });
  }

  // ----------------------------------------------------------- ciclo de vida

  async iniciarCompra(listaId: number): Promise<void> {
    await db.listas.update(listaId, { status: 'comprando', iniciadaEm: Date.now() });
  }

  async finalizar(listaId: number): Promise<void> {
    const resumo = await this.resumo(listaId);
    await db.listas.update(listaId, {
      status: 'finalizada',
      finalizadaEm: Date.now(),
      totalGasto: resumo.totalGasto,
      totalItensComprados: resumo.itensComprados,
    });
  }

  async voltarParaMontagem(listaId: number): Promise<void> {
    await db.listas.update(listaId, { status: 'montando', iniciadaEm: undefined });
  }

  async reabrir(listaId: number): Promise<void> {
    await db.listas.update(listaId, {
      status: 'comprando',
      finalizadaEm: undefined,
      totalGasto: undefined,
      totalItensComprados: undefined,
    });
  }

  // --------------------------------------------------------------- consultas

  async resumo(listaId: number): Promise<ResumoCompra> {
    const itens = await this.itensDaLista(listaId);
    const comprados = itens.filter((i) => i.comprado);
    return {
      totalGasto: arredondar(comprados.reduce((soma, i) => soma + totalDoItem(i), 0)),
      itensComprados: comprados.length,
      itensTotal: itens.length,
    };
  }

  async historicoPreco(produtoId: number): Promise<RegistroPreco[]> {
    const itens = await db.itens.where('produtoId').equals(produtoId).toArray();
    const comprados = itens.filter((i) => i.comprado && i.precoUnitario != null);
    if (!comprados.length) return [];

    const listas = await db.listas.bulkGet([...new Set(comprados.map((i) => i.listaId))]);
    const porId = new Map(listas.filter(Boolean).map((l) => [l!.id!, l!]));

    return comprados
      .map((item) => {
        const lista = porId.get(item.listaId);
        return {
          itemId: item.id!,
          listaId: item.listaId,
          listaNome: lista?.nome ?? 'Compra removida',
          local: lista?.local,
          data: item.compradoEm ?? lista?.finalizadaEm ?? 0,
          quantidade: item.quantidadeComprada ?? item.quantidadePlanejada,
          precoUnitario: item.precoUnitario!,
          total: totalDoItem(item),
          unidade: item.unidade,
        };
      })
      .sort((a, b) => b.data - a.data);
  }

  async totalPorPeriodo(desde: number, ate: number): Promise<number> {
    const listas = await db.listas.where('status').equals('finalizada').toArray();
    const total = listas
      .filter((l) => (l.finalizadaEm ?? 0) >= desde && (l.finalizadaEm ?? 0) <= ate)
      .reduce((soma, l) => soma + (l.totalGasto ?? 0), 0);
    return arredondar(total);
  }
}

function peso(status: Lista['status']): number {
  return status === 'comprando' ? 1 : 0;
}
