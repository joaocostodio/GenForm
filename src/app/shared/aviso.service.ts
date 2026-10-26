import { Injectable, signal } from '@angular/core';

/** Mensagem curta no canto da tela (ex: "Link copiado"). */
@Injectable({ providedIn: 'root' })
export class AvisoService {
  readonly mensagem = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  mostrar(texto: string) {
    clearTimeout(this.timer);
    this.mensagem.set(texto);
    this.timer = setTimeout(() => this.mensagem.set(''), 3000);
  }

  async copiarLink(formId: string) {
    const link = linkResposta(formId);
    try {
      await navigator.clipboard.writeText(link);
      this.mostrar('Link copiado');
    } catch {
      // Sem permissão de área de transferência (ex: fora de HTTPS): mostra o link
      this.mostrar(link);
    }
  }
}

export function linkResposta(formId: string) {
  return `${location.origin}/f/${formId}`;
}
