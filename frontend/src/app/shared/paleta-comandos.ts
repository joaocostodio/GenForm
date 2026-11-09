import { Component, ElementRef, Injectable, computed, effect, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { FormularioResumo } from '../models/formulario';
import { AuthService } from '../services/auth.service';
import { FormulariosService } from '../services/formularios.service';
import { AvisoService } from './aviso.service';
import { EnderecoService } from './endereco.service';

/** Abre e fecha a paleta de qualquer lugar (ex: a dica no rodapé). */
@Injectable({ providedIn: 'root' })
export class PaletaService {
  readonly aberta = signal(false);
  abrir() {
    this.aberta.set(true);
  }
  fechar() {
    this.aberta.set(false);
  }
}

interface Comando {
  grupo: string;
  icone: string;
  titulo: string;
  dica?: string;
  executar: () => void;
}

/** Tira acentos e caixa, para "configuracoes" achar "Configurações". */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Paleta de comandos (Ctrl+K), como num editor de código:
 * digite para achar um formulário ou uma ação e aperte Enter.
 */
@Component({
  selector: 'app-paleta-comandos',
  host: { '(document:keydown)': 'atalho($event)' },
  template: `
    @if (paleta.aberta()) {
      <div class="fundo" (click)="paleta.fechar()"></div>
      <div class="paleta" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <label class="busca">
          <span class="prompt" aria-hidden="true">›</span>
          <input
            #campo
            [value]="busca()"
            (input)="digitou($any($event.target).value)"
            (keydown)="navegar($event)"
            placeholder="Buscar formulário ou ação..."
            aria-label="Buscar comando"
            role="combobox"
            aria-controls="lista-comandos"
            [attr.aria-activedescendant]="'cmd-' + selecionado()"
            autocomplete="off"
            spellcheck="false"
          />
          <kbd>Esc</kbd>
        </label>
        <ul id="lista-comandos" role="listbox">
          @for (c of filtrados(); track c.grupo + c.titulo; let i = $index) {
            @if (i === 0 || filtrados()[i - 1].grupo !== c.grupo) {
              <li class="grupo" role="presentation">{{ c.grupo }}</li>
            }
            <li
              [id]="'cmd-' + i"
              role="option"
              [attr.aria-selected]="i === selecionado()"
              [class.ativo]="i === selecionado()"
              (mousemove)="selecionado.set(i)"
              (click)="executar(c)"
            >
              <span class="icone" aria-hidden="true">{{ c.icone }}</span>
              <span class="titulo">{{ c.titulo }}</span>
              @if (c.dica) {
                <span class="dica">{{ c.dica }}</span>
              }
            </li>
          } @empty {
            <li class="vazio-cmd">Nada encontrado para "{{ busca() }}"</li>
          }
        </ul>
        <footer>
          <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
          <span><kbd>Enter</kbd> abrir</span>
          <span class="espaco"></span>
          <span class="marca-cmd"><span class="tres-cabecas" aria-hidden="true"><i></i><i></i><i></i></span> GenForm</span>
        </footer>
      </div>
    }
  `,
  styles: `
    .fundo {
      position: fixed;
      inset: 0;
      z-index: 90;
      background: rgb(5 6 8 / 65%);
      backdrop-filter: blur(3px);
    }
    .paleta {
      position: fixed;
      top: 12vh;
      left: 50%;
      z-index: 91;
      width: min(620px, calc(100vw - 32px));
      transform: translateX(-50%);
      border: 1px solid var(--borda-forte);
      border-radius: 12px;
      background: var(--superficie);
      box-shadow: var(--sombra), 0 0 0 1px rgb(238 241 244 / 6%), 0 0 60px rgb(61 220 151 / 8%);
      overflow: hidden;
      animation: abre 0.14s ease-out;
    }
    .busca {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--borda);
    }
    .prompt {
      color: var(--verde);
      font-family: var(--mono);
      font-size: 20px;
      font-weight: 700;
    }
    .busca input {
      flex: 1;
      min-width: 0;
      border: 0;
      background: transparent;
      outline: none;
      font-family: var(--mono);
      font-size: 16px;
    }
    ul {
      list-style: none;
      max-height: min(420px, 55vh);
      margin: 0;
      padding: 6px;
      overflow-y: auto;
    }
    .grupo {
      padding: 10px 10px 4px;
      font-family: var(--mono);
      font-size: 10.5px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--prata-escura);
    }
    li[role='option'] {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 10px;
      border-radius: 8px;
      cursor: pointer;
    }
    li.ativo {
      background: var(--superficie-3);
      box-shadow: inset 2px 0 0 var(--verde);
    }
    .icone {
      width: 22px;
      text-align: center;
    }
    .titulo {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dica {
      font-family: var(--mono);
      font-size: 11px;
      color: var(--texto-suave);
      white-space: nowrap;
    }
    .vazio-cmd {
      padding: 24px;
      text-align: center;
      color: var(--texto-suave);
    }
    footer {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 8px 14px;
      border-top: 1px solid var(--borda);
      background: #111217;
      font-size: 12px;
      color: var(--texto-suave);
    }
    footer span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .marca-cmd {
      gap: 8px !important;
      color: var(--prata-escura);
    }
    @keyframes abre {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(-8px) scale(0.98);
      }
    }
    @media (max-width: 600px) {
      .paleta {
        top: 8px;
      }
      footer span:not(.marca-cmd):not(.espaco) {
        display: none;
      }
    }
  `,
})
export class PaletaComandos {
  protected readonly paleta = inject(PaletaService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(FormulariosService);
  private readonly aviso = inject(AvisoService);
  private readonly endereco = inject(EnderecoService);
  private readonly router = inject(Router);

  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  protected readonly busca = signal('');
  protected readonly selecionado = signal(0);
  private readonly forms = signal<FormularioResumo[]>([]);
  /** Formulário aberto na tela atual (/forms/:id/...), para as ações dele. */
  private readonly formAtual = signal<string | null>(null);

  constructor() {
    this.lerRota(this.router.url);
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => this.lerRota(e.urlAfterRedirects));

    // Ao abrir: busca a lista de formulários e põe o cursor no campo.
    effect(() => {
      if (!this.paleta.aberta()) return;
      this.busca.set('');
      this.selecionado.set(0);
      this.endereco.carregar();
      this.api.listar().subscribe({ next: (lista) => this.forms.set(lista), error: () => undefined });
      setTimeout(() => this.campo()?.nativeElement.focus());
    });
  }

  private lerRota(url: string) {
    this.formAtual.set(/^\/forms\/([^/]+)\//.exec(url)?.[1] ?? null);
  }

  private readonly comandos = computed<Comando[]>(() => {
    const ir = (caminho: unknown[]) => () => this.router.navigate(caminho);
    const lista: Comando[] = [];
    const id = this.formAtual();

    if (id) {
      const titulo = this.forms().find((f) => f.id === id)?.titulo ?? 'este formulário';
      const g = `Neste formulário · ${titulo}`;
      lista.push(
        { grupo: g, icone: '✎', titulo: 'Editar perguntas', executar: ir(['/forms', id, 'editar']) },
        { grupo: g, icone: '📊', titulo: 'Ver respostas', executar: ir(['/forms', id, 'respostas']) },
        { grupo: g, icone: '📡', titulo: 'Modo ao vivo', dica: 'projetar na sala', executar: ir(['/forms', id, 'ao-vivo']) },
        { grupo: g, icone: '⚙', titulo: 'Configurações', executar: ir(['/forms', id, 'configuracoes']) },
        { grupo: g, icone: '👁', titulo: 'Abrir como respondente', executar: () => open(`/f/${id}`, '_blank') },
        { grupo: g, icone: '🔗', titulo: 'Copiar link para responder', executar: () => this.aviso.copiar(this.endereco.link(id), 'Link copiado') },
      );
    }

    lista.push(
      { grupo: 'Ações', icone: '＋', titulo: 'Novo formulário em branco', executar: () => this.criar() },
      { grupo: 'Ações', icone: '▤', titulo: 'Meus formulários', executar: ir(['/']) },
      { grupo: 'Ações', icone: '👤', titulo: 'Minha conta', executar: ir(['/conta']) },
      {
        grupo: 'Ações',
        icone: '⏻',
        titulo: 'Sair da conta',
        executar: () => this.auth.sair().subscribe(() => this.router.navigate(['/entrar'])),
      },
    );

    for (const f of this.forms()) {
      lista.push({
        grupo: 'Formulários',
        icone: f.aceitandoRespostas ? '●' : '○',
        titulo: f.titulo,
        dica: `${f.totalRespostas} ${f.totalRespostas === 1 ? 'resposta' : 'respostas'}`,
        executar: ir(['/forms', f.id, 'editar']),
      });
    }
    return lista;
  });

  /** Todas as palavras digitadas precisam aparecer (em qualquer ordem). */
  protected readonly filtrados = computed(() => {
    const termos = normalizar(this.busca()).split(/\s+/).filter(Boolean);
    if (!termos.length) return this.comandos();
    return this.comandos().filter((c) => {
      const alvo = normalizar(`${c.titulo} ${c.grupo} ${c.dica ?? ''}`);
      return termos.every((t) => alvo.includes(t));
    });
  });

  protected digitou(valor: string) {
    this.busca.set(valor);
    this.selecionado.set(0);
  }

  protected atalho(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      if (!this.auth.usuario()) return;
      e.preventDefault();
      this.paleta.aberta.update((v) => !v);
    } else if (e.key === 'Escape' && this.paleta.aberta()) {
      this.paleta.fechar();
    }
  }

  protected navegar(e: KeyboardEvent) {
    const total = this.filtrados().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!total) return;
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      this.selecionado.update((i) => (i + passo + total) % total);
      setTimeout(() => document.getElementById(`cmd-${this.selecionado()}`)?.scrollIntoView({ block: 'nearest' }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const c = this.filtrados()[this.selecionado()];
      if (c) this.executar(c);
    }
  }

  protected executar(c: Comando) {
    this.paleta.fechar();
    c.executar();
  }

  private criar() {
    this.api.criar().subscribe({
      next: (f) => this.router.navigate(['/forms', f.id, 'editar']),
      error: () => this.aviso.mostrar('Não foi possível criar o formulário'),
    });
  }
}
