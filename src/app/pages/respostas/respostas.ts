import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Formulario, Pergunta, Resposta, TEM_OPCOES } from '../../models/formulario';
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
  barras: Barra[] | null; // perguntas de opção/escala
  textos: string[]; // perguntas abertas
}

@Component({
  selector: 'app-respostas',
  imports: [CabecalhoForm, DatePipe],
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

  /** Contagem por opção (gráfico de barras) ou lista de textos, por pergunta. */
  protected readonly resumo = computed<ResumoPergunta[]>(() => {
    const respostas = this.respostas();
    return this.perguntas().map((pergunta) => {
      const valores = respostas.map((r) => r.valores[pergunta.id]).filter((v) => v !== undefined);
      const resumo: ResumoPergunta = { pergunta, respondidas: valores.length, barras: null, textos: [] };

      if (pergunta.tipo === 'curta' || pergunta.tipo === 'paragrafo') {
        resumo.textos = valores.map(String).reverse();
        return resumo;
      }

      const rotulos: string[] =
        pergunta.tipo === 'escala' && pergunta.escala
          ? Array.from({ length: pergunta.escala.max - pergunta.escala.min + 1 }, (_, i) => String(pergunta.escala!.min + i))
          : [...pergunta.opcoes];
      const contagem = new Map(rotulos.map((r) => [r, 0]));
      for (const v of valores) {
        for (const item of Array.isArray(v) ? v : [String(v)]) {
          // Opções renomeadas/removidas depois de respondidas continuam aparecendo.
          contagem.set(item, (contagem.get(item) ?? 0) + 1);
        }
      }
      // Porcentagem sobre quem respondeu a pergunta (em caixas a soma pode passar de 100%).
      resumo.barras = [...contagem].map(([rotulo, qtd]) => ({
        rotulo,
        qtd,
        pct: valores.length ? Math.round((qtd / valores.length) * 100) : 0,
      }));
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

  temOpcoes(p: Pergunta) {
    return TEM_OPCOES.includes(p.tipo) || p.tipo === 'escala';
  }

  alternarAceitando(evento: Event) {
    const form = this.form();
    if (!form) return;
    const aceitando = (evento.target as HTMLInputElement).checked;
    this.api.salvar(form.id, { ...form, aceitandoRespostas: aceitando }).subscribe({
      next: (salvo) => {
        this.form.set(salvo);
        this.aviso.mostrar(aceitando ? 'Aceitando respostas' : 'Formulário fechado para respostas');
      },
      error: () => {
        (evento.target as HTMLInputElement).checked = !aceitando;
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
