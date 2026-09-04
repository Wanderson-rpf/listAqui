import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { Produto, normalizarNome } from '../../core/models/produto.model';
import { recarregarAoVoltarDeFora } from '../../core/navegacao/recarregar-ao-voltar';
import { ListaRepository } from '../../core/repositories/lista.repository';
import { ProdutoRepository } from '../../core/repositories/produto.repository';

interface ProdutoComPreco {
  produto: Produto;
  ultimoPreco?: number;
  precoAnterior?: number;
  vezes: number;
  ultimaData?: number;
}

@Component({
  selector: 'app-produtos',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
  ],
  templateUrl: './produtos.page.html',
  styleUrl: './produtos.page.scss',
})
export class ProdutosPage {
  private readonly produtoRepo = inject(ProdutoRepository);
  private readonly listaRepo = inject(ListaRepository);
  private readonly router = inject(Router);

  readonly todos = signal<ProdutoComPreco[]>([]);
  readonly busca = signal('');
  readonly carregando = signal(true);

  readonly filtrados = computed(() => {
    const termo = normalizarNome(this.busca());
    const lista = termo
      ? this.todos().filter((p) => p.produto.chaveBusca.includes(termo))
      : this.todos();

    // Comprados com mais frequencia primeiro: e o que voce quer consultar.
    return [...lista].sort(
      (a, b) => b.vezes - a.vezes || a.produto.chaveBusca.localeCompare(b.produto.chaveBusca, 'pt-BR'),
    );
  });

  constructor() {
    // Volta de /produtos/:id, que fica fora das abas.
    recarregarAoVoltarDeFora('/tabs/produtos', () => void this.carregar());
  }

  ionViewWillEnter(): void {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    const produtos = await this.produtoRepo.listarTodos();

    const comPreco = await Promise.all(
      produtos.map(async (produto) => {
        const historico = await this.listaRepo.historicoPreco(produto.id!);
        return {
          produto,
          ultimoPreco: historico[0]?.precoUnitario,
          precoAnterior: historico[1]?.precoUnitario,
          ultimaData: historico[0]?.data,
          vezes: historico.length,
        };
      }),
    );

    // Produto sem nenhuma compra registrada nao tem o que mostrar aqui.
    this.todos.set(comPreco.filter((p) => p.vezes > 0));
    this.carregando.set(false);
  }

  abrir(item: ProdutoComPreco): void {
    void this.router.navigate(['/produtos', item.produto.id]);
  }

  /** Percentual de variacao entre as duas ultimas compras. */
  variacao(item: ProdutoComPreco): number | null {
    if (item.ultimoPreco == null || item.precoAnterior == null || !item.precoAnterior) return null;
    const p = ((item.ultimoPreco - item.precoAnterior) / item.precoAnterior) * 100;
    return Math.abs(p) < 1 ? null : p;
  }
}
