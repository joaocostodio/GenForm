import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { caminhoInterno } from '../../core/auth';
import { AuthService } from '../../services/auth.service';

/** Tela de login e de cadastro (o modo vem da rota: /entrar ou /criar-conta). */
@Component({
  selector: 'app-entrar',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './entrar.html',
})
export class Entrar {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** data.modo da rota */
  readonly modo = input<'entrar' | 'cadastro'>('entrar');
  /** ?voltar=/f/abc — para onde ir depois de entrar */
  readonly voltar = input<string>();

  protected readonly cadastro = computed(() => this.modo() === 'cadastro');
  protected readonly enviando = signal(false);
  protected readonly erroGeral = signal('');
  protected readonly mostrarSenha = signal(false);

  protected readonly form = this.fb.group({
    nome: ['', [Validators.maxLength(80)]],
    email: ['', [Validators.required, Validators.email]],
    senha: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected erro(campo: 'nome' | 'email' | 'senha'): string {
    const c = this.form.controls[campo];
    if (!c.touched || !c.errors) return '';
    if (c.errors['servidor']) return c.errors['servidor'];
    if (c.errors['required']) return 'Campo obrigatório';
    if (c.errors['email']) return 'E-mail inválido';
    if (c.errors['minlength']) return 'Use pelo menos 8 caracteres';
    return 'Valor inválido';
  }

  enviar() {
    const { nome, email, senha } = this.form.getRawValue();
    // O nome só é obrigatório no cadastro.
    if (this.cadastro() && !nome.trim()) this.form.controls.nome.setErrors({ required: true });
    this.form.markAllAsTouched();
    if (this.form.invalid || this.enviando()) return;

    this.enviando.set(true);
    this.erroGeral.set('');
    const pedido = this.cadastro() ? this.auth.cadastrar(nome, email, senha) : this.auth.entrar(email, senha);
    pedido.subscribe({
      next: () => this.router.navigateByUrl(caminhoInterno(this.voltar())),
      error: (erro: HttpErrorResponse) => {
        this.enviando.set(false);
        const porCampo = (erro.error?.erros ?? {}) as Record<string, string>;
        for (const [campo, msg] of Object.entries(porCampo)) {
          const c = this.form.get(campo);
          c?.setErrors({ servidor: msg });
          c?.markAsTouched();
        }
        if (!Object.keys(porCampo).length) {
          this.erroGeral.set(erro.status === 0 ? 'Servidor fora do ar. Tente de novo.' : (erro.error?.erro ?? 'Não foi possível continuar'));
        }
      },
    });
  }
}
