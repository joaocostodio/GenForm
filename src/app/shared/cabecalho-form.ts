import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvisoService } from './aviso.service';

/** Barra do topo + abas "Perguntas | Respostas" usadas no editor e nas respostas. */
@Component({
  selector: 'app-cabecalho-form',
  imports: [RouterLink],
  template: `
    <header class="topo">
      <a routerLink="/" class="marca" title="Voltar para o painel">
        <span class="logo" aria-hidden="true">≡</span>
        <span class="nome">{{ titulo() || 'Formulário sem título' }}</span>
      </a>
      <span class="status">{{ status() }}</span>
      <span class="espaco"></span>
      <a class="btn-icone" [href]="'/f/' + formId()" target="_blank" title="Visualizar como respondente">👁</a>
      <button type="button" class="btn" (click)="aviso.copiarLink(formId())">Enviar</button>
    </header>
    <nav class="abas">
      <a [routerLink]="['/forms', formId(), 'editar']" [class.ativa]="aba() === 'perguntas'">Perguntas</a>
      <a [routerLink]="['/forms', formId(), 'respostas']" [class.ativa]="aba() === 'respostas'">
        Respostas
        @if (totalRespostas() !== null) {
          <span class="contador">{{ totalRespostas() }}</span>
        }
      </a>
    </nav>
  `,
  styles: `
    .nome {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--texto);
    }
    .contador {
      margin-left: 4px;
      padding: 1px 7px;
      border-radius: 10px;
      background: var(--cor);
      color: #fff;
      font-size: 12px;
    }
  `,
})
export class CabecalhoForm {
  protected readonly aviso = inject(AvisoService);

  readonly formId = input.required<string>();
  readonly titulo = input('');
  readonly aba = input<'perguntas' | 'respostas'>('perguntas');
  readonly status = input('');
  readonly totalRespostas = input<number | null>(null);
}
