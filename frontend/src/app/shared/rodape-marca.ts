import { Component, inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { PaletaService } from './paleta-comandos';

/** Autor do GenForm: aparece como marca d'água no rodapé de todas as telas. */
export const AUTOR = 'joaoklebermoraes123@gmail.com';
export const VERSAO = '2.0.0';

/**
 * Barra do rodapé no estilo da Hidra: a marca à esquerda e,
 * sempre no canto direito, a marca d'água "criado por ...".
 */
@Component({
  selector: 'app-rodape-marca',
  host: { class: 'rodape-marca', role: 'contentinfo' },
  template: `
    <span class="marca-rodape">
      <img src="hidra.svg" alt="" width="14" height="14" />
      <span class="nome-marca"><b>Gen</b><em>Form</em></span>
    </span>
    <span class="sep" aria-hidden="true"></span>
    <span class="tres-cabecas" aria-hidden="true"><i></i><i></i><i></i></span>
    @if (auth.usuario()) {
      <button type="button" class="dica-k" (click)="paleta.abrir()" title="Paleta de comandos">
        <kbd>Ctrl</kbd><kbd>K</kbd> comandos
      </button>
    }
    <span class="espaco"></span>
    <span class="watermark">criado por {{ autor }} · v{{ versao }}</span>
  `,
  styles: `
    :host {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 40;
      display: flex;
      align-items: center;
      gap: 12px;
      height: 28px;
      padding: 0 12px;
      border-top: 1px solid var(--borda);
      background: #111217;
      color: var(--texto-suave);
      font-size: 11.5px;
      white-space: nowrap;
      overflow: hidden;
    }
    .marca-rodape {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--texto);
    }
    .sep {
      flex: none;
      width: 1px;
      height: 14px;
      background: var(--borda-forte);
    }
    .dica-k {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 6px;
      border: 0;
      border-radius: 5px;
      background: none;
      color: var(--texto-suave);
      font-size: 11.5px;
      cursor: pointer;
    }
    .dica-k:hover {
      background: var(--superficie-2);
      color: var(--texto);
    }
    .dica-k kbd {
      height: 16px;
      min-width: 16px;
      font-size: 10px;
    }
    .watermark {
      flex: none;
      padding-left: 12px;
      margin-left: 2px;
      border-left: 1px solid var(--borda-forte);
      color: var(--prata-escura);
      opacity: 0.8;
      letter-spacing: 0.01em;
      user-select: none;
    }
    @media (max-width: 600px) {
      .tres-cabecas,
      .sep,
      .dica-k {
        display: none;
      }
    }
  `,
})
export class RodapeMarca {
  protected readonly auth = inject(AuthService);
  protected readonly paleta = inject(PaletaService);
  protected readonly autor = AUTOR;
  protected readonly versao = VERSAO;
}
