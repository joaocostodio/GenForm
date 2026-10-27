import { Injectable, signal } from '@angular/core';

/** Mensagem curta no canto da tela (ex: "Link copiado"). */
@Injectable({ providedIn: 'root' })
export class AvisoService {
  readonly mensagem = signal('');
  private timer?: ReturnType<typeof setTimeout>;

  mostrar(texto: string) {
    clearTimeout(this.timer);
    this.mensagem.set(texto);
    this.timer = setTimeout(() => this.mensagem.set(''), 3500);
  }

  async copiar(texto: string, mensagem = 'Copiado') {
    try {
      await navigator.clipboard.writeText(texto);
      this.mostrar(mensagem);
    } catch {
      // Sem permissão de área de transferência (ex: fora de HTTPS)
      this.mostrar('Não deu para copiar automaticamente. Selecione o texto e copie com Ctrl+C.');
    }
  }
}
