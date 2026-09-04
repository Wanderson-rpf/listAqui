import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonButtons,
  IonContent,
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
import { TIPOS_LISTA, TipoLista } from '../../core/models/lista.model';

/** Nome padrao sugerido: "Mercado - 02/09". Evita lista sem nome. */
function nomeSugerido(tipo: TipoLista): string {
  const rotulo = TIPOS_LISTA.find((t) => t.valor === tipo)?.rotulo ?? 'Compra';
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${rotulo} ${p(d.getDate())}/${p(d.getMonth() + 1)}`;
}

@Component({
  selector: 'app-nova-lista-modal',
  imports: [
    FormsModule,
    MoedaDirective,
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
    IonNote,
    IonSegment,
    IonSegmentButton,
    IonIcon,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Tipo de compra</ion-title>
        <ion-buttons slot="start">
          <ion-button color="medium" (click)="cancelar()">Cancelar</ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button strong (click)="salvar()" [disabled]="!nome().trim()">Criar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-segment [value]="tipo()" (ionChange)="trocarTipo($any($event.detail.value))">
        @for (t of tipos; track t.valor) {
          <ion-segment-button [value]="t.valor">
            <ion-icon [name]="t.icone" />
            <ion-label>{{ t.rotulo }}</ion-label>
          </ion-segment-button>
        }
      </ion-segment>

      <ion-list inset>
        <ion-item>
          <ion-input
            label="Nome"
            labelPlacement="stacked"
            placeholder="Compra do mes"
            enterkeyhint="next"
            [value]="nome()"
            (ionInput)="editarNome($any($event.target).value)"
            (keyup.enter)="focar(campoOnde)"
          />
        </ion-item>

        <ion-item>
          <ion-input
            #campoOnde
            label="Onde"
            labelPlacement="stacked"
            placeholder="Carrefour, feira do bairro..."
            enterkeyhint="next"
            [value]="local()"
            (ionInput)="local.set($any($event.target).value)"
            (keyup.enter)="focar(campoOrcamento)"
          />
        </ion-item>

        <ion-item>
          <ion-input
            #campoOrcamento
            label="Orcamento (opcional)"
            labelPlacement="stacked"
            enterkeyhint="done"
            [(moeda)]="orcamento"
            (keyup.enter)="salvar()"
          />
        </ion-item>
      </ion-list>

      <ion-note class="dica">
        O orcamento so serve de referencia: o app avisa quando o total passar dele, mas nao
        impede nada.
      </ion-note>
    </ion-content>
  `,
  styles: [
    `
      /**
       * Botao de toolbar nao e alvo de toque de corredor de mercado: aqui o
       * min-height: 42px global (com o caixa-alta do modo md) deixava dois
       * blocos pesados nos cantos, competindo com o titulo.
       */
      ion-toolbar ion-button {
        --padding-start: 8px;
        --padding-end: 8px;
        min-height: 36px;
        height: 36px;
        font-size: 0.9rem;
        font-weight: 500;
        text-transform: none;
        letter-spacing: 0;
      }
      ion-toolbar ion-button[strong] {
        font-weight: 600;
      }
      /**
       * Os quatro tipos cabem na largura de um celular, entao o segmento nao
       * rola: min-width zerado (o md reserva 90px por botao) e rotulo em
       * caixa baixa, que ocupa bem menos que o caixa-alta padrao.
       */
      ion-segment-button {
        min-width: 0;
        --padding-start: 2px;
        --padding-end: 2px;

        ion-icon {
          font-size: 18px;
        }

        ion-label {
          margin-top: 2px;
          font-size: 0.72rem;
          text-transform: none;
          letter-spacing: 0;
        }
      }
      .dica {
        display: block;
        padding: 0 16px;
        font-size: 0.8rem;
        line-height: 1.4;
      }
      ion-list[inset] {
        margin-top: 16px;
      }
    `,
  ],
})
export class NovaListaModal {
  private readonly modalCtrl = inject(ModalController);

  readonly tipos = TIPOS_LISTA;
  readonly tipo = signal<TipoLista>('mercado');
  readonly nome = signal(nomeSugerido('mercado'));
  readonly local = signal('');
  /** Em reais; a mascara de moeda cuida do que e digitado. */
  readonly orcamento = signal(0);

  /** Se o usuario ainda nao personalizou o nome, ele acompanha o tipo escolhido. */
  private nomeTocado = false;

  editarNome(valor: string): void {
    this.nomeTocado = true;
    this.nome.set(valor);
  }

  /**
   * Enter avanca para o proximo campo e, no ultimo, cria a compra: no
   * celular o botao "Criar" fica no topo da tela, fora do alcance do polegar.
   */
  focar(campo: IonInput): void {
    void campo.setFocus();
  }

  trocarTipo(valor: TipoLista): void {
    if (!valor) return;
    this.tipo.set(valor);
    if (!this.nomeTocado) this.nome.set(nomeSugerido(valor));
  }

  cancelar(): void {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  salvar(): void {
    const nome = this.nome().trim();
    if (!nome) return;

    this.modalCtrl.dismiss(
      {
        nome,
        tipo: this.tipo(),
        local: this.local().trim() || undefined,
        orcamento: this.orcamento() > 0 ? this.orcamento() : undefined,
      },
      'confirm',
    );
  }
}
