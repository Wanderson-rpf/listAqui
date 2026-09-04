/**
 * Liga o Enter do teclado a acao de confirmar de um ion-alert.
 *
 * Por que existe: o ion-alert nao envia no Enter. No celular a pessoa
 * digita, aperta a tecla e nada acontece - e em varias telas o botao de
 * confirmar fica no topo, longe do polegar.
 *
 * Convencao do projeto: no ultimo (ou unico) campo de um formulario, o
 * Enter confirma. Em ion-input dentro de template isso e feito direto com
 * `(keyup.enter)="salvar()"`; aqui e o equivalente para alertas, cujo
 * conteudo o Ionic monta sozinho.
 *
 * @param alerta   O alerta ja apresentado (o DOM so existe apos present()).
 * @param acao     Recebe os valores digitados, na ordem dos inputs.
 * @param indice   Qual campo responde ao Enter. Por padrao o ultimo.
 */
export function enviarNoEnter(
  alerta: HTMLIonAlertElement,
  acao: (valores: string[]) => void | Promise<void>,
  indice?: number,
): void {
  const campos = Array.from(alerta.querySelectorAll('input'));
  if (!campos.length) return;

  const alvo = campos[indice ?? campos.length - 1];
  alvo.setAttribute('enterkeyhint', 'done');

  alvo.addEventListener('keyup', async (evento) => {
    if ((evento as KeyboardEvent).key !== 'Enter') return;
    await acao(campos.map((campo) => campo.value ?? ''));
  });
}
