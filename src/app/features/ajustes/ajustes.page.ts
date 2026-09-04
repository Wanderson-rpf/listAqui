import { Component, inject, signal } from '@angular/core';
import {
  AlertController,
  IonButton,
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
  LoadingController,
  ToastController,
} from '@ionic/angular';
import { db } from '../../core/db/app-db';
import { ExportService } from '../../core/services/export.service';

@Component({
  selector: 'app-ajustes',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    IonButton,
  ],
  templateUrl: './ajustes.page.html',
  styleUrl: './ajustes.page.scss',
})
export class AjustesPage {
  private readonly exportService = inject(ExportService);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly loadingCtrl = inject(LoadingController);

  readonly totalProdutos = signal(0);
  readonly totalCompras = signal(0);
  readonly totalItens = signal(0);

  ionViewWillEnter(): void {
    void this.contar();
  }

  async contar(): Promise<void> {
    const [produtos, listas, itens] = await Promise.all([
      db.produtos.count(),
      db.listas.where('status').equals('finalizada').count(),
      db.itens.filter((i) => i.comprado).count(),
    ]);
    this.totalProdutos.set(produtos);
    this.totalCompras.set(listas);
    this.totalItens.set(itens);
  }

  // ---------------------------------------------------------------- CSV

  async exportarItens(): Promise<void> {
    if (!(await this.exigeDados())) return;
    const csv = await this.exportService.csvItens();
    this.exportService.baixar(
      `compras-itens-${this.exportService.carimboArquivo()}.csv`,
      csv,
      'text/csv',
    );
    await this.avisar('CSV de itens gerado.');
  }

  async exportarCompras(): Promise<void> {
    if (!(await this.exigeDados())) return;
    const csv = await this.exportService.csvCompras();
    this.exportService.baixar(
      `compras-resumo-${this.exportService.carimboArquivo()}.csv`,
      csv,
      'text/csv',
    );
    await this.avisar('CSV de compras gerado.');
  }

  // ------------------------------------------------------------- backup

  async exportarBackup(): Promise<void> {
    const backup = await this.exportService.gerarBackup();
    this.exportService.baixar(
      `listaqui-backup-${this.exportService.carimboArquivo()}.json`,
      JSON.stringify(backup, null, 2),
      'application/json',
    );
    await this.avisar('Backup salvo. Guarde em outro lugar.');
  }

  /**
   * Abre o seletor de arquivo do sistema.
   * Um input escondido evita depender de plugin nativo neste estagio.
   */
  importarBackup(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = async () => {
      const arquivo = input.files?.[0];
      if (!arquivo) return;
      await this.confirmarRestauracao(arquivo);
    };

    input.click();
  }

  private async confirmarRestauracao(arquivo: File): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Restaurar backup',
      message:
        'Isso apaga tudo que esta no app hoje e coloca no lugar o conteudo do arquivo. ' +
        'Nao da para desfazer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Restaurar',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: 'Restaurando...' });
            await loading.present();
            try {
              const texto = await arquivo.text();
              const resultado = await this.exportService.restaurarBackup(texto);
              await this.contar();
              await this.avisar(
                `Restaurado: ${resultado.listas} compras e ${resultado.produtos} produtos.`,
              );
            } catch (erro) {
              await this.avisar(
                erro instanceof Error ? erro.message : 'Nao consegui ler o arquivo.',
                'danger',
              );
            } finally {
              await loading.dismiss();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async apagarTudo(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Apagar todos os dados',
      message:
        'Todas as listas, produtos e o historico de precos serao apagados deste aparelho. ' +
        'Exporte um backup antes se quiser guardar.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Apagar tudo',
          role: 'destructive',
          handler: async () => {
            await this.exportService.limparTudo();
            await this.contar();
            await this.avisar('Dados apagados.');
          },
        },
      ],
    });
    await alert.present();
  }

  // -------------------------------------------------------------- utils

  private async exigeDados(): Promise<boolean> {
    if (this.totalCompras() > 0) return true;
    await this.avisar('Finalize ao menos uma compra para ter o que exportar.', 'warning');
    return false;
  }

  private async avisar(mensagem: string, cor = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: mensagem,
      duration: 2800,
      color: cor,
      position: 'bottom',
    });
    await toast.present();
  }
}
