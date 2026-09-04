import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { Lista, definicaoTipo } from '../../core/models/lista.model';
import { recarregarAoVoltarDeFora } from '../../core/navegacao/recarregar-ao-voltar';
import { ListaRepository, ResumoCompra } from '../../core/repositories/lista.repository';
import { NovaListaModal } from './nova-lista.modal';

interface ListaComResumo {
  lista: Lista;
  resumo: ResumoCompra;
}

@Component({
  selector: 'app-compras',
  imports: [
    CurrencyPipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    IonBadge,
    IonFab,
    IonFabButton,
    IonCard,
    IonCardContent,
    IonProgressBar,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
    IonRefresher,
    IonRefresherContent,
  ],
  templateUrl: './compras.page.html',
  styleUrl: './compras.page.scss',
})
export class ComprasPage {
  private readonly listaRepo = inject(ListaRepository);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly router = inject(Router);

  readonly itens = signal<ListaComResumo[]>([]);
  readonly carregando = signal(true);

  constructor() {
    // Cobre a volta de /listas/:id e /listas/:id/comprar, que ficam fora
    // das abas e por isso nao acionam o ionViewWillEnter daqui.
    recarregarAoVoltarDeFora('/tabs/compras', () => void this.carregar());
  }

  /** Hook do Ionic: dispara toda vez que a aba volta a ficar visivel. */
  ionViewWillEnter(): void {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    const listas = await this.listaRepo.listarAtivas();
    const comResumo = await Promise.all(
      listas.map(async (lista) => ({
        lista,
        resumo: await this.listaRepo.resumo(lista.id!),
      })),
    );
    this.itens.set(comResumo);
    this.carregando.set(false);
  }

  async atualizar(ev: CustomEvent): Promise<void> {
    await this.carregar();
    (ev.target as HTMLIonRefresherElement).complete();
  }

  async novaLista(): Promise<void> {
    const modal = await this.modalCtrl.create({ component: NovaListaModal });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    if (role !== 'confirm' || !data) return;

    const id = await this.listaRepo.criar(data);
    await this.router.navigate(['/listas', id]);
  }

  abrir(item: ListaComResumo): void {
    const destino =
      item.lista.status === 'comprando'
        ? ['/listas', item.lista.id, 'comprar']
        : ['/listas', item.lista.id];
    void this.router.navigate(destino);
  }

  async remover(item: ListaComResumo, sliding: IonItemSliding): Promise<void> {
    await sliding.close();
    await this.listaRepo.remover(item.lista.id!);
    await this.carregar();

    const toast = await this.toastCtrl.create({
      message: `"${item.lista.nome}" removida.`,
      duration: 2500,
      position: 'bottom',
    });
    await toast.present();
  }

  // --- helpers de template ---

  icone(lista: Lista): string {
    return definicaoTipo(lista.tipo).icone;
  }

  cor(lista: Lista): string {
    return definicaoTipo(lista.tipo).cor;
  }

  rotuloTipo(lista: Lista): string {
    return definicaoTipo(lista.tipo).rotulo;
  }

  progresso(resumo: ResumoCompra): number {
    return resumo.itensTotal ? resumo.itensComprados / resumo.itensTotal : 0;
  }

  /** Fracao do orcamento ja consumida, limitada a 1 para a barra nao estourar. */
  usoOrcamento(item: ListaComResumo): number {
    const orcamento = item.lista.orcamento ?? 0;
    if (!orcamento) return 0;
    return Math.min(1, item.resumo.totalGasto / orcamento);
  }

  estourouOrcamento(item: ListaComResumo): boolean {
    const orcamento = item.lista.orcamento ?? 0;
    return orcamento > 0 && item.resumo.totalGasto > orcamento;
  }
}
