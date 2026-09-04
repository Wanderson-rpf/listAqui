import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AlertController,
  IonAccordion,
  IonAccordionGroup,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
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
import { Router } from '@angular/router';
import { ItemLista, Lista, definicaoTipo, totalDoItem } from '../../core/models/lista.model';
import { recarregarAoVoltarDeFora } from '../../core/navegacao/recarregar-ao-voltar';
import { ListaRepository } from '../../core/repositories/lista.repository';

interface CompraHistorico {
  lista: Lista;
  itens: ItemLista[];
}

interface GrupoMes {
  chave: string;
  rotulo: string;
  total: number;
  compras: CompraHistorico[];
}

@Component({
  selector: 'app-historico',
  imports: [
    CurrencyPipe,
    DatePipe,
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
    IonAccordion,
    IonAccordionGroup,
  ],
  templateUrl: './historico.page.html',
  styleUrl: './historico.page.scss',
})
export class HistoricoPage {
  private readonly listaRepo = inject(ListaRepository);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly router = inject(Router);

  readonly grupos = signal<GrupoMes[]>([]);
  readonly totalMesAtual = signal(0);
  readonly comprasMesAtual = signal(0);
  readonly rotuloResumo = signal('Gasto neste mes');
  readonly carregando = signal(true);

  constructor() {
    // Finalizar uma compra cai aqui vindo de /listas/:id/comprar, que esta
    // fora das abas: sem isto o total exibido seria o de antes da compra.
    recarregarAoVoltarDeFora('/tabs/historico', () => void this.carregar());
  }

  ionViewWillEnter(): void {
    void this.carregar();
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    const listas = await this.listaRepo.listarFinalizadas();

    const compras: CompraHistorico[] = await Promise.all(
      listas.map(async (lista) => ({
        lista,
        itens: (await this.listaRepo.itensDaLista(lista.id!)).filter((i) => i.comprado),
      })),
    );

    this.grupos.set(agruparPorMes(compras));

    // Resumo do mes corrente, que e a pergunta mais frequente.
    const agora = new Date();
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1).getTime();
    const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59).getTime();

    const totalMes = await this.listaRepo.totalPorPeriodo(inicio, fim);
    const comprasMes = listas.filter(
      (l) => (l.finalizadaEm ?? 0) >= inicio && (l.finalizadaEm ?? 0) <= fim,
    ).length;

    if (comprasMes > 0 || this.grupos().length === 0) {
      this.rotuloResumo.set('Gasto neste mes');
      this.totalMesAtual.set(totalMes);
      this.comprasMesAtual.set(comprasMes);
    } else {
      // Sem compras no mes corrente, um "R$ 0,00" gigante nao diz nada.
      // Mostra o ultimo mes que teve movimento.
      const ultimo = this.grupos()[0];
      this.rotuloResumo.set(`Gasto em ${ultimo.rotulo}`);
      this.totalMesAtual.set(ultimo.total);
      this.comprasMesAtual.set(ultimo.compras.length);
    }

    this.carregando.set(false);
  }

  async repetir(compra: CompraHistorico, ev: Event): Promise<void> {
    ev.stopPropagation();
    const nome = `${compra.lista.nome} (nova)`;
    const novoId = await this.listaRepo.duplicar(compra.lista.id!, nome);

    const toast = await this.toastCtrl.create({
      message: 'Lista recriada com os mesmos itens.',
      duration: 2000,
    });
    await toast.present();
    await this.router.navigate(['/listas', novoId]);
  }

  async excluir(compra: CompraHistorico, ev: Event): Promise<void> {
    ev.stopPropagation();

    const alert = await this.alertCtrl.create({
      header: 'Excluir do historico',
      message: `"${compra.lista.nome}" sera apagada junto com o historico de precos dela. Nao da para desfazer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Excluir',
          role: 'destructive',
          handler: async () => {
            await this.listaRepo.remover(compra.lista.id!);
            await this.carregar();
          },
        },
      ],
    });
    await alert.present();
  }

  // -------------------------------------------------------------- helpers

  icone(lista: Lista): string {
    return definicaoTipo(lista.tipo).icone;
  }

  cor(lista: Lista): string {
    return definicaoTipo(lista.tipo).cor;
  }

  totalItem(item: ItemLista): number {
    return totalDoItem(item);
  }

  formatarQtd(valor?: number): string {
    if (valor == null) return '';
    return Number.isInteger(valor)
      ? String(valor)
      : valor.toFixed(3).replace(/0+$/, '').replace('.', ',');
  }
}

/** Agrupa compras por ano-mes, preservando a ordem decrescente de data. */
function agruparPorMes(compras: CompraHistorico[]): GrupoMes[] {
  const mapa = new Map<string, GrupoMes>();

  for (const compra of compras) {
    const data = new Date(compra.lista.finalizadaEm ?? compra.lista.criadoEm);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        rotulo: data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
        total: 0,
        compras: [],
      });
    }

    const grupo = mapa.get(chave)!;
    grupo.compras.push(compra);
    grupo.total += compra.lista.totalGasto ?? 0;
  }

  return [...mapa.values()].map((g) => ({ ...g, total: Math.round(g.total * 100) / 100 }));
}
