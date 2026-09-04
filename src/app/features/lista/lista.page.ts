import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
  ModalController,
  ToastController,
} from '@ionic/angular';
import { enviarNoEnter } from '../../core/formulario/enviar-no-enter';
import {
  aplicarMascaraMoedaEm,
  centavosDigitados,
  formatarReais,
} from '../../core/formulario/moeda.directive';
import { ItemLista, Lista, definicaoTipo } from '../../core/models/lista.model';
import { Produto, UnidadeMedida } from '../../core/models/produto.model';
import { ListaRepository } from '../../core/repositories/lista.repository';
import { ProdutoRepository } from '../../core/repositories/produto.repository';
import { DadosItemEditado, ItemFormModal } from './item-form.modal';

@Component({
  selector: 'app-lista',
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
    IonInput,
    IonFooter,
    IonChip,
    IonItemSliding,
    IonItemOptions,
    IonItemOption,
  ],
  templateUrl: './lista.page.html',
  styleUrl: './lista.page.scss',
})
export class ListaPage {
  private readonly listaRepo = inject(ListaRepository);
  private readonly produtoRepo = inject(ProdutoRepository);
  private readonly modalCtrl = inject(ModalController);
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly lista = signal<Lista | null>(null);
  readonly itens = signal<ItemLista[]>([]);
  readonly termo = signal('');
  readonly sugestoes = signal<Produto[]>([]);

  private listaId!: number;

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

  // ------------------------------------------------------------ adicionar

  async digitou(valor: string): Promise<void> {
    this.termo.set(valor);
    const texto = valor.trim();
    // So sugere a partir de 2 caracteres: com 1 letra a lista vira ruido.
    this.sugestoes.set(texto.length >= 2 ? await this.produtoRepo.sugerir(texto, 6) : []);
  }

  /**
   * Recebe o texto direto do campo em vez de ler o signal: o evento de
   * Enter pode chegar antes do ionInput ter atualizado o estado, e nesse
   * intervalo o item errado seria adicionado.
   */
  async adicionarDigitado(valor: string): Promise<void> {
    const nome = (valor ?? '').trim();
    if (!nome) return;
    await this.adicionar(nome, 'un');
  }

  async adicionarSugestao(produto: Produto): Promise<void> {
    await this.adicionar(produto.nome, produto.unidadePadrao);
  }

  private async adicionar(nome: string, unidade: UnidadeMedida): Promise<void> {
    const produto = await this.produtoRepo.obterOuCriar(nome, unidade);

    // Se o produto ja esta na lista, soma 1 na quantidade em vez de duplicar a linha.
    const existente = this.itens().find((i) => i.produtoId === produto.id);
    if (existente) {
      await this.listaRepo.atualizarItem(existente.id!, {
        quantidadePlanejada: existente.quantidadePlanejada + 1,
      });
    } else {
      await this.listaRepo.adicionarItem({
        listaId: this.listaId,
        produtoId: produto.id!,
        nomeProduto: produto.nome,
        unidade: produto.unidadePadrao,
        quantidadePlanejada: 1,
      });
    }

    this.termo.set('');
    this.sugestoes.set([]);
    await this.carregar();
  }

  // ---------------------------------------------------------------- itens

  async ajustar(item: ItemLista, delta: number, ev: Event): Promise<void> {
    ev.stopPropagation();
    const nova = Math.round((item.quantidadePlanejada + delta) * 1000) / 1000;
    if (nova <= 0) return;
    await this.listaRepo.atualizarItem(item.id!, { quantidadePlanejada: nova });
    await this.carregar();
  }

  async editar(item: ItemLista): Promise<void> {
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

  // ------------------------------------------------------------ navegacao

  async iniciarCompra(): Promise<void> {
    if (!this.itens().length) {
      const toast = await this.toastCtrl.create({
        message: 'Adicione pelo menos um item antes de comecar.',
        duration: 2500,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    await this.listaRepo.iniciarCompra(this.listaId);
    await this.router.navigate(['/listas', this.listaId, 'comprar'], { replaceUrl: true });
  }

  async renomear(): Promise<void> {
    const lista = this.lista();
    if (!lista) return;

    const alert = await this.alertCtrl.create({
      header: 'Editar compra',
      inputs: [
        { name: 'nome', value: lista.nome, placeholder: 'Nome' },
        { name: 'local', value: lista.local ?? '', placeholder: 'Onde (mercado, feira...)' },
        {
          name: 'orcamento',
          value: lista.orcamento ? formatarReais(lista.orcamento) : '',
          placeholder: 'Orcamento',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salvar',
          handler: async (dados: { nome: string; local: string; orcamento: string }) => {
            await this.salvarEdicao(dados.nome, dados.local, dados.orcamento, lista);
          },
        },
      ],
    });
    await alert.present();

    // O campo de dinheiro segue a mascara padrao do app, e o Enter no
    // ultimo campo salva - ver core/formulario.
    const campos = alert.querySelectorAll('input');
    if (campos[2]) aplicarMascaraMoedaEm(campos[2]);

    enviarNoEnter(alert, async ([nome, local, orcamento]) => {
      await alert.dismiss();
      await this.salvarEdicao(nome, local, orcamento, lista);
    });
  }

  private async salvarEdicao(
    nome: string,
    local: string,
    orcamento: string,
    original: Lista,
  ): Promise<void> {
    const emReais = centavosDigitados(orcamento) / 100;

    await this.listaRepo.atualizar(this.listaId, {
      nome: nome?.trim() || original.nome,
      local: local?.trim() || undefined,
      orcamento: emReais > 0 ? emReais : undefined,
    });
    await this.carregar();
  }

  // -------------------------------------------------------------- helpers

  rotuloTipo(): string {
    const lista = this.lista();
    return lista ? definicaoTipo(lista.tipo).rotulo : '';
  }

  /** Mostra "2" em vez de "2,000" mas preserva "0,75". */
  formatarQtd(valor: number): string {
    return Number.isInteger(valor) ? String(valor) : valor.toFixed(3).replace(/0+$/, '').replace('.', ',');
  }
}
