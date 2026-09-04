import { Directive, ElementRef, HostListener, effect, inject, model } from '@angular/core';

/** Formato usado em todo campo de dinheiro do app. */
export function formatarReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Le apenas os digitos de um texto e devolve o valor em centavos. */
export function centavosDigitados(texto: unknown, maximoDigitos = 9): number {
  const digitos = String(texto ?? '')
    .replace(/\D/g, '')
    .slice(0, maximoDigitos);
  return Number(digitos || 0);
}

/**
 * Aplica a mascara a um input nativo. E o equivalente da diretiva para o
 * conteudo de um ion-alert, que o Ionic monta por conta propria e onde
 * nao ha template para receber `[(moeda)]`.
 */
export function aplicarMascaraMoedaEm(campo: HTMLInputElement): void {
  campo.setAttribute('inputmode', 'numeric');
  campo.type = 'text';

  campo.addEventListener('input', () => {
    const centavos = centavosDigitados(campo.value);
    campo.value = centavos ? formatarReais(centavos / 100) : '';
  });
}

/**
 * Mascara de moeda no padrao brasileiro: o usuario digita so numeros e os
 * sinais entram sozinhos (750 vira R$ 7,50; 1234567 vira R$ 12.345,67).
 *
 * Cada digito entra pela direita, como em caixa eletronico. O valor vive
 * em centavos - um inteiro - e so vira reais na saida: e o que evita a
 * ambiguidade de onde esta a virgula e o erro de somar float cru.
 *
 * Uso:
 *   <ion-input label="Orcamento" [(moeda)]="orcamento" />
 *
 * `moeda` e o valor em reais. type, inputmode e placeholder sao definidos
 * pela diretiva, entao nao precisam ser repetidos no template.
 */
@Directive({ selector: 'ion-input[moeda]' })
export class MoedaDirective {
  /** Valor em reais. Two-way: `[(moeda)]="orcamento"`. */
  readonly moeda = model<number>(0);

  private readonly campo = inject(ElementRef<HTMLElement>).nativeElement as {
    value?: string | number | null;
    type?: string;
    inputmode?: string;
    placeholder?: string;
  };

  constructor() {
    this.campo.type = 'text';
    this.campo.inputmode = 'numeric';
    if (!this.campo.placeholder) this.campo.placeholder = 'R$ 0,00';

    // Mantem o campo exibindo o valor formatado, inclusive quando quem
    // muda o valor e a tela (abrir para edicao, converter unidade...).
    effect(() => {
      const texto = this.textoDe(this.moeda());
      if (this.campo.value !== texto) this.campo.value = texto;
    });
  }

  /**
   * Reescrever o campo e necessario: quando o texto formatado nao muda
   * (o caso de teclar uma letra), o Angular nao redesenha o input e o
   * caractere invalido continuaria na tela.
   */
  @HostListener('ionInput', ['$event'])
  digitou(evento: Event): void {
    const alvo = evento.target as { value?: string | number | null };
    const reais = centavosDigitados(alvo.value) / 100;

    this.moeda.set(reais);
    alvo.value = this.textoDe(reais);
  }

  /** Zero fica vazio, para o placeholder aparecer. */
  private textoDe(reais: number): string {
    return reais ? formatarReais(reais) : '';
  }
}
