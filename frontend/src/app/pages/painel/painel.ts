import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormularioResumo, MODELOS, NovoForm } from '../../models/formulario';
import { AuthService } from '../../services/auth.service';
import { FormulariosService } from '../../services/formularios.service';
import { AvisoService } from '../../shared/aviso.service';
import { Compartilhar } from '../../shared/compartilhar';
import { MenuUsuario } from '../../shared/menu-usuario';

type Filtro = 'todos' | 'abertos' | 'fechados' | 'testes';
type Ordem = 'recentes' | 'nome' | 'respostas';

@Component({
  selector: 'app-painel',
  imports: [RouterLink, DatePipe, MenuUsuario, Compartilhar],
  templateUrl: './painel.html',
  styleUrl: './painel.css',
})
export class Painel {
  private readonly api = inject(FormulariosService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly aviso = inject(AvisoService);
  private readonly compartilhar = viewChild.required(Compartilhar);

  protected readonly modelos = MODELOS;
  protected readonly forms = signal<FormularioResumo[]>([]);
  protected readonly carregando = signal(true);
  protected readonly erro = signal(false);
  protected readonly criando = signal(false);
  protected readonly selecionado = signal('');

  // Busca, filtro e ordenação (tudo no navegador)
  protected readonly busca = signal('');
  protected readonly filtro = signal<Filtro>('todos');
  protected readonly ordem = signal<Ordem>('recentes');

  protected readonly visiveis = computed(() => {
    const termo = this.busca().trim().toLowerCase();
    const lista = this.forms().filter((f) => {
      if (termo && !`${f.titulo} ${f.descricao}`.toLowerCase().includes(termo)) return false;
      switch (this.filtro()) {
        case 'abertos': return f.aceitandoRespostas;
        case 'fechados': return !f.aceitandoRespostas;
        case 'testes': return f.modoTeste;
        default: return true;
      }
    });
    const ordem = this.ordem();
    return [...lista].sort((a, b) =>
      ordem === 'nome' ? a.titulo.localeCompare(b.titulo, 'pt-BR')
      : ordem === 'respostas' ? b.totalRespostas - a.totalRespostas
      : b.atualizadoEm.localeCompare(a.atualizadoEm),
    );
  });

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

  criar(dados: NovoForm = {}) {
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

  duplicar(form: FormularioResumo) {
    this.api.duplicar(form.id).subscribe({
      next: () => {
        this.aviso.mostrar('Formulário duplicado');
        this.carregar();
      },
      error: () => this.aviso.mostrar('Não foi possível duplicar'),
    });
  }

  enviar(form: FormularioResumo) {
    this.selecionado.set(form.id);
    this.compartilhar().abrir();
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

  lerTexto(evento: Event) {
    return (evento.target as HTMLInputElement | HTMLSelectElement).value;
  }
}
