import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
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
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet, DatePipe],
  templateUrl: './responder.html',
  styleUrl: './responder.css',
  host: { '(document:keydown)': 'tecla($event)' },
})
export class Responder implements OnInit {
  private readonly api = inject(FormulariosService);
  private readonly destroyRef = inject(DestroyRef);

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

  // ---------- Uma pergunta por vez ----------

  protected readonly umaPorVez = computed(() => this.form()?.config.umaPorVez ?? false);
  /** Posição da pergunta dentro da seção atual (só no modo uma por vez). */
  protected readonly perguntaIdx = signal(0);
  protected readonly totalPerguntas = computed(() => this.form()?.secoes.reduce((s, x) => s + x.perguntas.length, 0) ?? 0);
  /** Número da pergunta na tela, contando as seções já percorridas. */
  protected readonly numeroDaVez = computed(
    () => this.historico().reduce((s, i) => s + (this.ordem[i]?.length ?? 0), 0) + this.perguntaIdx() + 1,
  );
  private avancoAutomatico?: ReturnType<typeof setTimeout>;

  protected readonly progresso = computed(() => {
    if (this.umaPorVez()) {
      return Math.round(((this.numeroDaVez() - 1) / Math.max(1, this.totalPerguntas())) * 100);
    }
    const total = this.form()?.secoes.length ?? 1;
    return Math.round(((this.historico().length + 1) / total) * 100);
  });

  /** Perguntas mostradas agora: a seção inteira, ou só uma no modo uma por vez. */
  visiveis(): Pergunta[] {
    const lista = this.ordem[this.secaoAtual()] ?? [];
    if (!this.umaPorVez()) return lista;
    const p = lista[this.perguntaIdx()];
    return p ? [p] : [];
  }

  /** O botão vira "Enviar"? */
  ehUltima() {
    if (this.proxima() !== null) return false;
    return !this.umaPorVez() || this.perguntaIdx() >= (this.ordem[this.secaoAtual()]?.length ?? 0) - 1;
  }

  podeVoltar() {
    return this.secaoAtual() > 0 || (this.umaPorVez() && this.perguntaIdx() > 0);
  }

  doisDigitos(n: number) {
    return String(n).padStart(2, '0');
  }

  /** Clicou numa opção de escolha única: avança sozinho, como no teclado. */
  escolheu(p: Pergunta) {
    if (this.umaPorVez() && this.ctrl(p).value !== OUTRO) this.agendarAvanco();
  }

  private agendarAvanco() {
    clearTimeout(this.avancoAutomatico);
    this.avancoAutomatico = setTimeout(() => this.avancar(), 350);
  }

  /** Põe o cursor no campo de texto da pergunta (as de escolha usam as teclas 1–9). */
  private focar() {
    setTimeout(() =>
      document.querySelector<HTMLElement>('.pergunta.vez input.campo:not(.outro), .pergunta.vez textarea, .pergunta.vez input.campo-caixa')?.focus(),
    );
  }

  /** Atalhos do modo uma por vez: 1–9 escolhe, Enter avança, Ctrl+Enter avança de dentro de um texto. */
  protected tecla(e: KeyboardEvent) {
    if (!this.umaPorVez() || this.estado() !== 'aberto') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.avancar();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const alvo = e.target as HTMLElement;
    if (alvo.closest('input:not([type=radio]):not([type=checkbox]), textarea, select, button, a')) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.avancar();
      return;
    }
    const p = this.visiveis()[0];
    if (p && /^[0-9]$/.test(e.key) && this.escolherPorTecla(p, Number(e.key))) e.preventDefault();
  }

  private escolherPorTecla(p: Pergunta, n: number) {
    const c = this.ctrl(p);
    if (p.tipo === 'escala' && p.escala) {
      const valor = n === 0 && p.escala.min > 0 ? 10 : n;
      if (valor < p.escala.min || valor > p.escala.max) return false;
      c.setValue(valor);
      c.markAsTouched();
      this.agendarAvanco();
      return true;
    }
    if (n < 1) return false;
    if (n <= p.opcoes.length && this.esgotada(p, n - 1)) return false;
    const opcao = p.opcoes[n - 1];
    const ehOutro = !opcao && p.permitirOutro && n === p.opcoes.length + 1 && (p.tipo === 'multipla' || p.tipo === 'caixas');
    if (!opcao && !ehOutro) return false;
    if (p.tipo === 'caixas') {
      const escolha = opcao ?? OUTRO;
      this.alternar(p, escolha, !this.marcado(p, escolha));
    } else if (p.tipo === 'multipla' || p.tipo === 'lista') {
      c.setValue(opcao ?? OUTRO);
      c.markAsTouched();
      if (opcao) this.agendarAvanco();
    } else {
      return false;
    }
    if (ehOutro) setTimeout(() => document.querySelector<HTMLElement>('.pergunta.vez input.outro')?.focus());
    return true;
  }

  // ---------- Código de acesso, abertura agendada, cronômetro e rascunho ----------

  /** Código digitado (fica só na memória e vai no cabeçalho das chamadas). */
  protected readonly codigo = signal('');
  protected readonly codigoErrado = signal(false);
  protected readonly conferindoCodigo = signal(false);

  /** Relógio de 1 em 1 segundo (cronômetro e contagem regressiva). */
  protected readonly agora = signal(Date.now());
  /** Quando a pessoa começou a responder (sobrevive a um F5). */
  private inicio = Date.now();
  private tempoAcabou = false;

  /** Recuperou respostas salvas de uma visita anterior. */
  protected readonly rascunhoRecuperado = signal(false);
  /** A resposta foi enviada porque o tempo acabou. */
  protected readonly enviadoPorTempo = signal(false);
  private salvarRascunhoTimer?: ReturnType<typeof setTimeout>;

  /** Segundos que faltam no cronômetro (null = sem cronômetro). */
  protected readonly restante = computed(() => {
    const minutos = this.form()?.config.tempoLimite;
    if (!minutos || (this.estado() !== 'aberto' && this.estado() !== 'enviando')) return null;
    return Math.max(0, Math.ceil((this.inicio + minutos * 60_000 - this.agora()) / 1000));
  });

  /** Contagem regressiva até abrir (status "agendado"). */
  protected readonly faltaAbrir = computed(() => {
    const abre = this.form()?.config.dataAbertura;
    if (this.estado() !== 'agendado' || !abre) return null;
    return Math.max(0, Math.ceil((Date.parse(abre) - this.agora()) / 1000));
  });

  ngOnInit() {
    this.carregar();
    const relogio = setInterval(() => this.tique(), 1000);
    this.destroyRef.onDestroy(() => {
      clearInterval(relogio);
      clearTimeout(this.avancoAutomatico);
      clearTimeout(this.salvarRascunhoTimer);
    });
  }

  private carregar() {
    this.api.abrirPublico(this.id(), this.codigo() || undefined).subscribe({
      next: (dados) => {
        this.dados.set(dados);
        this.codigoErrado.set(Boolean(dados.codigoErrado));
        this.conferindoCodigo.set(false);
        this.montar();
        this.estado.set(dados.status);
        document.title = dados.form.titulo;
        if (dados.status === 'aberto') this.comecar();
      },
      error: (erro: HttpErrorResponse) => {
        this.conferindoCodigo.set(false);
        if (erro.status === 429) {
          this.codigoErrado.set(true);
          this.estado.set('precisa-codigo');
        } else {
          this.estado.set('nao-encontrado');
        }
      },
    });
  }

  private tique() {
    this.agora.set(Date.now());
    // Abriu enquanto a pessoa esperava na contagem regressiva.
    if (this.faltaAbrir() === 0) {
      this.estado.set('carregando');
      this.carregar();
    }
    // Tempo esgotado: envia o que tiver.
    if (this.restante() === 0 && !this.tempoAcabou && this.estado() === 'aberto') {
      this.tempoAcabou = true;
      this.enviar(true);
    }
  }

  entrarComCodigo(evento: Event) {
    evento.preventDefault();
    if (!this.codigo().trim()) return;
    this.conferindoCodigo.set(true);
    this.carregar();
  }

  /** Começou a responder: marca a hora (cronômetro) e recupera o rascunho. */
  private comecar() {
    const chave = `genform.inicio.${this.id()}`;
    const salvo = Number(lerArmazenado(sessionStorage, chave));
    this.inicio = salvo > 0 && Date.now() - salvo < 24 * 3600_000 ? salvo : Date.now();
    gravarArmazenado(sessionStorage, chave, String(this.inicio));
    this.tempoAcabou = false;
    this.recuperarRascunho();
  }

  // ---------- Rascunho automático ----------

  private get chaveRascunho() {
    return `genform.rascunho.${this.id()}`;
  }

  private agendarRascunho() {
    clearTimeout(this.salvarRascunhoTimer);
    this.salvarRascunhoTimer = setTimeout(() => this.salvarRascunho(), 500);
  }

  private salvarRascunho() {
    if (this.estado() !== 'aberto') return;
    const valores: Record<string, ValorResposta | null> = {};
    const outros: Record<string, string> = {};
    for (const [id, c] of this.controles) if (!semValor(c.value)) valores[id] = c.value;
    for (const [id, o] of this.outros) if (o.value) outros[id] = o.value;
    if (!Object.keys(valores).length && !Object.keys(outros).length) {
      this.apagarRascunho();
      return;
    }
    gravarArmazenado(localStorage, this.chaveRascunho, JSON.stringify({ valores, outros, salvoEm: Date.now() }));
  }

  private recuperarRascunho() {
    const texto = lerArmazenado(localStorage, this.chaveRascunho);
    if (!texto) return;
    try {
      const { valores = {}, outros = {} } = JSON.parse(texto) as {
        valores?: Record<string, ValorResposta | null>;
        outros?: Record<string, string>;
      };
      let recuperou = false;
      for (const [id, v] of Object.entries(valores)) {
        const c = this.controles.get(id);
        if (c && !semValor(v)) {
          c.setValue(v);
          recuperou = true;
        }
      }
      for (const [id, v] of Object.entries(outros)) this.outros.get(id)?.setValue(String(v));
      this.rascunhoRecuperado.set(recuperou);
    } catch {
      this.apagarRascunho();
    }
  }

  private apagarRascunho() {
    removerArmazenado(localStorage, this.chaveRascunho);
  }

  descartarRascunho() {
    this.limpar();
  }

  // ---------- Vagas, estrelas e NPS ----------

  /** Vagas que sobram na opção i (null = sem limite). */
  vagasDe(p: Pergunta, i: number): number | null {
    return p.usarVagas ? (p.restantes?.[i] ?? null) : null;
  }

  esgotada(p: Pergunta, i: number) {
    const resto = this.vagasDe(p, i);
    // Quem já tinha escolhido (rascunho) continua podendo manter a escolha.
    return resto === 0 && !this.escolheuOpcao(p, p.opcoes[i]);
  }

  private escolheuOpcao(p: Pergunta, opcao: string) {
    const v = this.ctrl(p).value;
    return Array.isArray(v) ? v.includes(opcao) : v === opcao;
  }

  estiloEscala(p: Pergunta) {
    return p.escala?.estilo ?? 'numeros';
  }

  /** Cor de cada nota do NPS: detratores (0–6), neutros (7–8) e promotores (9–10). */
  grupoNps(n: number) {
    return n <= 6 ? 'detrator' : n <= 8 ? 'neutro' : 'promotor';
  }

  escolherEscala(p: Pergunta, n: number) {
    const c = this.ctrl(p);
    c.setValue(n);
    c.markAsTouched();
    c.markAsDirty();
    this.escolheu(p);
  }

  valorEscala(p: Pergunta) {
    const v = this.ctrl(p).value;
    return typeof v === 'number' ? v : v === null || v === '' ? null : Number(v);
  }

  mmss(segundos: number) {
    const m = Math.floor(segundos / 60);
    return `${String(m).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
  }

  /** "2d 03:04:05" para a contagem até abrir. */
  contagem(segundos: number) {
    const d = Math.floor(segundos / 86400);
    const h = Math.floor((segundos % 86400) / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = segundos % 60;
    const dois = (n: number) => String(n).padStart(2, '0');
    return `${d ? d + 'd ' : ''}${dois(h)}:${dois(m)}:${dois(s)}`;
  }

  private montar() {
    const f = this.form()!;
    this.controles.clear();
    this.outros.clear();
    for (const p of f.secoes.flatMap((s) => s.perguntas)) {
      const outro = p.permitirOutro && TEM_OUTRO.includes(p.tipo) ? new FormControl('', { nonNullable: true }) : null;
      const controle: Controle = new FormControl<ValorResposta | null>(this.valorInicial(p), validadoresDa(p, outro));
      controle.valueChanges.subscribe(() => {
        this.versao.update((n) => n + 1);
        this.agendarRascunho();
      });
      outro?.valueChanges.subscribe(() => {
        controle.updateValueAndValidity();
        this.agendarRascunho();
      });
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
    clearTimeout(this.avancoAutomatico);
    if (this.estado() !== 'aberto') return;
    if (this.umaPorVez()) {
      // Primeiro anda pelas perguntas da seção, uma de cada vez.
      const lista = this.ordem[this.secaoAtual()];
      const p = lista[this.perguntaIdx()];
      if (p) {
        this.ctrl(p).markAsTouched();
        if (this.ctrl(p).invalid) return;
      }
      if (this.perguntaIdx() < lista.length - 1) {
        this.perguntaIdx.update((i) => i + 1);
        this.focar();
        return;
      }
    }
    if (!this.secaoValida()) return;
    const proxima = this.proxima();
    if (proxima === null) return this.enviar();
    this.historico.update((h) => [...h, this.secaoAtual()]);
    this.secaoAtual.set(proxima);
    this.perguntaIdx.set(0);
    scrollTo({ top: 0 });
    if (this.umaPorVez()) this.focar();
  }

  voltar() {
    clearTimeout(this.avancoAutomatico);
    if (this.umaPorVez() && this.perguntaIdx() > 0) {
      this.perguntaIdx.update((i) => i - 1);
      return;
    }
    const h = this.historico();
    if (!h.length) return;
    const anterior = h.at(-1)!;
    this.secaoAtual.set(anterior);
    this.historico.set(h.slice(0, -1));
    // Voltando de seção no modo uma por vez, cai na última pergunta dela.
    this.perguntaIdx.set(this.umaPorVez() ? Math.max(0, (this.ordem[anterior]?.length ?? 1) - 1) : 0);
    scrollTo({ top: 0 });
  }

  limpar() {
    for (const p of this.form()!.secoes.flatMap((s) => s.perguntas)) {
      this.ctrl(p).reset(this.valorInicial(p));
      this.outros.get(p.id)?.reset('');
    }
    this.historico.set([]);
    this.secaoAtual.set(0);
    this.perguntaIdx.set(0);
    this.erroEnvio.set('');
    this.rascunhoRecuperado.set(false);
    clearTimeout(this.salvarRascunhoTimer);
    this.apagarRascunho();
  }

  // ---------- Envio ----------

  /** tempoEsgotado: o cronômetro zerou e a resposta vai como estiver. */
  private enviar(tempoEsgotado = false) {
    clearTimeout(this.avancoAutomatico);
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
    const extras = {
      codigo: this.codigo() || undefined,
      tempoEsgotado: tempoEsgotado || undefined,
      duracaoSeg: Math.round((Date.now() - this.inicio) / 1000),
    };
    this.api.responder(this.id(), valores, extras).subscribe({
      next: (resultado) => {
        this.resultado.set(resultado);
        this.estado.set('enviado');
        this.enviadoPorTempo.set(tempoEsgotado);
        clearTimeout(this.salvarRascunhoTimer);
        this.apagarRascunho();
        removerArmazenado(sessionStorage, `genform.inicio.${this.id()}`);
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
      if (secao >= 0) {
        this.secaoAtual.set(secao);
        this.perguntaIdx.set(Math.max(0, this.ordem[secao].findIndex((p) => ids.includes(p.id))));
      }
      this.erroEnvio.set('Algumas respostas precisam de atenção.');
    } else {
      this.erroEnvio.set('Não foi possível enviar. Verifique sua conexão e tente de novo.');
    }
  }

  outraResposta() {
    this.limpar();
    this.resultado.set(null);
    this.enviadoPorTempo.set(false);
    // Recarrega para pegar as vagas atualizadas e zerar o cronômetro.
    this.estado.set('carregando');
    this.carregar();
    scrollTo({ top: 0 });
  }

  // ---------- Resultado do teste ----------

  tituloDaPergunta(id: string) {
    return this.form()?.secoes.flatMap((s) => s.perguntas).find((p) => p.id === id)?.titulo || 'Pergunta';
  }
}

function semValor(v: unknown) {
  return (
    v === null || v === undefined || v === '' ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)
  );
}

// localStorage/sessionStorage podem não existir (aba anônima, bloqueio): sem eles, só não lembra.
function lerArmazenado(onde: Storage, chave: string) {
  try {
    return onde.getItem(chave);
  } catch {
    return null;
  }
}

function gravarArmazenado(onde: Storage, chave: string, valor: string) {
  try {
    onde.setItem(chave, valor);
  } catch {
    // sem armazenamento: segue sem rascunho
  }
}

function removerArmazenado(onde: Storage, chave: string) {
  try {
    onde.removeItem(chave);
  } catch {
    // idem
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
