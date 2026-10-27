import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CORRIGIVEL, Formulario, Pergunta, Resposta, ValorResposta } from '../../models/formulario';
import { FormulariosService } from '../../services/formularios.service';
import { AvisoService } from '../../shared/aviso.service';
import { CabecalhoForm } from '../../shared/cabecalho-form';
import { baixarArquivo, formatarValor, gerarCsv } from '../../shared/csv';

interface Barra {
  rotulo: string;
  qtd: number;
  pct: number;
}

interface ResumoPergunta {
  pergunta: Pergunta;
  respondidas: number;
  barras: Barra[] | null; // opções e escala
  matriz: { linha: string; colunas: Barra[] }[] | null; // grade
  textos: string[]; // abertas, data e hora
  acertos: number | null; // modo teste
}

@Component({
  selector: 'app-respostas',
  imports: [CabecalhoForm, DatePipe, DecimalPipe],
  templateUrl: './respostas.html',
  styleUrl: './respostas.css',
})
export class Respostas implements OnInit {
  private readonly api = inject(FormulariosService);
  private readonly aviso = inject(AvisoService);

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

  protected readonly resumo = computed<ResumoPergunta[]>(() => {
    const respostas = this.respostas();
    return this.perguntas().map((pergunta) => {
      const valores = respostas.map((r) => r.valores[pergunta.id]).filter((v) => v !== undefined);
      const resumo: ResumoPergunta = { pergunta, respondidas: valores.length, barras: null, matriz: null, textos: [], acertos: null };
      const pct = (qtd: number) => (valores.length ? Math.round((qtd / valores.length) * 100) : 0);

      if (this.modoTeste() && this.corrigivel(pergunta)) {
        resumo.acertos = valores.filter((v) => this.estaCerta(pergunta, v)).length;
      }

      switch (pergunta.tipo) {
        case 'curta':
        case 'paragrafo':
        case 'data':
        case 'hora':
          resumo.textos = valores.map(String).reverse();
          break;
        case 'grade': {
          const g = pergunta.grade!;
          resumo.matriz = g.linhas.map((linha) => ({
            linha,
            colunas: g.colunas.map((coluna) => {
              const qtd = valores.filter((v) => (v as Record<string, string>)[linha] === coluna).length;
              return { rotulo: coluna, qtd, pct: pct(qtd) };
            }),
          }));
          break;
        }
        default: {
          const rotulos =
            pergunta.tipo === 'escala' && pergunta.escala
              ? Array.from({ length: pergunta.escala.max - pergunta.escala.min + 1 }, (_, i) => String(pergunta.escala!.min + i))
              : [...pergunta.opcoes];
          const contagem = new Map(rotulos.map((r) => [r, 0]));
          for (const v of valores) {
            for (const item of Array.isArray(v) ? v : [String(v)]) {
              // Respostas "Outro" e opções renomeadas depois aparecem como barras extras.
              const chave = pergunta.opcoes.includes(item) || pergunta.tipo === 'escala' ? item : `Outro: ${item}`;
              contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
            }
          }
          // Porcentagem sobre quem respondeu (em caixas a soma pode passar de 100%).
          resumo.barras = [...contagem].map(([rotulo, qtd]) => ({ rotulo, qtd, pct: pct(qtd) }));
        }
      }
      return resumo;
    });
  });

  ngOnInit() {
    this.carregar();
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

  // ---------- Modo teste ----------

  corrigivel(p: Pergunta) {
    return CORRIGIVEL.includes(p.tipo) && (p.quiz.corretas?.length ?? 0) > 0;
  }

  /** Mesma regra do backend (respostaCorreta em backend/src/validacao.mjs). */
  estaCerta(p: Pergunta, v: ValorResposta | undefined) {
    const corretas = p.quiz.corretas ?? [];
    if (v === undefined) return false;
    const norm = (t: unknown) => String(t).trim().toLowerCase().replace(/\s+/g, ' ');
    if (p.tipo === 'curta') return corretas.some((c) => norm(c) === norm(v));
    if (p.tipo === 'caixas') return Array.isArray(v) && v.length === corretas.length && corretas.every((c) => v.includes(c));
    return corretas.includes(v as string);
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
