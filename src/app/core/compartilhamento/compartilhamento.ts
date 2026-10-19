import { ItemLista, Lista, ListaCompartilhada, TIPOS_LISTA } from '../models/lista.model';
import { UNIDADES, UnidadeMedida, normalizarNome } from '../models/produto.model';

/**
 * Envio de lista entre aparelhos sem backend: a lista inteira viaja dentro
 * do link, no fragmento (`#...`). O fragmento nunca e enviado ao servidor,
 * entao os dados ficam so entre os dois celulares.
 *
 * O mesmo codigo serve para colar a mao (opcao "Receber lista"). Isso cobre
 * o iPhone, onde o app instalado na tela inicial nao enxerga os dados do
 * Safari - e e no Safari que o link abre.
 *
 * Formato do codigo: 1 caractere de modo + base64url.
 *   z -> JSON comprimido com deflate-raw
 *   p -> JSON puro (navegador sem CompressionStream)
 *
 * Link e contrato, como o backup: um link ja enviado precisa continuar
 * importavel. Mudar o JSON exige subir `VERSAO` e ler a anterior.
 */

const FORMATO = 'listaqui-lista';
const VERSAO = 1;

/** Limites defensivos: o conteudo vem de fora e vira dado gravado aqui. */
const MAX_ITENS = 300;
const MAX_TEXTO = 120;

/** Item compacto: [nome, unidade, quantidade, observacao?]. Encurta o link. */
type ItemCompacto = [string, string, number, string?];

interface Pacote {
  f: typeof FORMATO;
  v: number;
  n: string;
  t: string;
  l?: string;
  o?: string;
  i: ItemCompacto[];
}

const PADRAO_CODIGO = /^[zp][A-Za-z0-9_-]+$/;

export async function codificarLista(lista: Lista, itens: ItemLista[]): Promise<string> {
  const pacote: Pacote = {
    f: FORMATO,
    v: VERSAO,
    n: lista.nome,
    t: lista.tipo,
    i: itens.map((item) => {
      const compacto: ItemCompacto = [item.nomeProduto, item.unidade, item.quantidadePlanejada];
      if (item.observacao) compacto.push(item.observacao);
      return compacto;
    }),
  };
  if (lista.local) pacote.l = lista.local;
  if (lista.observacao) pacote.o = lista.observacao;

  const bytes = new TextEncoder().encode(JSON.stringify(pacote));
  if (typeof CompressionStream === 'undefined') return 'p' + paraBase64Url(bytes);
  return 'z' + paraBase64Url(await transformar(bytes, new CompressionStream('deflate-raw')));
}

/** Link absoluto que abre a tela de recebimento, respeitando o base-href. */
export function montarLink(codigo: string): string {
  return new URL(`receber#${codigo}`, document.baseURI).toString();
}

/**
 * Acha o codigo num texto colado: o link inteiro, a mensagem do WhatsApp
 * com o link no meio, ou so o codigo.
 */
export function extrairCodigo(texto: string): string | null {
  const limpo = (texto ?? '').trim();
  if (PADRAO_CODIGO.test(limpo)) return limpo;
  const doLink = limpo.match(/#([zp][A-Za-z0-9_-]+)/);
  return doLink ? doLink[1] : null;
}

/** Lanca Error com mensagem pronta para mostrar ao usuario. */
export async function decodificarLista(codigo: string): Promise<ListaCompartilhada> {
  if (!PADRAO_CODIGO.test(codigo)) throw new Error('Link incompleto ou invalido.');
  const comprimido = codigo[0] === 'z';
  if (comprimido && typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador e antigo demais para abrir o link.');
  }

  let pacote: Pacote;
  try {
    let bytes = deBase64Url(codigo.slice(1));
    if (comprimido) bytes = await transformar(bytes, new DecompressionStream('deflate-raw'));
    pacote = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    // Link cortado no meio pelo app de mensagem e o caso mais comum aqui.
    throw new Error('Link incompleto ou invalido. Peca para enviarem de novo.');
  }

  if (pacote?.f !== FORMATO || !Array.isArray(pacote.i)) {
    throw new Error('Este link nao e uma lista do ListAqui.');
  }
  if (pacote.v > VERSAO) {
    throw new Error('Esta lista veio de uma versao mais nova do app. Atualize o ListAqui.');
  }

  const itens = pacote.i
    .slice(0, MAX_ITENS)
    .filter((i) => Array.isArray(i) && typeof i[0] === 'string' && i[0].trim())
    .map(([nome, unidade, qtd, obs]) => ({
      nomeProduto: texto(nome)!,
      unidade: unidadeValida(unidade),
      quantidadePlanejada: typeof qtd === 'number' && qtd > 0 && qtd < 10000 ? qtd : 1,
      observacao: texto(obs),
    }));

  return {
    nome: texto(pacote.n) || 'Lista recebida',
    tipo: TIPOS_LISTA.some((t) => t.valor === pacote.t) ? (pacote.t as Lista['tipo']) : 'avulsa',
    local: texto(pacote.l),
    observacao: texto(pacote.o),
    itens,
  };
}

// ----------------------------------------------------------------- mescla

type ItemRecebido = ListaCompartilhada['itens'][number];

/** O que fazer com cada item recebido ao mesclar com uma lista local. */
export type PassoMescla =
  | { tipo: 'novo'; recebido: ItemRecebido }
  | { tipo: 'atualizar'; recebido: ItemRecebido; local: ItemLista; mudancas: Partial<ItemLista> }
  | { tipo: 'manter'; recebido: ItemRecebido; local: ItemLista };

/**
 * Regra unica da mescla, usada pela previa e pela gravacao - assim o que a
 * tela promete e exatamente o que o repositorio faz.
 *
 * Casa pelo nome normalizado. Repetido fica com a maior quantidade, nao a
 * soma: o caso tipico e a mesma lista indo e voltando entre duas pessoas.
 * Item ja riscado ou de unidade diferente (2 un x 0,5 kg) nao e tocado.
 */
export function planejarMescla(locais: ItemLista[], recebidos: ItemRecebido[]): PassoMescla[] {
  const porNome = new Map(locais.map((i) => [normalizarNome(i.nomeProduto), i]));
  const vistos = new Set<string>();

  return recebidos.flatMap((recebido): PassoMescla[] => {
    const chave = normalizarNome(recebido.nomeProduto);
    // Repetido dentro da propria lista recebida: o primeiro vale.
    if (vistos.has(chave)) return [];
    vistos.add(chave);

    const local = porNome.get(chave);
    if (!local) return [{ tipo: 'novo', recebido }];
    if (local.comprado || local.unidade !== recebido.unidade) {
      return [{ tipo: 'manter', recebido, local }];
    }

    const mudancas: Partial<ItemLista> = {};
    if (recebido.quantidadePlanejada > local.quantidadePlanejada) {
      mudancas.quantidadePlanejada = recebido.quantidadePlanejada;
    }
    if (!local.observacao && recebido.observacao) mudancas.observacao = recebido.observacao;

    return Object.keys(mudancas).length
      ? [{ tipo: 'atualizar', recebido, local, mudancas }]
      : [{ tipo: 'manter', recebido, local }];
  });
}

// ---------------------------------------------------------------- helpers

function texto(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  return valor.trim().slice(0, MAX_TEXTO) || undefined;
}

function unidadeValida(valor: unknown): UnidadeMedida {
  return UNIDADES.find((u) => u.sigla === valor)?.sigla ?? 'un';
}

async function transformar(
  bytes: Uint8Array,
  fluxo: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const saida = new Blob([bytes as BlobPart]).stream().pipeThrough(fluxo);
  return new Uint8Array(await new Response(saida).arrayBuffer());
}

/** base64url: sem `+`, `/` e `=`, que quebram em URL e em app de mensagem. */
function paraBase64Url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(valor: string): Uint8Array {
  const base64 = valor.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}
