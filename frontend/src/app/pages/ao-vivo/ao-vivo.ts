import { DecimalPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Formulario, Resposta } from '../../models/formulario';
import { FormulariosService } from '../../services/formularios.service';
import { EnderecoService } from '../../shared/endereco.service';
import { corrigivel, resumir } from '../../shared/resumo';

/** Tempo que cada pergunta fica na tela no modo automático. */
const TEMPO_POR_PERGUNTA = 10_000;

/**
 * Modo ao vivo: tela para projetar na sala.
 * QR code para a turma responder, contador gigante, gráfico da pergunta em destaque
 * e, em testes, média e ranking. Tudo atualiza na hora em que alguém responde.
 */
@Component({
  selector: 'app-ao-vivo',
  imports: [RouterLink, DecimalPipe],
  templateUrl: './ao-vivo.html',
  styleUrl: './ao-vivo.css',
  host: { '(document:keydown)': 'tecla($event)' },
})
export class AoVivo implements OnInit {
  private readonly api = inject(FormulariosService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly endereco = inject(EnderecoService);

  /** Vem da rota /forms/:id/ao-vivo */
  readonly id = input.required<string>();

  protected readonly form = signal<Formulario | null>(null);
  protected readonly respostas = signal<Resposta[]>([]);
  protected readonly estado = signal<'carregando' | 'pronto' | 'erro'>('carregando');
  protected readonly conectado = signal(false);

  /** Pergunta em destaque, troca automática e "revelar gabarito" (testes). */
  protected readonly indice = signal(0);
  protected readonly automatico = signal(true);
  protected readonly revelar = signal(false);
  private ultimaTroca = Date.now();

  /** Relógio para o "última resposta há X s". */
  protected readonly agora = signal(Date.now());
  protected readonly ultimaChegada = signal<number | null>(null);

  protected readonly perguntas = computed(() => this.form()?.secoes.flatMap((s) => s.perguntas) ?? []);
  protected readonly modoTeste = computed(() => this.form()?.config.modoTeste ?? false);
  protected readonly resumo = computed(() => resumir(this.perguntas(), this.respostas(), this.modoTeste()));
  protected readonly destaque = computed(() => this.resumo()[this.indice()] ?? null);
  protected readonly total = computed(() => this.respostas().length);

  protected readonly link = computed(() => this.endereco.link(this.id()));
  protected readonly urlQr = computed(() => this.api.urlQrCode(this.id(), this.link()));

  protected readonly media = computed(() => {
    const notas = this.respostas().map((r) => r.nota).filter((n) => n !== null);
    if (!notas.length) return null;
    return { pontos: notas.reduce((s, n) => s + n.pontos, 0) / notas.length, total: notas[0].total };
  });

  /** Top 5 do teste. Sem login, quem respondeu vira "Participante N" (ordem de chegada). */
  protected readonly ranking = computed(() =>
    this.respostas()
      .map((r, i) => ({
        nome: r.respondente?.nome ?? `Participante ${i + 1}`,
        nota: r.nota,
        quando: r.enviadoEm,
        tempo: r.duracaoSeg ?? Number.MAX_SAFE_INTEGER,
      }))
      .filter((r) => r.nota !== null)
      // Empate na nota: ganha quem terminou mais rápido.
      .sort((a, b) => b.nota!.pontos - a.nota!.pontos || a.tempo - b.tempo || a.quando.localeCompare(b.quando))
      .slice(0, 5),
  );

  protected readonly ha = computed(() => {
    const t = this.ultimaChegada();
    if (t === null) return null;
    const s = Math.max(0, Math.round((this.agora() - t) / 1000));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)} min`;
  });

  ngOnInit() {
    this.endereco.carregar();
    this.carregar();

    this.api
      .aoVivo(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((evento) => {
        if (evento.tipo === 'conectado') {
          // Primeira conexão ou volta depois de uma queda: busca o que perdeu.
          this.conectado.set(true);
          if (this.estado() === 'pronto') this.recarregarRespostas();
        } else if (evento.tipo === 'recarregar') {
          this.recarregarRespostas();
        } else if (!this.respostas().some((r) => r.id === evento.resposta.id)) {
          this.respostas.update((lista) => [...lista, evento.resposta]);
          this.ultimaChegada.set(Date.now());
        }
      });

    const relogio = setInterval(() => {
      this.agora.set(Date.now());
      if (this.automatico() && this.perguntas().length > 1 && Date.now() - this.ultimaTroca >= TEMPO_POR_PERGUNTA) {
        this.ir(1, false);
      }
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(relogio));
  }

  carregar() {
    this.estado.set('carregando');
    forkJoin([this.api.buscar(this.id()), this.api.listarRespostas(this.id())]).subscribe({
      next: ([form, respostas]) => {
        this.form.set(form);
        this.respostas.set(respostas);
        const ultima = respostas.at(-1);
        if (ultima) this.ultimaChegada.set(Date.parse(ultima.enviadoEm));
        document.title = `Ao vivo · ${form.titulo}`;
        this.estado.set('pronto');
      },
      error: () => this.estado.set('erro'),
    });
  }

  private recarregarRespostas() {
    this.api.listarRespostas(this.id()).subscribe((lista) => this.respostas.set(lista));
  }

  // ---------- Controles ----------

  /** Anda para a pergunta seguinte (+1) ou anterior (-1), dando a volta no fim. */
  ir(passo: number, manual = true) {
    const n = this.perguntas().length;
    if (!n) return;
    this.indice.update((i) => (i + passo + n) % n);
    this.revelar.set(false);
    this.ultimaTroca = Date.now();
    if (manual) this.automatico.set(false);
  }

  irPara(i: number) {
    this.indice.set(i);
    this.revelar.set(false);
    this.automatico.set(false);
  }

  alternarAutomatico() {
    this.automatico.update((v) => !v);
    this.ultimaTroca = Date.now();
  }

  telaCheia() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  protected tecla(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const alvo = e.target as HTMLElement;
    if (alvo.closest('input, textarea, select')) return;
    switch (e.key) {
      case 'ArrowRight':
        this.ir(1);
        break;
      case 'ArrowLeft':
        this.ir(-1);
        break;
      case ' ':
        this.alternarAutomatico();
        break;
      case 'f':
      case 'F':
        this.telaCheia();
        break;
      case 'r':
      case 'R':
        if (this.modoTeste()) this.revelar.update((v) => !v);
        break;
      default:
        return;
    }
    e.preventDefault();
  }

  /** No teste, depois de "revelar", a opção certa ganha destaque. */
  protected certa(rotulo: string) {
    const p = this.destaque()?.pergunta;
    return Boolean(p && this.revelar() && corrigivel(p) && p.quiz.corretas?.includes(rotulo));
  }

  protected podeRevelar() {
    const p = this.destaque()?.pergunta;
    return Boolean(p && this.modoTeste() && corrigivel(p) && p.tipo !== 'curta');
  }
}
