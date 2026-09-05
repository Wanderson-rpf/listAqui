---
description: Publica as alterações pendentes — versiona, commita, tagueia, faz push e acompanha o deploy
argument-hint: "[major|minor|patch] (opcional — sem isso, decida pelos critérios do CLAUDE.md)"
---

Publique as alterações pendentes do ListAqui seguindo o processo abaixo, na ordem.
Não pule etapas e não siga adiante se alguma falhar.

O usuário pediu este incremento de versão: `$1` (vazio significa: decida você).

## 1. Ver o que vai ao ar

Use PowerShell (o Bash desta máquina não tem `git` no PATH):

- `git status --short` e `git diff --stat` para o resumo
- `git diff` nos arquivos relevantes, para entender a natureza da mudança

Se não houver nada pendente, diga isso e pare.

## 2. Decidir a versão

Siga a tabela de SemVer do CLAUDE.md — o contrato que importa é o dado do
usuário e o fluxo de compra, não API pública:

- **MAJOR**: quebra dados gravados, formato do backup ou o modelo de riscar item
- **MINOR**: funcionalidade nova compatível
- **PATCH**: correção, ajuste visual, texto, refatoração interna

Se `$1` veio preenchido, use o que o usuário pediu. Se não veio, decida e
**diga qual escolheu e por quê** antes de aplicar. No lote misto, vale o maior.

Se a mudança for MAJOR, pare e confirme com o usuário antes de continuar:
MAJOR significa que alguém pode perder dado, e isso é decisão dele.

## 3. Aplicar a versão

- Edite `version` no `package.json`
- Sincronize o lock: `npm install --package-lock-only`
  (nunca `npm install` puro aqui — ele mexeria nas dependências)

## 4. Validar antes de publicar

- `npm run build` — só siga se terminar em "Application bundle generation complete"
- Se a mudança tocou fluxo de compra ou cálculo, avise que o e2e deveria rodar
  (e que o Playwright não está instalado nesta máquina, se continuar assim)

Build quebrado: pare, conserte ou relate. Nunca publique sem build limpo.

## 5. Commitar

Mensagem em português, no padrão do repositório: título curto no imperativo e
corpo explicando **por que** a mudança existe — o que o usuário não conseguia
fazer antes, ou o que estava quebrado. Não liste arquivos; o diff já faz isso.

Escreva a mensagem num arquivo do scratchpad e use `git commit -F <arquivo>`:
here-strings do PowerShell quebram com aspas e acentos no meio.

## 6. Tag e push

- `git tag vX.Y.Z`
- `git push --follow-tags origin main`

A tag é o que permite responder depois "o que exatamente está no celular" e
serve de ponto de retorno para um rollback.

## 7. Acompanhar o deploy

O push dispara o GitHub Actions, que publica no GitHub Pages. Acompanhe até
concluir, em segundo plano, e relate o resultado:

```powershell
$url = "https://api.github.com/repos/Wanderson-rpf/listAqui/actions/runs?per_page=1"
do { Start-Sleep -Seconds 15; $run = (Invoke-RestMethod $url).workflow_runs[0] } while ($run.status -ne 'completed')
"RUN $($run.head_sha.Substring(0,7)) -> $($run.conclusion)"
```

Se falhar, busque o step que quebrou pela API (`$run.jobs_url`) antes de
especular sobre a causa.

## 8. Fechar

Diga ao usuário:

- a versão publicada e o que entrou nela
- que o app no celular **só troca de versão na segunda abertura** — o service
  worker baixa a nova em segundo plano e só a ativa no próximo início
- se o rollback é seguro nesta entrega: reverter o código não desfaz dado já
  gravado, então diga explicitamente se algo mudou em dados persistidos
