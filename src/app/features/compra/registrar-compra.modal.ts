import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { MoedaDirective } from '../../core/formulario/moeda.directive';
import { ItemLista, arredondar, totalDoItem } from '../../core/models/lista.model';
import { RegistroPreco } from '../../core/repositories/lista.repository';

export interface DadosCompraItem {
  quantidade: number;
  precoUnitario: number;
}

/** Como o preco foi informado. Muda apenas a conta, nao o que e gravado. */
type ModoPreco = 'unitario' | 'total';

@Component({
  selector: 'app-registrar-compra-modal',
  imports: [
    FormsModule,
    CurrencyPipe,
    DecimalPipe,
    MoedaDirective,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonFooter,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonNote,
    IonIcon,
    IonSegment,
    IonSegmentButton,
  ],
  templateUrl: './registrar-compra.modal.html',
  styleUrl: './registrar-compra.modal.scss',
})
export class RegistrarCompraModal {
  private readonly modalCtrl = inject(ModalController);

  /** Injetados via componentProps. */
  item!: ItemLista;
  ultimoPreco?: RegistroPreco;

  readonly modo = signal<ModoPreco>('unitario');
  readonly quantidade = signal('1');

  /** Valor em reais, com a mascara de moeda cuidando do que e digitado. */
  readonly valor = signal(0);

  private num(texto: string): number {
    const n = Number(texto.toString().replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  readonly qtdNum = computed(() => this.num(this.quantidade()));
  readonly valorNum = computed(() => this.valor());

  /** Preco por unidade, seja qual for o modo de digitacao. */
  readonly precoUnitario = computed(() => {
    const qtd = this.qtdNum();
    const valor = this.valorNum();
    if (!qtd || !valor) return 0;
    return this.modo() === 'unitario' ? valor : arredondar(valor / qtd, 4);
  });

  readonly total = computed(() => arredondar(this.qtdNum() * this.precoUnitario()));
  readonly valido = computed(() => this.qtdNum() > 0 && this.valorNum() > 0);

  /**
   * Comparacao com a ultima vez que este produto foi comprado.
   * E o que transforma o app em ferramenta de decisao dentro do mercado.
   */
  readonly variacao = computed(() => {
    const anterior = this.ultimoPreco?.precoUnitario;
    const atual = this.precoUnitario();
    if (!anterior || !atual) return null;

    const diferenca = atual - anterior;
    const percentual = (diferenca / anterior) * 100;
    if (Math.abs(percentual) < 1) return { tipo: 'igual' as const, percentual: 0, anterior };

    return {
      tipo: diferenca > 0 ? ('subiu' as const) : ('caiu' as const),
      percentual: Math.abs(percentual),
      anterior,
    };
  });

  ngOnInit(): void {
    this.quantidade.set(String(this.item.quantidadeComprada ?? this.item.quantidadePlanejada));

    if (this.item.precoUnitario != null) {
      // Reabrindo um item ja registrado. Preco de balanca costuma ter mais
      // de duas casas (R$ 3,3333 por kg) e nao cabe numa mascara de reais:
      // nesse caso reabre pelo total pago, que e um valor exato em moeda.
      const unitario = this.item.precoUnitario;
      if (arredondar(unitario) !== unitario) {
        this.modo.set('total');
        this.valor.set(arredondar(totalDoItem(this.item)));
      } else {
        this.valor.set(unitario);
      }
    } else if (this.ultimoPreco) {
      // Sugere o ultimo preco pago. Na maioria das vezes so precisa confirmar.
      this.valor.set(arredondar(this.ultimoPreco.precoUnitario));
    }
  }

  trocarModo(valor: ModoPreco): void {
    if (!valor || valor === this.modo()) return;

    // Converte o numero digitado para nao perder o que ja foi informado.
    const qtd = this.qtdNum();
    const atual = this.valorNum();
    if (qtd && atual) {
      this.valor.set(arredondar(valor === 'total' ? atual * qtd : atual / qtd));
    }

    this.modo.set(valor);
  }

  cancelar(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirmar(): void {
    if (!this.valido()) return;
    const dados: DadosCompraItem = {
      quantidade: this.qtdNum(),
      precoUnitario: this.precoUnitario(),
    };
    this.modalCtrl.dismiss(dados, 'confirm');
  }
}
