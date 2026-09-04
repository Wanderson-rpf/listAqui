import { Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';

/**
 * Shell de navegacao.
 *
 * Atencao: a partir do Ionic 8 o proprio <ion-tabs> ja renderiza um
 * <ion-router-outlet> interno. Declarar outro aqui cria um segundo outlet
 * que se sobrepoe a tela inteira e engole todos os cliques.
 */
@Component({
  selector: 'app-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="compras" href="/tabs/compras">
          <ion-icon name="basket-outline" />
          <ion-label>Compras</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="historico" href="/tabs/historico">
          <ion-icon name="time-outline" />
          <ion-label>Historico</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="produtos" href="/tabs/produtos">
          <ion-icon name="pricetags-outline" />
          <ion-label>Precos</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="ajustes" href="/tabs/ajustes">
          <ion-icon name="settings-outline" />
          <ion-label>Ajustes</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {}
