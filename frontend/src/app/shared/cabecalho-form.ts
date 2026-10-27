import { Component, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Compartilhar } from './compartilhar';
import { MenuUsuario } from './menu-usuario';

export type AbaForm = 'perguntas' | 'respostas' | 'configuracoes';

/** Barra do topo + abas "Perguntas | Respostas | Configurações" das telas de um formulário. */
@Component({
  selector: 'app-cabecalho-form',
  imports: [RouterLink, Compartilhar, MenuUsuario],
  template: `
    <header class="topo">
      <a routerLink="/" class="marca" title="Voltar para meus formulários">
        <span class="logo" aria-hidden="true">≡</span>
        <span class="nome">{{ titulo() || 'Formulário sem título' }}</span>
      </a>
      <span class="status">{{ status() }}</span>
      <span class="espaco"></span>
      <a class="btn-icone" [href]="'/f/' + formId()" target="_blank" title="Visualizar como respondente">👁</a>
      <button type="button" class="btn" (click)="compartilhar().abrir()">Enviar</button>
      <app-menu-usuario />
    </header>
    <nav class="abas">
      <a [routerLink]="['/forms', formId(), 'editar']" [class.ativa]="aba() === 'perguntas'">Perguntas</a>
      <a [routerLink]="['/forms', formId(), 'respostas']" [class.ativa]="aba() === 'respostas'">
        Respostas
        @if (totalRespostas() !== null) {
          <span class="contador">{{ totalRespostas() }}</span>
        }
      </a>
      <a [routerLink]="['/forms', formId(), 'configuracoes']" [class.ativa]="aba() === 'configuracoes'">Configurações</a>
    </nav>
    <app-compartilhar [formId]="formId()" [exigeLogin]="exigeLogin()" />
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
  protected readonly compartilhar = viewChild.required(Compartilhar);

  readonly formId = input.required<string>();
  readonly titulo = input('');
  readonly aba = input<AbaForm>('perguntas');
  readonly status = input('');
  readonly totalRespostas = input<number | null>(null);
  readonly exigeLogin = input(false);
}
