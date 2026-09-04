import { registerLocaleData } from '@angular/common';
import ptBr from '@angular/common/locales/pt';
import {
  ApplicationConfig,
  LOCALE_ID,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideIonicAngular } from '@ionic/angular';

import { routes } from './app.routes';
import { DexieListaRepository } from './core/repositories/dexie/dexie-lista.repository';
import { DexieProdutoRepository } from './core/repositories/dexie/dexie-produto.repository';
import { ListaRepository } from './core/repositories/lista.repository';
import { ProdutoRepository } from './core/repositories/produto.repository';

registerLocaleData(ptBr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideIonicAngular({ mode: 'md' }),
    { provide: LOCALE_ID, useValue: 'pt-BR' },

    /**
     * ---------------------------------------------------------------
     * A troca de infraestrutura acontece aqui, e so aqui.
     *
     * Quando este app ganhar um backend, escreva ApiListaRepository /
     * ApiProdutoRepository respeitando o mesmo contrato abstrato e troque
     * o `useClass` abaixo. Nenhum componente de tela precisa ser tocado,
     * porque nenhum deles conhece o Dexie.
     * ---------------------------------------------------------------
     */
    { provide: ListaRepository, useClass: DexieListaRepository },
    { provide: ProdutoRepository, useClass: DexieProdutoRepository },

    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
