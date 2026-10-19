import { Component, computed, inject, signal } from '@angular/core';
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
  ToastController,
} from '@ionic/angular';
import {
  PassoMescla,
  decodificarLista,
  planejarMescla,
} from '../../core/compartilhamento/compartilhamento';
import { Lista, ListaCompartilhada, definicaoTipo } from '../../core/models/lista.model';
import { normalizarNome } from '../../core/models/produto.model';
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
  private readonly toastCtrl = inject(ToastController);

  readonly lista = signal<ListaCompartilhada | null>(null);
  readonly erro = signal('');
  readonly importando = signal(false);

  /** Lista em aberto com o mesmo nome: candidata a receber a mescla. */
  readonly homonima = signal<Lista | null>(null);
  readonly passos = signal<PassoMescla[]>([]);

  readonly novos = computed(() => this.passos().filter((p) => p.tipo === 'novo').length);
  readonly atualizados = computed(
    () => this.passos().filter((p) => p.tipo === 'atualizar').length,
  );
  /** Nomes (normalizados) que ja estao na lista local, para marcar na previa. */
  private readonly jaTenho = computed(
    () =>
      new Set(
        this.passos()
          .filter((p) => p.tipo !== 'novo')
          .map((p) => normalizarNome(p.recebido.nomeProduto)),
      ),
  );

  ionViewWillEnter(): void {
    void this.carregar(this.route.snapshot.fragment ?? '');
  }

  private async carregar(codigo: string): Promise<void> {
    this.lista.set(null);
    this.homonima.set(null);
    this.passos.set([]);
    this.erro.set('');
    try {
      const lista = await decodificarLista(codigo);
      if (!lista.itens.length) throw new Error('A lista recebida esta vazia.');
      this.lista.set(lista);
      await this.procurarHomonima(lista);
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Nao foi possivel abrir a lista.');
    }
  }

  /**
   * So listas em aberto: finalizada e historico, nao se mexe. Se houver mais
   * de uma com o mesmo nome, vale a primeira de listarAtivas() - a compra em
   * andamento, ou a mais recente.
   */
  private async procurarHomonima(recebida: ListaCompartilhada): Promise<void> {
    const chave = normalizarNome(recebida.nome);
    const ativas = await this.listaRepo.listarAtivas();
    const homonima = ativas.find((l) => normalizarNome(l.nome) === chave);
    if (!homonima) return;

    const locais = await this.listaRepo.itensDaLista(homonima.id!);
    this.homonima.set(homonima);
    this.passos.set(planejarMescla(locais, recebida.itens));
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

  async mesclar(): Promise<void> {
    const lista = this.lista();
    const destino = this.homonima();
    if (!lista || !destino || this.importando()) return;

    this.importando.set(true);
    try {
      const { novos, atualizados } = await this.listaRepo.mesclar(destino.id!, lista);
      const rota =
        destino.status === 'comprando' ? ['/listas', destino.id, 'comprar'] : ['/listas', destino.id];
      await this.router.navigate(rota, { replaceUrl: true });

      const toast = await this.toastCtrl.create({
        message: resumoMescla(novos, atualizados) || 'Sua lista ja tinha tudo.',
        duration: 3000,
      });
      await toast.present();
    } finally {
      this.importando.set(false);
    }
  }

  textoPrevia(): string {
    return resumoMescla(this.novos(), this.atualizados());
  }

  jaEstaNaLista(nome: string): boolean {
    return this.jaTenho().has(normalizarNome(nome));
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

/** "3 itens novos e 1 com quantidade maior"; vazio quando nada muda. */
function resumoMescla(novos: number, atualizados: number): string {
  const partes: string[] = [];
  if (novos) partes.push(novos === 1 ? '1 item novo' : `${novos} itens novos`);
  if (atualizados) partes.push(atualizados === 1 ? '1 item atualizado' : `${atualizados} itens atualizados`);
  return partes.join(' e ');
}
