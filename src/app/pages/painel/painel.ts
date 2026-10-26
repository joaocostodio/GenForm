import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormularioEntrada, FormularioResumo, MODELOS } from '../../models/formulario';
import { FormulariosService } from '../../services/formularios.service';
import { AvisoService } from '../../shared/aviso.service';

@Component({
  selector: 'app-painel',
  imports: [RouterLink, DatePipe],
  templateUrl: './painel.html',
  styleUrl: './painel.css',
})
export class Painel {
  private readonly api = inject(FormulariosService);
  private readonly router = inject(Router);
  protected readonly aviso = inject(AvisoService);

  protected readonly modelos = MODELOS;
  protected readonly forms = signal<FormularioResumo[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal(false);
  protected readonly criando = signal(false);

  constructor() {
    this.carregar();
  }

  carregar() {
    this.carregando.set(true);
    this.erro.set(false);
    this.api.listar().subscribe({
      next: (lista) => {
        this.forms.set(lista);
        this.carregando.set(false);
      },
      error: () => {
        this.erro.set(true);
        this.carregando.set(false);
      },
    });
  }

  criar(dados: Partial<FormularioEntrada> = {}) {
    if (this.criando()) return;
    this.criando.set(true);
    this.api.criar(dados).subscribe({
      next: (form) => this.router.navigate(['/forms', form.id, 'editar']),
      error: () => {
        this.criando.set(false);
        this.aviso.mostrar('Não foi possível criar o formulário');
      },
    });
  }

  excluir(form: FormularioResumo) {
    if (!confirm(`Excluir "${form.titulo}" e todas as respostas? Isso não pode ser desfeito.`)) return;
    this.api.excluir(form.id).subscribe({
      next: () => {
        this.forms.update((lista) => lista.filter((f) => f.id !== form.id));
        this.aviso.mostrar('Formulário excluído');
      },
      error: () => this.aviso.mostrar('Não foi possível excluir'),
    });
  }
}
