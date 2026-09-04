import { Injectable, inject } from '@angular/core';
import { db } from '../db/app-db';
import { ItemLista, Lista, totalDoItem } from '../models/lista.model';
import { ListaRepository } from '../repositories/lista.repository';

/**
 * Estrutura do arquivo de backup. A versao permite migrar formatos antigos
 * quando o modelo mudar, sem quebrar backups ja salvos pelo usuario.
 */
export interface ArquivoBackup {
  formato: 'compras-app';
  versao: number;
  geradoEm: string;
  produtos: unknown[];
  listas: unknown[];
  itens: unknown[];
}

export interface ResultadoImportacao {
  produtos: number;
  listas: number;
  itens: number;
}

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly listaRepo = inject(ListaRepository);

  // ----------------------------------------------------------------- CSV

  /** Uma linha por item comprado: a base para qualquer analise em planilha. */
  async csvItens(): Promise<string> {
    const listas = await this.listaRepo.listarFinalizadas();
    const linhas: string[][] = [
      [
        'Data',
        'Compra',
        'Tipo',
        'Local',
        'Produto',
        'Quantidade',
        'Unidade',
        'Preco unitario',
        'Total',
        'Fora da lista',
      ],
    ];

    for (const lista of listas) {
      const itens = await this.listaRepo.itensDaLista(lista.id!);
      for (const item of itens.filter((i) => i.comprado)) {
        linhas.push([
          formatarData(item.compradoEm ?? lista.finalizadaEm),
          lista.nome,
          lista.tipo,
          lista.local ?? '',
          item.nomeProduto,
          numeroBr(item.quantidadeComprada ?? item.quantidadePlanejada),
          item.unidade,
          numeroBr(item.precoUnitario ?? 0),
          numeroBr(totalDoItem(item)),
          item.foraDaLista ? 'sim' : 'nao',
        ]);
      }
    }

    return montarCsv(linhas);
  }

  /** Uma linha por compra: visao de quanto foi gasto e quando. */
  async csvCompras(): Promise<string> {
    const listas = await this.listaRepo.listarFinalizadas();
    const linhas: string[][] = [
      ['Data', 'Compra', 'Tipo', 'Local', 'Itens comprados', 'Total gasto', 'Orcamento'],
    ];

    for (const lista of listas) {
      linhas.push([
        formatarData(lista.finalizadaEm),
        lista.nome,
        lista.tipo,
        lista.local ?? '',
        String(lista.totalItensComprados ?? 0),
        numeroBr(lista.totalGasto ?? 0),
        lista.orcamento != null ? numeroBr(lista.orcamento) : '',
      ]);
    }

    return montarCsv(linhas);
  }

  // -------------------------------------------------------------- backup

  async gerarBackup(): Promise<ArquivoBackup> {
    const [produtos, listas, itens] = await Promise.all([
      db.produtos.toArray(),
      db.listas.toArray(),
      db.itens.toArray(),
    ]);

    return {
      formato: 'compras-app',
      versao: 1,
      geradoEm: new Date().toISOString(),
      produtos,
      listas,
      itens,
    };
  }

  /**
   * Restaura um backup substituindo TUDO que existe hoje.
   * Roda dentro de uma transacao: se qualquer parte falhar, nada e gravado.
   */
  async restaurarBackup(conteudo: string): Promise<ResultadoImportacao> {
    let dados: ArquivoBackup;
    try {
      dados = JSON.parse(conteudo);
    } catch {
      throw new Error('Arquivo invalido: nao e um JSON.');
    }

    if (dados?.formato !== 'compras-app') {
      // O identificador gravado no arquivo continua sendo `compras-app`:
      // mudar quebraria os backups que o usuario ja tem guardados.
      throw new Error('Este arquivo nao e um backup do ListAqui.');
    }
    if (!Array.isArray(dados.listas) || !Array.isArray(dados.itens)) {
      throw new Error('Backup incompleto ou corrompido.');
    }

    await db.transaction('rw', db.produtos, db.listas, db.itens, async () => {
      await Promise.all([db.produtos.clear(), db.listas.clear(), db.itens.clear()]);
      if (dados.produtos?.length) await db.produtos.bulkAdd(dados.produtos as never[]);
      if (dados.listas.length) await db.listas.bulkAdd(dados.listas as Lista[]);
      if (dados.itens.length) await db.itens.bulkAdd(dados.itens as ItemLista[]);
    });

    return {
      produtos: dados.produtos?.length ?? 0,
      listas: dados.listas.length,
      itens: dados.itens.length,
    };
  }

  async limparTudo(): Promise<void> {
    await db.transaction('rw', db.produtos, db.listas, db.itens, async () => {
      await Promise.all([db.produtos.clear(), db.listas.clear(), db.itens.clear()]);
    });
  }

  // ------------------------------------------------------------- download

  /**
   * Dispara o download no navegador.
   * No Chrome do Android isso cai direto na pasta Downloads e o arquivo
   * pode ser compartilhado por qualquer app.
   */
  baixar(nomeArquivo: string, conteudo: string, tipoMime: string): void {
    // BOM no inicio: sem ele o Excel abre acentuacao como caractere quebrado.
    const bom = tipoMime.includes('csv') ? '\uFEFF' : '';
    const blob = new Blob([bom + conteudo], { type: `${tipoMime};charset=utf-8` });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Libera a memoria do blob depois que o navegador iniciou o download.
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  carimboArquivo(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}

/**
 * CSV no dialeto que o Excel brasileiro entende:
 * separador ponto-e-virgula (porque a virgula e o separador decimal).
 */
function montarCsv(linhas: string[][]): string {
  return linhas.map((linha) => linha.map(escapar).join(';')).join('\r\n');
}

function escapar(valor: string): string {
  const v = valor ?? '';
  return /[";\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function numeroBr(valor: number): string {
  return valor.toFixed(2).replace('.', ',');
}

function formatarData(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
