# Backlog — ListAqui

O que ainda não foi feito, com o contexto de **por que** existe. Cada item deve
ser avaliado contra a ideia central do app: se adiciona fricção ao fluxo de
riscar item no corredor do mercado, provavelmente está errado.

Ordem dentro de cada bloco é de valor percebido, não de esforço.

## Funcionalidades

### 1. Ordenar a lista por setor do mercado
Hoje a lista sai na ordem em que foi digitada, então você vai e volta entre
corredores. Precisaria de um campo de setor no `Produto` (hortifruti, açougue,
limpeza...) preenchido sozinho na primeira compra e ajustável depois.

### 2. Acentuação nos textos da UI
Herança do bootstrap inicial: o `README.md` usa acentos e a UI não. É a única
dívida puramente cosmética, mas aparece em toda tela.

### 3. Listas recorrentes / modelo fixo
"Compra do mês" repete quase os mesmos itens. Hoje dá para duplicar uma compra
finalizada pelo histórico, o que resolve em parte — falta um modelo que não
dependa de ter feito a compra antes.

### 4. Leitura de código de barras pela câmera
Elimina a digitação do nome no corredor. Depende de uma base de códigos, ou de
o próprio usuário associar o código ao produto na primeira leitura.

### 5. Capacitor para gerar APK e publicar na Play Store
Hoje o app é instalado como PWA. Vale se a distribuição passar a importar.

### 6. Backend opcional com sincronização
É aqui que os repositórios abstratos pagam o investimento: bastaria um
`ApiListaRepository` e trocar o `useClass` no `app.config.ts`. Resolveria a
limitação de os dados viverem num navegador só — hoje a transferência entre
aparelhos é manual, via backup JSON.

## Melhorias de uso

### Aviso de nova versão, com botão de atualizar
O service worker baixa a versão nova em segundo plano, mas só a ativa quando o
app é encerrado de verdade — no Android, apertar Home não basta, é preciso tirar
da lista de recentes. O resultado é publicar e o celular continuar na versão
velha, sem nenhuma pista do que está acontecendo.

Solução: `SwUpdate` do Angular. Ao detectar versão pronta, mostrar um aviso
discreto com botão "Atualizar", que chama `activateUpdate()` e recarrega.
**Não** recarregar sozinho: fazer isso no meio de uma compra, com itens sendo
riscados, seria pior que o problema.

Complemento natural: mostrar a versão instalada na tela de Ajustes, com um botão
"Procurar atualização" (`checkForUpdate()`), para o caso de o automático não
disparar. Hoje não há como saber, olhando o celular, qual versão está rodando.

### Dica de exclusão dispensável na tela inicial
A dica "arraste para excluir" é permanente no topo da lista de compras. Depois
da terceira ou quarta vez vira ruído fixo. Poderia sumir após algumas compras
criadas, ou ganhar um "x" que grava a escolha — o que exige um lugar para
preferências do usuário, que hoje não existe.

## Dívida técnica

### Rodar o teste de fumaça
O `e2e-smoke.mjs` foi ajustado junto com o redesenho do modo compra (seletores
e valores da máscara de moeda), mas **nunca foi executado depois disso**: o
Playwright não está instalado nesta máquina. Um teste que ninguém roda é uma
rede de segurança que ninguém sabe se existe. Ele também não cobre nada do que
entrou na 1.1.0 (adicionar item durante a compra, editar pendente, voltar para
montagem).

### Actions depreciadas no workflow
`actions/checkout@v4` e `actions/setup-node@v4` estão sendo forçadas a rodar em
Node 24 e emitem aviso de depreciação a cada execução. Subir para `@v5`.

### Paleta calibrada só para o tema claro
As cores em `styles.scss` são definidas no `:root` e vencem a paleta escura do
Ionic. São tons escuros, escolhidos para ler bem sob luz de supermercado em
fundo claro — no tema escuro, viram texto escuro sobre fundo escuro. Já corrigido
caso a caso (fundo dos campos, etiqueta "extra"), mas a causa continua de pé: o
verde-petróleo do total no rodapé é o próximo candidato.

### Deploy dispara em mudança de documentação
Qualquer push em `main` republica o site, inclusive commits que só mexem em
`.md`. Um `paths-ignore` no gatilho evitaria builds inúteis.

### `npm run test` sem runner
Existe o script no `package.json` e um `tsconfig.spec.json`, mas nenhum runner
de teste unitário instalado — rodar o script falha. Ou instalamos um, ou
removemos o script para não sugerir que há testes unitários.

### Estatísticas de Ajustes acessam o Dexie direto
`ajustes.page.ts` usa `db.*.count()`, furando a regra de todo acesso a dados
passar por repositório. É a única exceção hoje; se crescer, vira método de
repositório.
