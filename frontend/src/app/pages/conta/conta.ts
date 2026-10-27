import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AvisoService } from '../../shared/aviso.service';
import { MenuUsuario } from '../../shared/menu-usuario';

/** Minha conta: trocar nome, trocar senha e sair. */
@Component({
  selector: 'app-conta',
  imports: [ReactiveFormsModule, RouterLink, MenuUsuario],
  templateUrl: './conta.html',
})
export class Conta {
  protected readonly auth = inject(AuthService);
  private readonly aviso = inject(AvisoService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly salvandoNome = signal(false);
  protected readonly salvandoSenha = signal(false);

  protected readonly formNome = this.fb.group({
    nome: [this.auth.usuario()?.nome ?? '', [Validators.required, Validators.maxLength(80)]],
  });

  protected readonly formSenha = this.fb.group({
    senhaAtual: ['', Validators.required],
    novaSenha: ['', [Validators.required, Validators.minLength(8)]],
  });

  salvarNome() {
    if (this.formNome.invalid) return;
    this.salvandoNome.set(true);
    this.auth.atualizar({ nome: this.formNome.getRawValue().nome }).subscribe({
      next: () => {
        this.salvandoNome.set(false);
        this.formNome.markAsPristine();
        this.aviso.mostrar('Nome atualizado');
      },
      error: () => {
        this.salvandoNome.set(false);
        this.aviso.mostrar('Não foi possível salvar');
      },
    });
  }

  trocarSenha() {
    this.formSenha.markAllAsTouched();
    if (this.formSenha.invalid) return;
    this.salvandoSenha.set(true);
    this.auth.atualizar(this.formSenha.getRawValue()).subscribe({
      next: () => {
        this.salvandoSenha.set(false);
        this.formSenha.reset();
        this.aviso.mostrar('Senha alterada. As outras sessões foram encerradas.');
      },
      error: (erro: HttpErrorResponse) => {
        this.salvandoSenha.set(false);
        for (const [campo, msg] of Object.entries((erro.error?.erros ?? {}) as Record<string, string>)) {
          this.formSenha.get(campo)?.setErrors({ servidor: msg });
        }
      },
    });
  }

  erroSenha(campo: 'senhaAtual' | 'novaSenha') {
    const c = this.formSenha.controls[campo];
    if (!c.touched || !c.errors) return '';
    return c.errors['servidor'] ?? (c.errors['minlength'] ? 'Use pelo menos 8 caracteres' : 'Campo obrigatório');
  }

  sair() {
    this.auth.sair().subscribe(() => this.router.navigate(['/entrar']));
  }
}
