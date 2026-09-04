import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { UNIDADES, UnidadeMedida } from '../../core/models/produto.model';
import { ItemLista } from '../../core/models/lista.model';

export interface DadosItemEditado {
  nomeProduto: string;
  quantidadePlanejada: number;
  unidade: UnidadeMedida;
  observacao?: string;
}

@Component({
  selector: 'app-item-form-modal',
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Editar item</ion-title>
        <ion-buttons slot="start">
          <ion-button (click)="cancelar()">Cancelar</ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button strong (click)="salvar()" [disabled]="!nome().trim()">Salvar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-list inset>
        <ion-item>
          <ion-input
            label="Produto"
            labelPlacement="stacked"
            enterkeyhint="next"
            [value]="nome()"
            (ionInput)="nome.set($any($event.target).value)"
            (keyup.enter)="campoQuantidade.setFocus()"
          />
        </ion-item>

        <ion-item>
          <!-- Ultimo campo de digitacao livre: o Enter salva. Unidade e
               observacao logo abaixo nao se beneficiam da tecla. -->
          <ion-input
            #campoQuantidade
            label="Quantidade"
            labelPlacement="stacked"
            type="number"
            inputmode="decimal"
            enterkeyhint="done"
            [value]="quantidade()"
            (ionInput)="quantidade.set($any($event.target).value)"
            (keyup.enter)="salvar()"
          />
        </ion-item>

        <ion-item>
          <ion-select
            label="Unidade"
            labelPlacement="stacked"
            interface="popover"
            [value]="unidade()"
            (ionChange)="unidade.set($any($event.detail.value))"
          >
            @for (u of unidades; track u.sigla) {
              <ion-select-option [value]="u.sigla">
                {{ u.sigla }} &middot; {{ u.rotulo }}
              </ion-select-option>
            }
          </ion-select>
        </ion-item>

        <ion-item>
          <ion-textarea
            label="Observacao"
            labelPlacement="stacked"
            placeholder="Marca preferida, tamanho, sabor..."
            [autoGrow]="true"
            rows="1"
            [value]="observacao()"
            (ionInput)="observacao.set($any($event.target).value)"
          />
        </ion-item>
      </ion-list>
    </ion-content>
  `,
})
export class ItemFormModal {
  private readonly modalCtrl = inject(ModalController);

  /** Preenchido pelo ModalController via componentProps. */
  item?: ItemLista;

  readonly unidades = UNIDADES;
  readonly nome = signal('');
  readonly quantidade = signal('1');
  readonly unidade = signal<UnidadeMedida>('un');
  readonly observacao = signal('');

  ngOnInit(): void {
    if (!this.item) return;
    this.nome.set(this.item.nomeProduto);
    this.quantidade.set(String(this.item.quantidadePlanejada));
    this.unidade.set(this.item.unidade);
    this.observacao.set(this.item.observacao ?? '');
  }

  cancelar(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  salvar(): void {
    const nome = this.nome().trim();
    if (!nome) return;

    const qtd = Number(this.quantidade().toString().replace(',', '.'));

    const dados: DadosItemEditado = {
      nomeProduto: nome,
      quantidadePlanejada: Number.isFinite(qtd) && qtd > 0 ? qtd : 1,
      unidade: this.unidade(),
      observacao: this.observacao().trim() || undefined,
    };

    this.modalCtrl.dismiss(dados, 'confirm');
  }
}
