import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { version } from '../../../../package.json';

/**
 * Ponte com o service worker para atualizar o app.
 *
 * Por que existe: o service worker baixa a versao nova em segundo plano,
 * mas so a ativa quando nao sobra nenhuma instancia da versao antiga
 * aberta. No Android, apertar Home nao fecha o app - so tirar da lista de
 * recentes - entao publicar e o celular continuar na versao velha, sem
 * nenhuma pista do porque, e o caso comum e nao a excecao.
 *
 * Aqui o usuario decide a hora. Nunca recarregamos sozinhos: fazer isso no
 * meio de uma compra, com itens sendo riscados, seria pior que o problema.
 */
@Injectable({ providedIn: 'root' })
export class AtualizacaoService {
  private readonly sw = inject(SwUpdate);

  /** Versao instalada, lida do package.json - fonte unica, ver CLAUDE.md. */
  readonly versaoInstalada = version;

  /** Ha uma versao baixada e pronta para assumir no proximo carregamento. */
  readonly disponivel = signal(false);

  /** Falso em desenvolvimento, onde o service worker fica desligado. */
  readonly ativo = this.sw.isEnabled;

  constructor() {
    if (!this.ativo) return;

    this.sw.versionUpdates.subscribe((evento) => {
      if ((evento as VersionReadyEvent).type === 'VERSION_READY') {
        this.disponivel.set(true);
      }
    });
  }

  /**
   * Pergunta ao servidor se ha versao nova, para quando a checagem
   * automatica nao acontecer. Devolve se encontrou algo.
   */
  async procurar(): Promise<boolean> {
    if (!this.ativo) return false;

    const achou = await this.sw.checkForUpdate();
    if (achou) this.disponivel.set(true);
    return achou;
  }

  /**
   * Ativa a versao baixada e recarrega. O recarregamento e necessario: sem
   * ele a pagina continua rodando o codigo antigo ja carregado na memoria.
   */
  async aplicar(): Promise<void> {
    if (!this.ativo) return;

    await this.sw.activateUpdate();
    location.reload();
  }
}
