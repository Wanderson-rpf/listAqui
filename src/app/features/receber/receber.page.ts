import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { decodificarLista } from '../../core/compartilhamento/compartilhamento';
import { ListaCompartilhada, definicaoTipo } from '../../core/models/lista.model';
import { ListaRepository } from '../../core/repositories/lista.repository';

/**
 * Destino do link de lista enviada por outra pessoa.
 * Nada e gravado so por abrir o link: a pessoa ve a previa e confirma.
 */
@Component({
  selector: 'app-receber',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonNote,
    IonIcon,
    IonChip,
    IonFooter,
  ],
  templateUrl: './receber.page.html',
  styleUrl: './receber.page.scss',
})
export class ReceberPage {
  private readonly listaRepo = inject(ListaRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly lista = signal<ListaCompartilhada | null>(null);
  readonly erro = signal('');
  readonly importando = signal(false);

  ionViewWillEnter(): void {
    void this.carregar(this.route.snapshot.fragment ?? '');
  }

  private async carregar(codigo: string): Promise<void> {
    this.lista.set(null);
    this.erro.set('');
    try {
      const lista = await decodificarLista(codigo);
      if (!lista.itens.length) throw new Error('A lista recebida esta vazia.');
      this.lista.set(lista);
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Nao foi possivel abrir a lista.');
    }
  }

  async importar(): Promise<void> {
    const lista = this.lista();
    if (!lista || this.importando()) return;

    this.importando.set(true);
    try {
      const id = await this.listaRepo.importar(lista);
      // replaceUrl: voltar da lista nao deve cair de novo aqui e importar duas vezes.
      await this.router.navigate(['/listas', id], { replaceUrl: true });
    } finally {
      this.importando.set(false);
    }
  }

  voltar(): void {
    void this.router.navigate(['/tabs/compras'], { replaceUrl: true });
  }

  rotuloTipo(lista: ListaCompartilhada): string {
    return definicaoTipo(lista.tipo).rotulo;
  }

  /** Mostra "2" em vez de "2,000" mas preserva "0,75". */
  formatarQtd(valor: number): string {
    return Number.isInteger(valor) ? String(valor) : valor.toFixed(3).replace(/0+$/, '').replace('.', ',');
  }
}
