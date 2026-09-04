import { inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';

/**
 * Executa `acao` quando `rota` volta a ficar ativa vindo de uma pagina que
 * esta fora das abas.
 *
 * Por que existe: `ionViewWillEnter()` cobre a troca entre abas, mas nao
 * dispara na volta de uma rota declarada fora do <ion-tabs> (`/listas/:id`,
 * `/listas/:id/comprar`, `/produtos/:id`). Nesse caminho o outlet interno
 * mantem a pagina da aba viva e o evento de ciclo de vida para no TabsPage,
 * deixando a tela com os dados de antes da ida. Era isso que fazia a lista
 * recem-criada sumir da tela inicial ate voce trocar de aba e voltar.
 *
 * Ouvir o router e evento de navegacao, nao estado de tela: o estado das
 * paginas continua em signals.
 */
export function recarregarAoVoltarDeFora(rota: string, acao: () => void): void {
  const router = inject(Router);
  let anterior = router.url;

  router.events.pipe(takeUntilDestroyed()).subscribe((evento) => {
    if (!(evento instanceof NavigationEnd)) return;

    const destino = evento.urlAfterRedirects;
    // So recarrega quando a navegacao veio de fora das abas; a troca entre
    // abas ja e coberta pelo ionViewWillEnter e recarregaria duas vezes.
    const veioDeFora = !anterior.startsWith('/tabs');
    anterior = destino;

    if (veioDeFora && destino.startsWith(rota)) acao();
  });
}
