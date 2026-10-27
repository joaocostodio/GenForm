import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Avatar com a inicial do nome; ao clicar abre o menu com "Minha conta" e "Sair". */
@Component({
  selector: 'app-menu-usuario',
  imports: [RouterLink],
  host: { '(document:click)': 'fecharSeFora($event)', '(document:keydown.escape)': 'aberto.set(false)' },
  template: `
    @if (auth.usuario(); as u) {
      <button
        type="button"
        class="avatar"
        (click)="aberto.set(!aberto())"
        [attr.aria-expanded]="aberto()"
        aria-haspopup="menu"
        [title]="u.nome + ' (' + u.email + ')'"
      >
        {{ inicial() }}
      </button>
      @if (aberto()) {
        <div class="menu" role="menu">
          <div class="quem">
            <strong>{{ u.nome }}</strong>
            <span class="suave">{{ u.email }}</span>
          </div>
          <a role="menuitem" routerLink="/" (click)="aberto.set(false)">Meus formulários</a>
          <a role="menuitem" routerLink="/conta" (click)="aberto.set(false)">Minha conta</a>
          <button type="button" role="menuitem" (click)="sair()">Sair</button>
        </div>
      }
    } @else {
      <a class="btn contorno" routerLink="/entrar">Entrar</a>
    }
  `,
  styles: `
    :host {
      position: relative;
    }
    .avatar {
      width: 36px;
      height: 36px;
      border: 0;
      border-radius: 50%;
      background: var(--cor);
      color: #fff;
      font-weight: 700;
      cursor: pointer;
    }
    .menu {
      position: absolute;
      right: 0;
      top: 44px;
      z-index: 30;
      min-width: 240px;
      padding: 8px 0;
      border-radius: var(--raio);
      background: #fff;
      box-shadow: 0 4px 16px rgb(0 0 0 / 20%);
    }
    .quem {
      display: flex;
      flex-direction: column;
      padding: 8px 16px 12px;
      border-bottom: 1px solid var(--borda);
      margin-bottom: 4px;
    }
    .menu a,
    .menu button {
      display: block;
      width: 100%;
      padding: 10px 16px;
      border: 0;
      background: none;
      text-align: left;
      text-decoration: none;
      cursor: pointer;
    }
    .menu a:hover,
    .menu button:hover {
      background: #f1f3f4;
    }
  `,
})
export class MenuUsuario {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly el = inject(ElementRef<HTMLElement>);

  protected readonly aberto = signal(false);
  protected readonly inicial = computed(() => (this.auth.usuario()?.nome.trim()[0] ?? '?').toUpperCase());

  protected fecharSeFora(evento: Event) {
    if (!this.el.nativeElement.contains(evento.target as Node)) this.aberto.set(false);
  }

  protected sair() {
    this.aberto.set(false);
    this.auth.sair().subscribe(() => this.router.navigate(['/entrar']));
  }
}
