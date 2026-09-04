# Contexto do projeto — ListAqui

App de lista de compras que vira controle de gastos. Projeto pessoal do Ricardo,
com a possibilidade de virar produto comercial mais adiante.

Este arquivo é lido automaticamente pelo Claude Code ao abrir o projeto. Mantenha
ele atualizado quando uma decisão estrutural mudar — é o que evita ter que
reexplicar o projeto a cada sessão nova.

## A ideia central (não perca isso de vista)

**O ato de riscar o item É o registro da compra.** Não existe tela separada de
"lançar despesa". Ao marcar um item como comprado, o usuário informa quantidade e
preço, e isso alimenta ao mesmo tempo: o total do carrinho, o histórico do mês e
o preço de referência da próxima compra.

Qualquer feature nova deve ser avaliada contra isso. Se ela adiciona fricção ao
fluxo de riscar item no corredor do mercado, provavelmente está errada.

## Contexto de uso

O app é usado **de pé, com uma mão, no corredor do supermercado, possivelmente
com sinal ruim**. Isso justifica três coisas que já estão no código e devem ser
preservadas:

- Offline obrigatório (IndexedDB, nada de chamada de rede no caminho crítico)
- Áreas de toque grandes (`min-height: 42px` nos botões, em `styles.scss`)
- Total sempre visível, fixo no rodapé, sem precisar rolar

## Stack

- **Angular 21** standalone + signals (sem NgModules, sem RxJS no estado de tela)
- **Ionic 9** para os componentes
- **Dexie 4** sobre IndexedDB
- **PWA** com service worker; deploy no GitHub Pages via `.github/workflows/deploy.yml`

Sem backend. Sem custo operacional. Foi decisão explícita do Ricardo.

## Decisões de arquitetura (e o porquê)

### 1. Repositórios abstratos — a decisão mais importante

Nenhum componente de tela conhece o Dexie. Todo acesso a dados passa por
`ListaRepository` e `ProdutoRepository`, em `src/app/core/repositories/`.

São **classes abstratas, não interfaces** — interfaces somem na compilação do
TypeScript e não servem como token de injeção no Angular.

A troca acontece em um único lugar, `app.config.ts`:

```ts
{ provide: ListaRepository,   useClass: DexieListaRepository },
{ provide: ProdutoRepository, useClass: DexieProdutoRepository },
```

**Regra:** se você for escrever `import { db }` ou `Dexie` dentro de
`features/`, pare. O lugar disso é em `core/repositories/dexie/`. A única
exceção hoje é `ajustes.page.ts`, que usa `db.*.count()` para as estatísticas —
se isso crescer, vira método de repositório.

### 2. Não existe entidade "Compra"

**A lista finalizada é a compra.** O ciclo de vida está em `Lista.status`:
`montando` → `comprando` → `finalizada`. Isso eliminou uma entidade inteira sem
perder histórico.

Consequência: histórico de preço não é tabela, é consulta —
`ListaRepository.historicoPreco(produtoId)` varre os `ItemLista` comprados.

### 3. Três entidades, com papéis distintos

- **Produto** — existe para sempre, é o fio que costura o histórico de preço
- **Lista** — uma ida ao mercado
- **ItemLista** — o produto dentro de uma lista; guarda o planejado e, depois de
  riscado, o que foi realmente pago

`ItemLista.nomeProduto` é um **snapshot proposital**: renomear um produto no
catálogo não deve reescrever o histórico.

### 4. Preço unitário OU total pago

O modal `registrar-compra.modal.ts` tem um seletor entre os dois modos. Item de
balança (banana, frios) você digita o valor da etiqueta e o app deriva o
unitário. Sem isso o histórico de preço desses itens vira lixo.

Grave sempre `precoUnitario` normalizado, seja qual for o modo de entrada.

## Convenções do código

- **Idioma:** código, nomes e comentários em português. Comentários explicam
  *por quê*, não *o quê*.
- **Sem acentos** em strings de identificadores e chaves; nos textos de UI os
  acentos são bem-vindos (o `README.md` usa; boa parte da UI ainda não usa — é
  dívida conhecida, ver abaixo).
- **Signals** para estado de tela. `computed()` para derivados. Nada de
  `BehaviorSubject` em componente.
- **Recarregar dados** no hook `ionViewWillEnter()`, não no `ngOnInit()` — em
  páginas dentro de abas o Ionic reaproveita a instância e o `ngOnInit` não
  dispara de novo.
- **Dinheiro:** sempre pela função `arredondar()` de `lista.model.ts`. Nunca
  somar float cru.

### Formulários — dois padrões obrigatórios

Ambos moram em `src/app/core/formulario/`. Tela nova que peça digitação usa
os dois; não reimplemente.

**1. Campo de valor usa a máscara de moeda.** Digita-se só número e os sinais
entram sozinhos (`750` → `R$ 7,50`). Em template:

```html
<ion-input label="Orcamento" [(moeda)]="orcamento" />
```

`moeda` é o valor **em reais** e `type`, `inputmode` e `placeholder` vêm da
diretiva — não repita no template. O valor vive em centavos por dentro, que é
o que evita ambiguidade de vírgula. Dentro de `ion-alert`, onde não há
template, use `aplicarMascaraMoedaEm(input)` e leia com `centavosDigitados()`.

**2. Enter no último (ou único) campo confirma.** Nem toda tela tem botão de
inserir visível, e no celular o botão de confirmar costuma ficar no topo,
longe do polegar. Campos intermediários passam o foco adiante:

```html
<ion-input enterkeyhint="next" (keyup.enter)="campoOnde.setFocus()" />
<ion-input #campoOnde enterkeyhint="done" (keyup.enter)="salvar()" />
```

Marque sempre o `enterkeyhint` (`next` no meio, `done` no último). Em
`ion-alert` — que **não** envia no Enter sozinho — use `enviarNoEnter(alerta, acao)`
depois do `present()`. Campo de texto longo (`ion-textarea`) fica de fora: ali
o Enter é quebra de linha.

## Armadilhas já encontradas (não repita)

**`ion-tabs` já cria o próprio `ion-router-outlet`.** Declarar outro dentro dele
cria uma camada invisível cobrindo a tela inteira que engole todos os cliques —
o app carrega normal e simplesmente não responde. Está comentado em
`layout/tabs.page.ts`.

**Imports do Ionic 9 vêm de `@ionic/angular`,** não de `@ionic/angular/standalone`
(isso mudou na v9; muito exemplo na internet ainda usa o caminho antigo).

**`ion-button` não mantém `aria-label` no host** — ele move para o `<button>`
interno. Isso quebra seletores de teste do tipo
`ion-button[aria-label="..."]`. Prefira selecionar pelo ícone.

**Corrida entre `ionInput` e `keyup.enter`:** no campo de adição rápida, o Enter
pode chegar antes do signal atualizar. Por isso `adicionarDigitado()` recebe o
valor direto do evento em vez de ler o signal. Ver `lista.page.ts`.

## Como rodar e verificar

```bash
npm install
npm start                      # http://localhost:4200
npm start -- --host 0.0.0.0    # para abrir no celular na mesma rede

npm run build                  # build de produção
npm run build:pages            # build com base-href do GitHub Pages
```

Teste de fumaça (percorre o fluxo inteiro num Chrome headless, 19 verificações):

```bash
npm i -D playwright && npx playwright install chromium   # só na primeira vez
npm run build
npx http-server dist/listaqui/browser -p 4321 -s &
npm run e2e
```

**Rode o e2e depois de mexer em fluxo de compra ou em cálculo.** Ele valida os
números de verdade (2 × 7,50 = 15,00, orçamento restante, soma do carrinho) e a
persistência após reload.

## Estado atual

Funcionando: montar lista, modo compra com total corrente, autocomplete de
produtos, comparação com o último preço pago, item fora da lista, histórico por
mês, evolução de preço por produto, exportação CSV e backup JSON.

Ainda não feito, em ordem de valor percebido:

1. Ordenar a lista por setor do mercado (evita ir e voltar entre corredores)
2. Acentuação nos textos da UI (hoje está sem, por herança do bootstrap inicial)
3. Listas recorrentes / modelo fixo
4. Leitura de código de barras pela câmera
5. Capacitor para gerar APK e publicar na Play Store
6. Backend opcional com sincronização — é aqui que os repositórios abstratos pagam

## Limitação que o usuário precisa saber

Dados vivem só no IndexedDB de um navegador específico. Trocar de celular,
formatar ou limpar dados do site apaga tudo. O backup JSON em Ajustes não é
enfeite — é a rede de segurança. Não remova nem esconda essa função.
