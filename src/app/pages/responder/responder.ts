import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Formulario, Pergunta, ValorResposta } from '../../models/formulario';
import { FormulariosService } from '../../services/formularios.service';

type Estado = 'carregando' | 'nao-encontrado' | 'fechado' | 'respondendo' | 'enviando' | 'enviado';
type Controle = FormControl<ValorResposta | null>;

@Component({
  selector: 'app-responder',
  imports: [ReactiveFormsModule],
  templateUrl: './responder.html',
  styleUrl: './responder.css',
})
export class Responder implements OnInit {
  private readonly api = inject(FormulariosService);

  /** Vem da rota /f/:id */
  readonly id = input.required<string>();

  protected readonly estado = signal<Estado>('carregando');
  protected readonly form = signal<Formulario | null>(null);
  protected readonly pagina = signal(0);
  protected readonly erroEnvio = signal('');

  /** Um FormGroup por seção: cada seção é validada antes de avançar. */
  protected grupos: FormGroup<Record<string, Controle>>[] = [];
  private readonly controles = new Map<string, Controle>();

  ngOnInit() {
    this.api.buscar(this.id()).subscribe({
      next: (form) => {
        this.form.set(form);
        this.montar(form);
        this.estado.set(form.aceitandoRespostas ? 'respondendo' : 'fechado');
        document.title = form.titulo;
      },
      error: () => this.estado.set('nao-encontrado'),
    });
  }

  private montar(form: Formulario) {
    this.controles.clear();
    this.grupos = form.secoes.map((secao) => {
      const controles: Record<string, Controle> = {};
      for (const p of secao.perguntas) {
        const validadores: ValidatorFn[] = p.obrigatoria ? [Validators.required] : [];
        // Caixas de seleção guardam uma lista; o resto começa vazio.
        const inicial: ValorResposta | null = p.tipo === 'caixas' ? [] : p.tipo === 'escala' ? null : '';
        const controle = new FormControl<ValorResposta | null>(inicial, validadores);
        controles[p.id] = controle;
        this.controles.set(p.id, controle);
      }
      return new FormGroup(controles);
    });
  }

  ctrl(p: Pergunta): Controle {
    return this.controles.get(p.id)!;
  }

  mostrarErro(p: Pergunta) {
    const c = this.ctrl(p);
    return c.invalid && c.touched;
  }

  mensagemErro(p: Pergunta): string {
    const erros = this.ctrl(p).errors;
    return (erros?.['servidor'] as string | undefined) ?? 'Esta pergunta é obrigatória';
  }

  numerosEscala(p: Pergunta) {
    const { min, max } = p.escala!;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  // ---------- Caixas de seleção ----------

  marcado(p: Pergunta, opcao: string) {
    const v = this.ctrl(p).value;
    return Array.isArray(v) && v.includes(opcao);
  }

  alternar(p: Pergunta, opcao: string, evento: Event) {
    const c = this.ctrl(p);
    const atual = Array.isArray(c.value) ? c.value : [];
    const ligado = (evento.target as HTMLInputElement).checked;
    c.setValue(ligado ? [...atual, opcao] : atual.filter((o) => o !== opcao));
    c.markAsTouched();
  }

  // ---------- Navegação entre seções ----------

  private secaoValida(i: number) {
    const grupo = this.grupos[i];
    grupo.markAllAsTouched();
    if (grupo.valid) return true;
    setTimeout(() => document.querySelector('.cartao.com-erro')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    return false;
  }

  avancar() {
    if (!this.secaoValida(this.pagina())) return;
    this.pagina.update((n) => n + 1);
    scrollTo({ top: 0 });
  }

  voltar() {
    this.pagina.update((n) => Math.max(0, n - 1));
    scrollTo({ top: 0 });
  }

  limpar() {
    this.grupos.forEach((g, i) => {
      const secao = this.form()!.secoes[i];
      for (const p of secao.perguntas) {
        this.ctrl(p).reset(p.tipo === 'caixas' ? [] : p.tipo === 'escala' ? null : '');
      }
      g.markAsUntouched();
    });
    this.pagina.set(0);
    this.erroEnvio.set('');
  }

  // ---------- Envio ----------

  enviar() {
    if (!this.secaoValida(this.pagina())) return;

    // Só manda o que foi respondido.
    const valores: Record<string, ValorResposta> = {};
    for (const [id, c] of this.controles) {
      const v = c.value;
      if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
      valores[id] = typeof v === 'string' ? v.trim() : v;
    }

    this.estado.set('enviando');
    this.erroEnvio.set('');
    this.api.responder(this.id(), valores).subscribe({
      next: () => this.estado.set('enviado'),
      error: (erro: HttpErrorResponse) => this.tratarErro(erro),
    });
  }

  private tratarErro(erro: HttpErrorResponse) {
    if (erro.status === 403) {
      this.estado.set('fechado');
      return;
    }
    this.estado.set('respondendo');

    // O servidor diz qual pergunta falhou: marca o erro nela e volta para a seção dela.
    const erros = (erro.error?.erros ?? {}) as Record<string, string>;
    const ids = Object.keys(erros);
    if (erro.status === 400 && ids.length) {
      for (const id of ids) {
        const c = this.controles.get(id);
        c?.setErrors({ servidor: erros[id] });
        c?.markAsTouched();
      }
      const secao = this.form()!.secoes.findIndex((s) => s.perguntas.some((p) => ids.includes(p.id)));
      if (secao >= 0) this.pagina.set(secao);
      this.erroEnvio.set('Algumas respostas precisam de atenção.');
    } else {
      this.erroEnvio.set('Não foi possível enviar. Verifique sua conexão e tente de novo.');
    }
  }

  outraResposta() {
    this.limpar();
    this.estado.set('respondendo');
    scrollTo({ top: 0 });
  }
}
