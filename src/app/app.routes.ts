import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'tabs',
    loadComponent: () => import('./layout/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: 'compras',
        loadComponent: () => import('./features/compras/compras.page').then((m) => m.ComprasPage),
      },
      {
        path: 'historico',
        loadComponent: () =>
          import('./features/historico/historico.page').then((m) => m.HistoricoPage),
      },
      {
        path: 'produtos',
        loadComponent: () => import('./features/produtos/produtos.page').then((m) => m.ProdutosPage),
      },
      {
        path: 'ajustes',
        loadComponent: () => import('./features/ajustes/ajustes.page').then((m) => m.AjustesPage),
      },
      { path: '', redirectTo: 'compras', pathMatch: 'full' },
    ],
  },
  {
    path: 'listas/:id',
    loadComponent: () => import('./features/lista/lista.page').then((m) => m.ListaPage),
  },
  {
    path: 'listas/:id/comprar',
    loadComponent: () => import('./features/compra/compra.page').then((m) => m.CompraPage),
  },
  {
    path: 'produtos/:id',
    loadComponent: () =>
      import('./features/produtos/produto-detalhe.page').then((m) => m.ProdutoDetalhePage),
  },
  { path: '', redirectTo: 'tabs/compras', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/compras' },
];
