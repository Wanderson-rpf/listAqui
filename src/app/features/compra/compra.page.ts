import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ActionSheetController,
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
import { DadosItemEditado, ItemFormModal } from '../lista/item-form.modal';
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
  private readonly actionSheetCtrl = inject(ActionSheetController);
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

  // ----------------------------------------------- adicionar durante a compra

  /**
   * Duas coisas diferentes acontecem no corredor: lembrar de algo que ainda
   * precisa pegar, e jogar no carrinho algo que nem estava na lista. Antes
   * so a segunda existia, entao lembrar de um item obrigava a "comprar" ele
   * na hora - ou anotar em outro lugar.
   */
  async adicionarItem(): Promise<void> {
    const escolha = await this.actionSheetCtrl.create({
      header: 'Adicionar item',
      buttons: [
        { text: 'Ja peguei (registrar preco)', icon: 'cart-outline', role: 'agora' },
        { text: 'Ainda vou pegar', icon: 'ellipse-outline', role: 'depois' },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await escolha.present();

    const { role } = await escolha.onWillDismiss();
    if (role !== 'agora' && role !== 'depois') return;

    await this.perguntarNome(role === 'agora');
  }

  private async perguntarNome(riscarEmSeguida: boolean): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: riscarEmSeguida ? 'Item fora da lista' : 'Novo item',
      message: riscarEmSeguida
        ? 'Algo que voce pegou sem ter planejado.'
        : 'Entra na lista de pendentes, para voce riscar quando pegar.',
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
            await this.criarItem(nome, riscarEmSeguida);
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
      await this.criarItem(nome.trim(), riscarEmSeguida);
    });
  }

  /**
   * Cria o produto e joga na lista. Nos dois casos o item nasce marcado
   * como fora da lista: entrou depois que a compra ja tinha comecado, e e
   * isso que a coluna "Fora da lista" do CSV precisa registrar.
   */
  private async criarItem(nome: string, riscarEmSeguida: boolean): Promise<void> {
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
    if (!riscarEmSeguida) return;

    const novo = this.itens().find((i) => i.id === itemId);
    if (novo) await this.riscar(novo);
  }

  // -------------------------------------------------- editar item pendente

  /** Mesmo modal da tela de montagem: nome, quantidade, unidade, observacao. */
  async editar(item: ItemLista, sliding?: IonItemSliding): Promise<void> {
    await sliding?.close();

    const modal = await this.modalCtrl.create({
      component: ItemFormModal,
      componentProps: { item },
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss<DadosItemEditado>();
    if (role !== 'confirm' || !data) return;

    // Trocar o nome significa apontar para outro produto no catalogo.
    const produto = await this.produtoRepo.obterOuCriar(data.nomeProduto, data.unidade);

    await this.listaRepo.atualizarItem(item.id!, {
      produtoId: produto.id!,
      nomeProduto: data.nomeProduto,
      quantidadePlanejada: data.quantidadePlanejada,
      unidade: data.unidade,
      observacao: data.observacao,
    });
    await this.carregar();
  }

  async remover(item: ItemLista, sliding: IonItemSliding): Promise<void> {
    await sliding.close();
    await this.listaRepo.removerItem(item.id!);
    await this.carregar();
  }

  // ------------------------------------------------------ sair da compra

  /**
   * Saida para quem comecou a compra sem querer. Finalizar era a unica
   * porta, e ela grava a compra no historico - inclusive uma de R$ 0,00.
   */
  async voltarParaMontagem(): Promise<void> {
    const registrados = this.comprados().length;

    const alert = await this.alertCtrl.create({
      header: 'Voltar para montagem',
      message: registrados
        ? `A lista volta a ser editavel e nada vai para o historico. ` +
          `${registrados} ${registrados === 1 ? 'item ja marcado continua' : 'itens ja marcados continuam'} ` +
          `com o preco registrado, e voce retoma de onde parou.`
        : 'A lista volta a ser editavel e nada vai para o historico.',
      buttons: [
        { text: 'Continuar comprando', role: 'cancel' },
        {
          text: 'Voltar',
          handler: async () => {
            await this.listaRepo.voltarParaMontagem(this.listaId);
            await this.router.navigate(['/listas', this.listaId], { replaceUrl: true });
          },
        },
      ],
    });
    await alert.present();
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
