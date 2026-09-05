import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  addOutline,
  alertCircleOutline,
  arrowUndoOutline,
  bagHandleOutline,
  basketOutline,
  calendarOutline,
  cartOutline,
  cashOutline,
  checkmarkCircle,
  checkmarkDoneOutline,
  checkmarkOutline,
  chevronForwardOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  closeOutline,
  copyOutline,
  createOutline,
  documentTextOutline,
  ellipsisVertical,
  leafOutline,
  locationOutline,
  medkitOutline,
  pricetagOutline,
  pricetagsOutline,
  refreshOutline,
  removeOutline,
  searchOutline,
  settingsOutline,
  statsChartOutline,
  storefrontOutline,
  timeOutline,
  trashOutline,
  trendingDownOutline,
  trendingUpOutline,
  walletOutline,
  warningOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet />
    </ion-app>
  `,
})
export class App {
  constructor() {
    // Ionic standalone nao carrega o pacote inteiro de icones:
    // cada icone usado no app precisa ser registrado uma vez.
    addIcons({
      addCircleOutline,
      addOutline,
      alertCircleOutline,
      arrowUndoOutline,
      bagHandleOutline,
      basketOutline,
      calendarOutline,
      cartOutline,
      cashOutline,
      checkmarkCircle,
      checkmarkDoneOutline,
      checkmarkOutline,
      chevronForwardOutline,
      cloudDownloadOutline,
      cloudUploadOutline,
      closeOutline,
      copyOutline,
      createOutline,
      documentTextOutline,
      ellipsisVertical,
      leafOutline,
      locationOutline,
      medkitOutline,
      pricetagOutline,
      pricetagsOutline,
      refreshOutline,
      removeOutline,
      searchOutline,
      settingsOutline,
      statsChartOutline,
      storefrontOutline,
      timeOutline,
      trashOutline,
      trendingDownOutline,
      trendingUpOutline,
      walletOutline,
      warningOutline,
    });
  }
}
