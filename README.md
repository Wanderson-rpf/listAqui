# ListAqui

Lista de compras que vira controle de gastos. Você monta a lista antes de sair,
e no mercado vai riscando os itens — cada item riscado registra quantidade e preço,
então o histórico de gastos e a variação de preço se constroem sozinhos.

Funciona 100% offline, os dados ficam só no seu aparelho e não existe servidor.

## A ideia central

O ato de riscar o item **é** o registro da compra. Não existe uma tela separada de
"lançar despesa": quando você marca o leite como comprado, informa quanto pagou, e
isso vira ao mesmo tempo o total do carrinho, o histórico do mês e o preço de
referência da próxima vez.

## O que dá para fazer

- Listas por tipo: mercado, feira, farmácia ou avulsa
- Autocomplete dos produtos que você já comprou antes
- Modo compra com total correndo no rodapé e alerta de orçamento
- Preço por unidade **ou** total pago (para itens da balança)
- Comparação com o último preço pago, na hora de colocar no carrinho
- Item fora da lista, para o que você pega sem ter planejado
- Histórico por mês, com detalhamento de cada compra
- Evolução de preço por produto (menor, média, maior)
- Repetir uma lista antiga com um toque
- Exportação em CSV e backup completo em JSON

## Stack

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Framework | Angular 21 (standalone + signals) | Estrutura opinativa, boa base para crescer |
| UI | Ionic 9 | Componentes com comportamento nativo em mobile |
| Dados | Dexie 4 sobre IndexedDB | Offline de verdade, sem backend |
| Distribuição | PWA (service worker) | Instala no celular, custo operacional zero |

## Rodando

```bash
npm install
npm start            # http://localhost:4200
```

Para abrir no celular, veja a seção seguinte.

Build de produção:

```bash
npm run build
```

Teste de fumaça do fluxo completo — 19 verificações num Chrome headless,
incluindo os cálculos de dinheiro e a persistência após reload:

```bash
npm i -D playwright && npx playwright install chromium   # só na primeira vez
npm run preview &      # build + servidor na porta 4321
npm run e2e
```

Rode isso depois de mexer em fluxo de compra ou em cálculo.

## Testando no celular (antes de hospedar)

Não precisa publicar nada para usar o app. Há dois níveis de teste.

### 1. Rápido — testa o app, não a instalação

```bash
npm run start:lan
```

O terminal imprime uma linha `Network: http://192.168.x.x:4200/`. Abra esse
endereço no navegador do celular, com o celular na mesma rede Wi-Fi do PC.

Funciona tudo: listas, modo compra, histórico, IndexedDB. O que **não** funciona
é instalar na tela de início nem usar offline — e o motivo é técnico, não é bug:
service worker só roda em *contexto seguro* (HTTPS ou `localhost`). Um IP de rede
local via HTTP não é contexto seguro. Além disso, o service worker fica desligado
de propósito em modo dev (`enabled: !isDevMode()` no `app.config.ts`).

> **Windows:** na primeira execução o firewall pergunta se permite o Node.js na
> rede. Se você recusar sem querer, o celular não conecta — libere em
> *Firewall do Windows → Permitir um aplicativo*.

### 2. Completo — testa a experiência real de app instalado

Primeiro o build de produção servido localmente:

```bash
npm run preview        # build + servidor na porta 4321
```

Depois exponha isso em HTTPS com um túnel temporário. O Cloudflare oferece isso
de graça e sem conta:

```bash
winget install --id Cloudflare.cloudflared     # só na primeira vez
cloudflared tunnel --url http://localhost:4321
```

Ele devolve uma URL `https://alguma-coisa.trycloudflare.com`. Abra no celular:
agora o Chrome oferece **Adicionar à tela de início**, o app abre em tela cheia
e continua funcionando com o celular em modo avião.

> Use `npm run preview` (base-href `/`), não `build:pages` — este último aponta
> para `/listAqui/` e só faz sentido no GitHub Pages.

### 3. Sem celular à mão

Chrome no desktop → F12 → ícone de dispositivo móvel. Dá para exercitar o fluxo
inteiro e inspecionar o IndexedDB em *Application → Storage*.

## Publicando no GitHub Pages

O deploy é automático: qualquer push na `main` dispara
`.github/workflows/deploy.yml`. Para ativar, vá em **Settings → Pages** e escolha
**GitHub Actions** como origem.

> O `--base-href` do build de produção aponta para `/listAqui/`, que é o caminho de
> um repositório de projeto no GitHub Pages. Se você publicar em domínio próprio ou
> em `usuario.github.io`, mude para `/`.

## Arquitetura

```
src/app/
  core/
    models/          Produto, Lista, ItemLista + regras puras (total, arredondamento)
    db/              Schema do IndexedDB (Dexie)
    repositories/    Contratos abstratos + implementação Dexie
    services/        Exportação CSV / backup JSON
  features/
    compras/         Listas em aberto e criação
    lista/           Montagem da lista (o que preciso comprar)
    compra/          Modo compra (riscar itens, total corrente)
    historico/       Compras finalizadas, agrupadas por mês
    produtos/        Catálogo e evolução de preço
    ajustes/         Relatórios, backup e limpeza
  layout/            Shell de abas
```

### A decisão que garante o futuro

Nenhum componente de tela conhece o Dexie. Todo acesso a dados passa por
`ListaRepository` e `ProdutoRepository`, que são **classes abstratas** — e não
interfaces, porque interfaces somem na compilação e não servem como token de
injeção no Angular.

A troca acontece num único lugar, em `app.config.ts`:

```ts
{ provide: ListaRepository,  useClass: DexieListaRepository },
{ provide: ProdutoRepository, useClass: DexieProdutoRepository },
```

No dia em que este app ganhar backend, basta escrever `ApiListaRepository`
respeitando o mesmo contrato e trocar o `useClass`. Nenhuma tela é tocada.

### Modelo de dados

Três entidades, e a mais importante é a separação entre as duas primeiras:

- **Produto** — existe para sempre. É o fio que costura o histórico de preço.
- **Lista** — uma ida ao mercado. Ciclo: `montando` → `comprando` → `finalizada`.
- **ItemLista** — o produto dentro de uma lista, com o que foi planejado e, depois
  de riscado, o que foi realmente pago.

Não existe entidade "Compra": **a lista finalizada é a compra**. Isso mantém o
modelo enxuto sem perder nada do histórico. Histórico de preço também não é
tabela — é consulta sobre os itens comprados de um produto.

## Limitações conhecidas

- **Sem sincronização.** Os dados vivem no IndexedDB de um navegador específico.
  Trocar de celular, formatar ou limpar os dados do site apaga tudo. Por isso o
  backup JSON em Ajustes não é enfeite: é a rede de segurança.
- **Sem multiusuário.** Uma pessoa, um aparelho.
- **Sem código de barras.** Cadastro de produto é digitado, com autocomplete.

## Próximos passos possíveis

1. Ordenar a lista por setor do mercado (evita ir e voltar entre corredores)
2. Listas recorrentes / modelo de lista fixa
3. Leitura de código de barras pela câmera
4. Capacitor para gerar APK e publicar na Play Store
5. Backend opcional com sincronização entre aparelhos
