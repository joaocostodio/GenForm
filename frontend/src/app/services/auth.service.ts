import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, tap } from 'rxjs';
import { Usuario } from '../models/formulario';

/**
 * Sessão do usuário. A sessão em si é um cookie httpOnly que o backend cria;
 * aqui só guardamos quem está logado para a interface saber o que mostrar.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly usuario = signal<Usuario | null>(null);
  readonly logado = computed(() => this.usuario() !== null);

  /** Chamado uma vez ao abrir o app (ver app.config.ts). */
  async carregar() {
    try {
      const { usuario } = await firstValueFrom(this.http.get<{ usuario: Usuario | null }>('/api/auth/eu'));
      this.usuario.set(usuario);
    } catch {
      this.usuario.set(null); // backend fora do ar: segue como visitante
    }
  }

  entrar(email: string, senha: string) {
    return this.http
      .post<{ usuario: Usuario }>('/api/auth/login', { email, senha })
      .pipe(tap(({ usuario }) => this.usuario.set(usuario)));
  }

  cadastrar(nome: string, email: string, senha: string) {
    return this.http
      .post<{ usuario: Usuario }>('/api/auth/cadastro', { nome, email, senha })
      .pipe(tap(({ usuario }) => this.usuario.set(usuario)));
  }

  atualizar(dados: { nome?: string; senhaAtual?: string; novaSenha?: string }) {
    return this.http.put<{ usuario: Usuario }>('/api/auth/eu', dados).pipe(tap(({ usuario }) => this.usuario.set(usuario)));
  }

  sair() {
    return this.http.post<void>('/api/auth/logout', {}).pipe(tap(() => this.usuario.set(null)));
  }

  /** Sessão expirou no meio do uso. */
  esquecer() {
    this.usuario.set(null);
  }
}
