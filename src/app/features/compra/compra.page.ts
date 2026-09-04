import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
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
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { enviarNoEnter } from '../../core/formulario/enviar-no-enter';
import { ItemLista, Lista, arredondar, totalDoItem } from '../../core/models/lista.model';
import { ListaRepository } from '../../core/repositories/lista.repository';
import { ProdutoRepository } from '../../core/repositories/produto.repository';
import { DadosCompraItem, RegistrarCompraModal } from './registrar-compra.modal';

@Component({
  selector: 'app-compra',
  imports: [
    CurrencyPipe,
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
    IonFooter,
    IonProgressBar,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
  ],
  templateUrl: './compra.page.html',
  styleUrl: './compra.page.scss',
})
export class CompraPage {
  private readonly listaRepo = inject(ListaRepository);
  private readonly produtoRepo = inject(ProdutoRepository);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly lista = signal<Lista | null>(null);
  readonly itens = signal<ItemLista[]>([]);

  private listaId!: number;

  readonly pendentes = computed(() => this.itens().filter((i) => !i.comprado));
  readonly comprados = computed(() => this.itens().filter((i) => i.comprado));

  readonly total = computed(() =>
    arredondar(this.comprados().reduce((soma, i) => soma + totalDoItem(i), 0)),
  );

  readonly progresso = computed(() => {
    const total = this.itens().length;
    return total ? this.comprados().length / total : 0;
  });

  readonly orcamento = computed(() => this.lista()?.orcamento ?? 0);

  readonly usoOrcamento = computed(() => {
    const orc = this.orcamento();
    return orc ? Math.min(1, this.total() / orc) : 0;
  });

  readonly restante = computed(() => arredondar(this.orcamento() - this.total()));
  readonly estourou = computed(() => this.orcamento() > 0 && this.total() > this.orcamento());

  ionViewWillEnter(): void {
    this.listaId = Number(this.route.snapshot.paramMap.get('id'));
    void this.carregar();
  }

  async carregar(): Promise<void> {
    const [lista, itens] = await Promise.all([
      this.listaRepo.obter(this.listaId),
      this.listaRepo.itensDaLista(this.listaId),
    ]);
    this.lista.set(lista ?? null);
    this.itens.set(itens);
  }

  // ------------------------------------------------------ riscar da lista

  /**
   * O ato de riscar E o registro da compra: abre o modal pedindo
   * quantidade e preco, e so entao marca o item.
   */
  async riscar(item: ItemLista): Promise<void> {
    const historico = await this.listaRepo.historicoPreco(item.produtoId);
    // Ignora ocorrencias desta mesma compra ao sugerir o "ultimo preco".
    const ultimoPreco = historico.find((h) => h.listaId !== this.listaId);

    const modal = await this.modalCtrl.create({
      component: RegistrarCompraModal,
      componentProps: { item, ultimoPreco },
      breakpoints: [0, 0.9],
      initialBreakpoint: 0.9,
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss<DadosCompraItem>();
    if (role !== 'confirm' || !data) return;

    await this.listaRepo.registrarCompra(item.id!, data.quantidade, data.precoUnitario);
    await this.carregar();
    await this.avisarSeEstourou();
  }

  async desfazer(item: ItemLista, sliding?: IonItemSliding): Promise<void> {
    await sliding?.close();
    await this.listaRepo.desfazerCompra(item.id!);
    await this.carregar();
  }

  private async avisarSeEstourou(): Promise<void> {
    if (!this.estourou()) return;
    const toast = await this.toastCtrl.create({
      message: `Passou do orcamento em ${formatarReais(Math.abs(this.restante()))}.`,
      duration: 3000,
      color: 'warning',
      position: 'top',
    });
    await toast.present();
  }

  // ------------------------------------------------- item fora da lista

  async adicionarNaHora(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Item fora da lista',
      message: 'Algo que voce pegou sem ter planejado.',
      inputs: [{ name: 'nome', placeholder: 'Nome do produto' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Adicionar',
          handler: async (dados: { nome: string }) => {
            const nome = dados.nome?.trim();
            // false mantem o alerta aberto: fechar sem nome perderia o que
            // o usuario ja tinha digitado.
            if (!nome) return false;
            await this.criarItemExtra(nome);
            return true;
          },
        },
      ],
    });
    await alert.present();

    // Enter no unico campo confirma - ver core/formulario.
    enviarNoEnter(alert, async ([nome]) => {
      if (!nome.trim()) return;
      await alert.dismiss();
      await this.criarItemExtra(nome.trim());
    });
  }

  /** Cria o produto, joga na lista e ja abre o registro de preco. */
  private async criarItemExtra(nome: string): Promise<void> {
    const produto = await this.produtoRepo.obterOuCriar(nome, 'un');
    const itemId = await this.listaRepo.adicionarItem({
      listaId: this.listaId,
      produtoId: produto.id!,
      nomeProduto: produto.nome,
      unidade: produto.unidadePadrao,
      quantidadePlanejada: 1,
      foraDaLista: true,
    });

    await this.carregar();
    const novo = this.itens().find((i) => i.id === itemId);
    if (novo) await this.riscar(novo);
  }

  // ------------------------------------------------------------ finalizar

  async finalizar(): Promise<void> {
    const faltando = this.pendentes().length;

    const alert = await this.alertCtrl.create({
      header: 'Finalizar compra',
      message: faltando
        ? `${faltando} ${faltando === 1 ? 'item continua' : 'itens continuam'} sem ser marcado. ` +
          `Finalizar mesmo assim? O total de ${formatarReais(this.total())} vai para o historico.`
        : `Tudo marcado. Total de ${formatarReais(this.total())}.`,
      buttons: [
        { text: 'Voltar', role: 'cancel' },
        {
          text: 'Finalizar',
          handler: async () => {
            await this.listaRepo.finalizar(this.listaId);
            await this.router.navigate(['/tabs/historico'], { replaceUrl: true });
          },
        },
      ],
    });
    await alert.present();
  }

  // -------------------------------------------------------------- helpers

  totalItem(item: ItemLista): number {
    return totalDoItem(item);
  }

  formatarQtd(valor: number): string {
    return Number.isInteger(valor)
      ? String(valor)
      : valor.toFixed(3).replace(/0+$/, '').replace('.', ',');
  }
}

function formatarReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
