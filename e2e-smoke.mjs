/**
 * Teste de fumaca do fluxo principal, rodando contra o build de producao.
 * Percorre: criar lista -> adicionar itens -> comprar -> registrar preco ->
 * finalizar -> conferir historico -> exportar CSV.
 *
 * Pre-requisito (uma vez):
 *   npm i -D playwright && npx playwright install chromium
 *
 * Uso:
 *   npm run build
 *   npx http-server dist/listaqui/browser -p 4321 -s &
 *   npm run e2e
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4321';
const passos = [];
const falhas = [];

function ok(msg) {
  passos.push(msg);
  console.log('  OK  ' + msg);
}
function falhou(msg, erro) {
  falhas.push(msg + (erro ? ' :: ' + erro : ''));
  console.log('  XX  ' + msg + (erro ? ' :: ' + erro : ''));
}

// PLAYWRIGHT_CHROMIUM permite apontar para um binario ja instalado na maquina.
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
);
const ctx = await browser.newContext({
  viewport: { width: 412, height: 900 },
  deviceScaleFactor: 2,
  locale: 'pt-BR',
  acceptDownloads: true,
});
const page = await ctx.newPage();

const errosConsole = [];
page.on('console', (m) => {
  if (m.type() === 'error') errosConsole.push(m.text());
});
page.on('pageerror', (e) => errosConsole.push('pageerror: ' + e.message));

try {
  // ---------------------------------------------------------------- inicio
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('ion-tab-bar', { timeout: 15000 });
  ok('App carregou com a barra de abas');

  // ------------------------------------------------------- criar uma lista
  await page.locator('ion-fab-button').click();
  await page.waitForSelector('ion-modal ion-title:has-text("Nova compra")', { timeout: 8000 });
  ok('Modal de nova compra abriu');

  const inputsModal = page.locator('ion-modal ion-input input');
  await inputsModal.nth(0).fill('Compra de teste');
  await inputsModal.nth(1).fill('Mercado Bom Preco');
  // Campo com mascara de moeda: o que conta sao os digitos (10000 = R$ 100,00).
  await inputsModal.nth(2).fill('100,00');
  await page.locator('ion-modal ion-button:has-text("Criar")').click();

  await page.waitForSelector('ion-input[placeholder="O que voce precisa comprar?"]', {
    timeout: 8000,
  });
  ok('Lista criada e tela de montagem abriu');

  // ------------------------------------------------------- adicionar itens
  const campoItem = page.locator('ion-input[placeholder="O que voce precisa comprar?"] input');
  await page.waitForTimeout(800);
  await campoItem.click();
  for (const nome of ['Leite integral', 'Arroz 5kg', 'Banana']) {
    await campoItem.fill(nome);
    await page.waitForTimeout(250);
    await campoItem.press('Enter');
    await page.waitForTimeout(600);
  }

  const nomesNaTela = await page.locator('ion-content ion-item-sliding h2').allInnerTexts();
  console.log('      itens na tela: ' + JSON.stringify(nomesNaTela));
  const qtdItens = await page.locator('ion-content ion-item-sliding').count();
  if (qtdItens === 3) ok('Tres itens adicionados a lista');
  else falhou('Esperava 3 itens, encontrei ' + qtdItens);

  // Aumentar a quantidade do primeiro item via stepper
  await page.locator('ion-item-sliding').first().locator('.passo ion-button').nth(1).click();
  await page.waitForTimeout(400);
  const textoQtd = await page.locator('ion-item-sliding').first().locator('.qtd').innerText();
  if (textoQtd.trim().startsWith('2')) ok('Stepper de quantidade funcionou (2)');
  else falhou('Stepper nao alterou a quantidade, li: ' + textoQtd.replace(/\n/g, ' '));

  // Autocomplete: digitar parte de um nome ja cadastrado
  await campoItem.fill('lei');
  await page.waitForTimeout(600);
  const temSugestao = await page.locator('.sugestoes ion-item').count();
  if (temSugestao > 0) ok('Autocomplete sugeriu produto ja cadastrado');
  else falhou('Autocomplete nao retornou sugestoes para "lei"');
  await campoItem.fill('');

  // ---------------------------------------------------------- modo compra
  await page.locator('ion-footer ion-button:has-text("Comecar a comprar")').click();
  await page.waitForSelector('.secao:has-text("Faltam pegar")', { timeout: 8000 });
  ok('Modo compra abriu com os itens pendentes');

  // Registrar o primeiro item pelo preco unitario
  const pendentes = page.locator('.lista-pendentes ion-item');
  await pendentes.first().click();
  await page.waitForSelector('ion-modal ion-segment', { timeout: 8000 });
  // O campo de valor tem mascara de moeda: o que vale sao os digitos.
  const camposModal = page.locator('ion-modal ion-input input');
  await camposModal.nth(1).fill('7,50');
  await page.waitForTimeout(300);

  const totalModal = await page.locator('ion-modal .resultado strong').innerText();
  // 2 unidades x 7,50 = 15,00
  if (totalModal.includes('15,00')) ok('Total do item calculado certo (2 x 7,50 = 15,00)');
  else falhou('Total do item errado, li: ' + totalModal);

  await page.locator('ion-modal ion-button:has-text("No carrinho")').click();
  await page.waitForTimeout(900);
  ok('Primeiro item registrado');

  // Registrar o segundo item pelo modo "total pago"
  await page.locator('.secao:has-text("Faltam pegar")').first().waitFor({ timeout: 5000 });
  await pendentes.first().click();
  await page.waitForSelector('ion-modal ion-segment', { timeout: 8000 });
  await page.locator('ion-modal ion-segment-button:has-text("Total pago")').click();
  await page.waitForTimeout(300);
  const campos2 = page.locator('ion-modal ion-input input');
  await campos2.nth(0).fill('2');
  await campos2.nth(1).fill('30,00');
  await page.waitForTimeout(400);

  const total2 = await page.locator('ion-modal .resultado strong').innerText();
  if (total2.includes('30,00')) ok('Modo "total pago" calculou o unitario corretamente');
  else falhou('Modo total pago errado, li: ' + total2);

  await page.locator('ion-modal ion-button:has-text("No carrinho")').click();
  await page.waitForTimeout(900);

  // Conferir o total corrente no rodape
  const rodape = await page.locator('ion-footer .total strong').last().innerText();
  if (rodape.includes('45,00')) ok('Total corrente do carrinho certo (15 + 30 = 45)');
  else falhou('Total do rodape errado, li: ' + rodape);

  // Orcamento de 100 -> deve restar 55
  const notaOrcamento = await page.locator('ion-footer .orcamento ion-note').last().innerText();
  if (notaOrcamento.includes('55,00')) ok('Calculo de orcamento restante correto');
  else falhou('Orcamento restante errado, li: ' + notaOrcamento);

  await page.screenshot({ path: 'captura-compra.png' });

  // -------------------------------------------------------- item extra
  await page.locator('ion-header ion-button:has(ion-icon[name="add-circle-outline"])').last().click();
  await page.waitForSelector('ion-alert', { timeout: 5000 });
  await page.locator('ion-alert input').fill('Chocolate');
  await page.locator('ion-alert button:has-text("Adicionar")').click();
  await page.waitForSelector('ion-modal ion-segment', { timeout: 8000 });
  await page.locator('ion-modal ion-input input').nth(1).fill('12,00');
  await page.waitForTimeout(300);
  await page.locator('ion-modal ion-button:has-text("No carrinho")').click();
  await page.waitForTimeout(900);

  const rodape2 = await page.locator('ion-footer .total strong').last().innerText();
  if (rodape2.includes('57,00')) ok('Item fora da lista somou ao total (45 + 12 = 57)');
  else falhou('Total apos item extra errado, li: ' + rodape2);

  // ------------------------------------------------------------ finalizar
  await page.locator('ion-footer ion-button:has-text("Finalizar")').last().click();
  await page.waitForSelector('ion-alert', { timeout: 5000 });
  await page.locator('ion-alert button:has-text("Finalizar")').click();
  await page.waitForSelector('.resumo strong', { timeout: 10000 });

  const totalHistorico = await page.locator('.resumo strong').last().innerText();
  if (totalHistorico.includes('57,00')) ok('Historico registrou o total do mes (57,00)');
  else falhou('Total no historico errado, li: ' + totalHistorico);

  await page.screenshot({ path: 'captura-historico.png' });

  // ------------------------------------------------------ historico preco
  await page.locator('ion-tab-button[tab="produtos"]').click();
  await page.waitForTimeout(1200);
  // Paginas anteriores continuam no DOM (ocultas) durante as transicoes do Ionic.
  const paginaVisivel = page.locator('.ion-page:not(.ion-page-hidden)').last();
  const itensProdutos = paginaVisivel.locator('ion-content ion-item');
  const qtdProdutos = await itensProdutos.count();
  if (qtdProdutos >= 3) ok('Aba de precos listou os produtos comprados');
  else falhou('Esperava ao menos 3 produtos, encontrei ' + qtdProdutos);

  await itensProdutos.first().click();
  await page.waitForSelector('.destaque strong', { timeout: 8000 });
  ok('Detalhe de preco do produto abriu');
  await page.screenshot({ path: 'captura-preco.png' });

  // -------------------------------------------------------- exportar CSV
  await page.goBack();
  await page.waitForTimeout(600);
  await page.locator('ion-tab-button[tab="ajustes"]').click();
  await page.waitForSelector('ion-item:has-text("Exportar itens")', { timeout: 8000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
  await page.locator('ion-item:has-text("Exportar itens")').click();
  const download = await downloadPromise;
  await download.saveAs('/tmp/export-itens.csv');

  const fs = await import('node:fs');
  const csv = fs.readFileSync('/tmp/export-itens.csv', 'utf8');
  const linhas = csv.trim().split('\n');
  // 3 itens foram efetivamente comprados (a banana ficou pendente) + cabecalho.
  if (
    linhas.length === 4 &&
    csv.includes('Leite integral') &&
    csv.includes('Chocolate') &&
    !csv.includes('Banana') &&
    csv.includes('15,00')
  ) {
    ok('CSV exportado so com os itens comprados e virgula decimal');
  } else {
    falhou('CSV inesperado (' + linhas.length + ' linhas): ' + linhas[1]);
  }

  // ------------------------------------------------------------- backup
  const backupPromise = page.waitForEvent('download', { timeout: 10000 });
  await page.locator('ion-item:has-text("Salvar backup")').click();
  const backup = await backupPromise;
  await backup.saveAs('/tmp/backup.json');
  const dados = JSON.parse(fs.readFileSync('/tmp/backup.json', 'utf8'));
  if (dados.formato === 'compras-app' && dados.listas.length === 1 && dados.itens.length === 4) {
    ok('Backup JSON gerado com 1 compra e 4 itens');
  } else {
    falhou('Backup inesperado: ' + JSON.stringify(Object.keys(dados)));
  }

  await page.screenshot({ path: 'captura-ajustes.png' });

  // ---------------------------------------------------- persistencia
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('ion-tab-button[tab="historico"]').click();
  await page.waitForTimeout(1500);
  const aposReload = await page.locator('.resumo strong').last().innerText();
  if (aposReload.includes('57,00')) ok('Dados sobreviveram ao recarregar a pagina (IndexedDB)');
  else falhou('Dados perdidos apos reload, li: ' + aposReload);
} catch (erro) {
  falhou('Excecao durante o teste', erro.message);
}

// ---------------------------------------------------------------- relatorio
console.log('\n================ RESULTADO ================');
console.log('Passos ok: ' + passos.length);
console.log('Falhas   : ' + falhas.length);
if (falhas.length) falhas.forEach((f) => console.log('  - ' + f));

const errosRelevantes = errosConsole.filter(
  (e) => !e.includes('favicon') && !e.includes('manifest') && !e.includes('service worker'),
);
if (errosRelevantes.length) {
  console.log('\nErros de console:');
  errosRelevantes.slice(0, 10).forEach((e) => console.log('  ! ' + e));
} else {
  console.log('Sem erros de console.');
}

await browser.close();
process.exit(falhas.length ? 1 : 0);
