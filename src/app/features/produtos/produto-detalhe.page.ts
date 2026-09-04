import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { arredondar } from '../../core/models/lista.model';
import { Produto } from '../../core/models/produto.model';
import { ListaRepository, RegistroPreco } from '../../core/repositories/lista.repository';
import { ProdutoRepository } from '../../core/repositories/produto.repository';

@Component({
  selector: 'app-produto-detalhe',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
  ],
  templateUrl: './produto-detalhe.page.html',
  styleUrl: './produto-detalhe.page.scss',
})
export class ProdutoDetalhePage {
  private readonly produtoRepo = inject(ProdutoRepository);
  private readonly listaRepo = inject(ListaRepository);
  private readonly route = inject(ActivatedRoute);

  readonly produto = signal<Produto | null>(null);
  readonly historico = signal<RegistroPreco[]>([]);

  readonly precoAtual = computed(() => this.historico()[0]?.precoUnitario ?? 0);

  readonly menor = computed(() => {
    const precos = this.historico().map((h) => h.precoUnitario);
    return precos.length ? Math.min(...precos) : 0;
  });

  readonly maior = computed(() => {
    const precos = this.historico().map((h) => h.precoUnitario);
    return precos.length ? Math.max(...precos) : 0;
  });

  readonly media = computed(() => {
    const precos = this.historico().map((h) => h.precoUnitario);
    if (!precos.length) return 0;
    return arredondar(precos.reduce((s, p) => s + p, 0) / precos.length);
  });

  readonly totalGasto = computed(() =>
    arredondar(this.historico().reduce((s, h) => s + h.total, 0)),
  );

  /**
   * Altura relativa de cada barra do mini-grafico.
   *
   * A escala usa a FAIXA de precos (menor -> maior), nao o zero: entre
   * R$ 24,90 e R$ 29,90 a diferenca sumiria numa escala com base zero.
   * Para que isso nao exagere a variacao, o valor de cada barra e impresso
   * em cima dela.
   */
  readonly barras = computed(() => {
    const registros = [...this.historico()].reverse();
    const min = this.menor();
    const faixa = this.maior() - min;

    return registros.map((r) => ({
      registro: r,
      altura: faixa > 0 ? 30 + ((r.precoUnitario - min) / faixa) * 70 : 70,
      ehMenor: r.precoUnitario === this.menor(),
      ehMaior: r.precoUnitario === this.maior() && faixa > 0,
    }));
  });

  async ngOnInit(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const [produto, historico] = await Promise.all([
      this.produtoRepo.obterPorId(id),
      this.listaRepo.historicoPreco(id),
    ]);
    this.produto.set(produto ?? null);
    this.historico.set(historico);
  }

  /** Diferenca do preco atual em relacao ao menor ja pago. */
  readonly acimaDoMenor = computed(() => {
    const menor = this.menor();
    if (!menor || !this.precoAtual()) return 0;
    return ((this.precoAtual() - menor) / menor) * 100;
  });

  formatarQtd(valor: number): string {
    return Number.isInteger(valor)
      ? String(valor)
      : valor.toFixed(3).replace(/0+$/, '').replace('.', ',');
  }
}
