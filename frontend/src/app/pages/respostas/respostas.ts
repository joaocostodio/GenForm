import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Formulario, Pergunta, Resposta, ValorResposta } from '../../models/formulario';
import { FormulariosService } from '../../services/formularios.service';
import { AvisoService } from '../../shared/aviso.service';
import { CabecalhoForm } from '../../shared/cabecalho-form';
import { baixarArquivo, formatarValor, gerarCsv } from '../../shared/csv';
import { corrigivel, estaCerta, resumir } from '../../shared/resumo';

@Component({
  selector: 'app-respostas',
  imports: [CabecalhoForm, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './respostas.html',
  styleUrl: './respostas.css',
})
export class Respostas implements OnInit {
  private readonly api = inject(FormulariosService);
  private readonly aviso = inject(AvisoService);
  private readonly destroyRef = inject(DestroyRef);

  /** Vem da rota /forms/:id/respostas */
  readonly id = input.required<string>();

  protected readonly form = signal<Formulario | null>(null);
  protected readonly respostas = signal<Resposta[]>([]);
  protected readonly estado = signal<'carregando' | 'pronto' | 'erro'>('carregando');
  protected readonly aba = signal<'resumo' | 'individual'>('resumo');
  protected readonly indice = signal(0);
  protected readonly formatar = formatarValor;

  protected readonly perguntas = computed(() => this.form()?.secoes.flatMap((s) => s.perguntas) ?? []);
  protected readonly atual = computed(() => this.respostas()[this.indice()] ?? null);
  protected readonly modoTeste = computed(() => this.form()?.config.modoTeste ?? false);

  /** Média das notas (modo teste). */
  protected readonly media = computed(() => {
    const notas = this.respostas().map((r) => r.nota).filter((n) => n !== null);
    if (!notas.length) return null;
    return { pontos: notas.reduce((s, n) => s + n.pontos, 0) / notas.length, total: notas[0].total };
  });

  protected readonly resumo = computed(() => resumir(this.perguntas(), this.respostas(), this.modoTeste()));

  ngOnInit() {
    this.carregar();
    this.ouvirAoVivo();
  }

  carregar() {
    this.estado.set('carregando');
    forkJoin([this.api.buscar(this.id()), this.api.listarRespostas(this.id())]).subscribe({
      next: ([form, respostas]) => {
        this.form.set(form);
        this.respostas.set(respostas);
        this.indice.set(Math.max(0, respostas.length - 1));
        this.estado.set('pronto');
      },
      error: () => this.estado.set('erro'),
    });
  }

  /** As respostas novas aparecem sozinhas, sem precisar recarregar a página. */
  private ouvirAoVivo() {
    this.api
      .aoVivo(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((evento) => {
        if (evento.tipo === 'resposta') {
          if (this.respostas().some((r) => r.id === evento.resposta.id)) return;
          this.respostas.update((lista) => [...lista, evento.resposta]);
          this.aviso.mostrar('Nova resposta recebida');
        } else if (evento.tipo === 'recarregar' && this.estado() === 'pronto') {
          this.api.listarRespostas(this.id()).subscribe((lista) => {
            this.respostas.set(lista);
            this.indice.update((i) => Math.min(i, Math.max(0, lista.length - 1)));
          });
        }
      });
  }

  /** 200 -> "3min 20s" */
  duracao(segundos: number) {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return m ? `${m}min ${s}s` : `${s}s`;
  }

  // ---------- Modo teste ----------

  corrigivel(p: Pergunta) {
    return corrigivel(p);
  }

  estaCerta(p: Pergunta, v: ValorResposta | undefined) {
    return estaCerta(p, v);
  }

  // ---------- Ações ----------

  alternarAceitando(evento: Event) {
    const caixa = evento.target as HTMLInputElement;
    const aceitando = caixa.checked;
    this.api.salvarConfig(this.id(), { aceitandoRespostas: aceitando }).subscribe({
      next: (salvo) => {
        this.form.set(salvo);
        this.aviso.mostrar(aceitando ? 'Aceitando respostas' : 'Formulário fechado para respostas');
      },
      error: () => {
        caixa.checked = !aceitando;
        this.aviso.mostrar('Não foi possível alterar');
      },
    });
  }

  exportar() {
    const form = this.form();
    if (!form) return;
    const nome = form.titulo.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'respostas';
    baixarArquivo(`${nome}.csv`, gerarCsv(form, this.respostas()));
  }

  navegar(passo: number) {
    const total = this.respostas().length;
    this.indice.update((i) => Math.min(total - 1, Math.max(0, i + passo)));
  }

  excluirAtual() {
    const resposta = this.atual();
    if (!resposta || !confirm('Excluir esta resposta?')) return;
    this.api.excluirResposta(this.id(), resposta.id).subscribe({
      next: () => {
        this.respostas.update((lista) => lista.filter((r) => r.id !== resposta.id));
        this.indice.update((i) => Math.min(i, Math.max(0, this.respostas().length - 1)));
        this.aviso.mostrar('Resposta excluída');
      },
      error: () => this.aviso.mostrar('Não foi possível excluir'),
    });
  }

  excluirTodas() {
    if (!confirm('Excluir TODAS as respostas? Isso não pode ser desfeito.')) return;
    this.api.excluirTodasRespostas(this.id()).subscribe({
      next: () => {
        this.respostas.set([]);
        this.indice.set(0);
        this.aviso.mostrar('Respostas excluídas');
      },
      error: () => this.aviso.mostrar('Não foi possível excluir'),
    });
  }
}
