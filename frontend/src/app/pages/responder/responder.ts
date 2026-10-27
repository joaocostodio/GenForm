import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  FormularioPublico,
  Pergunta,
  ResultadoEnvio,
  StatusPublico,
  TEM_OUTRO,
  ValorResposta,
} from '../../models/formulario';
import { FormulariosService } from '../../services/formularios.service';
import { proximaSecao } from '../../shared/fluxo';
import { OUTRO, textoDoErro, validadoresDa } from '../../shared/validadores';

type Estado = 'carregando' | 'nao-encontrado' | StatusPublico | 'enviando' | 'enviado';
type Controle = FormControl<ValorResposta | null>;

@Component({
  selector: 'app-responder',
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet],
  templateUrl: './responder.html',
  styleUrl: './responder.css',
})
export class Responder implements OnInit {
  private readonly api = inject(FormulariosService);

  /** Vem da rota /f/:id */
  readonly id = input.required<string>();
  /** ?incorporado=1 quando está dentro de um iframe em outro site */
  readonly incorporado = input<string>();

  protected readonly OUTRO = OUTRO;
  protected readonly estado = signal<Estado>('carregando');
  protected readonly dados = signal<FormularioPublico | null>(null);
  protected readonly form = computed(() => this.dados()?.form ?? null);
  protected readonly erroEnvio = signal('');
  protected readonly resultado = signal<ResultadoEnvio | null>(null);

  /** Seção atual e o caminho até aqui (para o "Voltar" funcionar com a lógica condicional). */
  protected readonly secaoAtual = signal(0);
  private readonly historico = signal<number[]>([]);

  /** Perguntas de cada seção, na ordem de exibição (embaralhada se configurado). */
  protected ordem: Pergunta[][] = [];
  private readonly controles = new Map<string, Controle>();
  private readonly outros = new Map<string, FormControl<string>>();
  /** Muda a cada resposta para recalcular o botão "Próxima/Enviar". */
  private readonly versao = signal(0);

  protected readonly proxima = computed(() => {
    this.versao();
    const f = this.form();
    return f ? proximaSecao(f.secoes, this.secaoAtual(), this.valoresAtuais()) : null;
  });

  protected readonly progresso = computed(() => {
    const total = this.form()?.secoes.length ?? 1;
    return Math.round(((this.historico().length + 1) / total) * 100);
  });

  ngOnInit() {
    this.api.abrirPublico(this.id()).subscribe({
      next: (dados) => {
        this.dados.set(dados);
        this.montar();
        this.estado.set(dados.status);
        document.title = dados.form.titulo;
      },
      error: () => this.estado.set('nao-encontrado'),
    });
  }

  private montar() {
    const f = this.form()!;
    this.controles.clear();
    this.outros.clear();
    for (const p of f.secoes.flatMap((s) => s.perguntas)) {
      const outro = p.permitirOutro && TEM_OUTRO.includes(p.tipo) ? new FormControl('', { nonNullable: true }) : null;
      const controle: Controle = new FormControl<ValorResposta | null>(this.valorInicial(p), validadoresDa(p, outro));
      controle.valueChanges.subscribe(() => this.versao.update((n) => n + 1));
      outro?.valueChanges.subscribe(() => controle.updateValueAndValidity());
      this.controles.set(p.id, controle);
      if (outro) this.outros.set(p.id, outro);
    }
    this.ordem = f.secoes.map((s) => (f.config.embaralharPerguntas ? embaralhar(s.perguntas) : s.perguntas));
  }

  private valorInicial(p: Pergunta): ValorResposta | null {
    if (p.tipo === 'caixas') return [];
    if (p.tipo === 'grade') return {};
    if (p.tipo === 'escala') return null;
    return '';
  }

  // ---------- Ajudantes do template ----------

  ctrl(p: Pergunta): Controle {
    return this.controles.get(p.id)!;
  }

  outro(p: Pergunta): FormControl<string> {
    return this.outros.get(p.id)!;
  }

  mostrarErro(p: Pergunta) {
    const c = this.ctrl(p);
    return c.invalid && c.touched;
  }

  mensagemErro(p: Pergunta) {
    return textoDoErro(this.ctrl(p).errors);
  }

  numerosEscala(p: Pergunta) {
    const { min, max } = p.escala!;
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  marcado(p: Pergunta, opcao: string) {
    const v = this.ctrl(p).value;
    return Array.isArray(v) && v.includes(opcao);
  }

  alternar(p: Pergunta, opcao: string, ligado: boolean) {
    const c = this.ctrl(p);
    const atual = Array.isArray(c.value) ? c.value : [];
    if (ligado === atual.includes(opcao)) return;
    c.setValue(ligado ? [...atual, opcao] : atual.filter((o) => o !== opcao));
    c.markAsTouched();
  }

  /** Digitou no "Outro": já marca a opção. */
  digitouOutro(p: Pergunta) {
    if (p.tipo === 'caixas') this.alternar(p, OUTRO, true);
    else this.ctrl(p).setValue(OUTRO);
  }

  escolhaGrade(p: Pergunta, linha: string) {
    return (this.ctrl(p).value as Record<string, string>)[linha] ?? null;
  }

  escolherGrade(p: Pergunta, linha: string, coluna: string) {
    const c = this.ctrl(p);
    c.setValue({ ...(c.value as Record<string, string>), [linha]: coluna });
    c.markAsTouched();
  }

  limparEscolha(p: Pergunta) {
    this.ctrl(p).setValue(this.valorInicial(p));
    this.outros.get(p.id)?.setValue('');
  }

  temEscolha(p: Pergunta) {
    const v = this.ctrl(p).value;
    return v !== null && v !== '';
  }

  // ---------- Navegação ----------

  private valoresAtuais(): Record<string, ValorResposta | null> {
    const valores: Record<string, ValorResposta | null> = {};
    for (const [id, c] of this.controles) valores[id] = c.value;
    return valores;
  }

  private secaoValida() {
    const perguntas = this.ordem[this.secaoAtual()];
    perguntas.forEach((p) => this.ctrl(p).markAsTouched());
    if (perguntas.every((p) => this.ctrl(p).valid)) return true;
    setTimeout(() => document.querySelector('.cartao.com-erro')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    return false;
  }

  avancar() {
    if (!this.secaoValida()) return;
    const proxima = this.proxima();
    if (proxima === null) return this.enviar();
    this.historico.update((h) => [...h, this.secaoAtual()]);
    this.secaoAtual.set(proxima);
    scrollTo({ top: 0 });
  }

  voltar() {
    const h = this.historico();
    if (!h.length) return;
    this.secaoAtual.set(h.at(-1)!);
    this.historico.set(h.slice(0, -1));
    scrollTo({ top: 0 });
  }

  limpar() {
    for (const p of this.form()!.secoes.flatMap((s) => s.perguntas)) {
      this.ctrl(p).reset(this.valorInicial(p));
      this.outros.get(p.id)?.reset('');
    }
    this.historico.set([]);
    this.secaoAtual.set(0);
    this.erroEnvio.set('');
  }

  // ---------- Envio ----------

  private enviar() {
    // Só manda as seções por onde a pessoa passou; "Outro" vira o texto digitado.
    const visitadas = [...this.historico(), this.secaoAtual()];
    const valores: Record<string, ValorResposta> = {};
    for (const i of visitadas) {
      for (const p of this.ordem[i]) {
        let v = this.ctrl(p).value;
        const textoOutro = this.outros.get(p.id)?.value.trim() ?? '';
        if (v === OUTRO) v = textoOutro;
        if (Array.isArray(v)) v = v.map((o) => (o === OUTRO ? textoOutro : o)).filter(Boolean);
        if (typeof v === 'string') v = v.trim();
        if (v === null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Object.keys(v).length)) continue;
        valores[p.id] = v;
      }
    }

    this.estado.set('enviando');
    this.erroEnvio.set('');
    this.api.responder(this.id(), valores).subscribe({
      next: (resultado) => {
        this.resultado.set(resultado);
        this.estado.set('enviado');
        scrollTo({ top: 0 });
      },
      error: (erro: HttpErrorResponse) => this.tratarErro(erro),
    });
  }

  private tratarErro(erro: HttpErrorResponse) {
    if (erro.status === 403 && erro.error?.status) {
      this.estado.set(erro.error.status);
      return;
    }
    this.estado.set('aberto');
    const erros = (erro.error?.erros ?? {}) as Record<string, string>;
    const ids = Object.keys(erros);
    if (erro.status === 400 && ids.length) {
      for (const id of ids) {
        const c = this.controles.get(id);
        c?.setErrors({ servidor: erros[id] });
        c?.markAsTouched();
      }
      const secao = this.ordem.findIndex((ps) => ps.some((p) => ids.includes(p.id)));
      if (secao >= 0) this.secaoAtual.set(secao);
      this.erroEnvio.set('Algumas respostas precisam de atenção.');
    } else {
      this.erroEnvio.set('Não foi possível enviar. Verifique sua conexão e tente de novo.');
    }
  }

  outraResposta() {
    this.limpar();
    this.resultado.set(null);
    this.estado.set('aberto');
    scrollTo({ top: 0 });
  }

  // ---------- Resultado do teste ----------

  tituloDaPergunta(id: string) {
    return this.form()?.secoes.flatMap((s) => s.perguntas).find((p) => p.id === id)?.titulo || 'Pergunta';
  }
}

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
