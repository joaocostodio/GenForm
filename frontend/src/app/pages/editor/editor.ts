import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, DestroyRef, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { concatMap, debounceTime, tap } from 'rxjs';
import { CORES, ConteudoForm, Formulario, gerarId, novaPergunta, novaSecao } from '../../models/formulario';
import { FormulariosService } from '../../services/formularios.service';
import { CabecalhoForm } from '../../shared/cabecalho-form';
import { SecaoForm, criarPergunta, criarSecao, paraPergunta, paraSecao } from './editor-forms';
import { Destino, PerguntaEditor } from './pergunta-editor';

type Status = 'carregando' | 'salvo' | 'pendente' | 'salvando' | 'erro' | 'nao-encontrado';

const TEXTO_STATUS: Record<Status, string> = {
  carregando: '',
  salvo: 'Todas as alterações foram salvas',
  pendente: 'Salvando...',
  salvando: 'Salvando...',
  erro: 'Erro ao salvar — verifique o servidor',
  'nao-encontrado': '',
};

@Component({
  selector: 'app-editor',
  imports: [ReactiveFormsModule, CabecalhoForm, PerguntaEditor, CdkDropListGroup, CdkDropList, CdkDrag, CdkDragPlaceholder],
  templateUrl: './editor.html',
  styleUrl: './editor.css',
})
export class Editor implements OnInit, OnDestroy {
  private readonly api = inject(FormulariosService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  /** Vem da rota /forms/:id/editar */
  readonly id = input.required<string>();

  protected readonly cores = CORES;
  protected readonly status = signal<Status>('carregando');
  protected readonly textoStatus = TEXTO_STATUS;
  protected readonly totalRespostas = signal<number | null>(null);
  protected readonly config = signal<Formulario['config'] | null>(null);
  /** Destinos possíveis da lógica condicional, por seção (só seções à frente). */
  protected readonly destinos = signal<Destino[][]>([]);

  protected readonly form = this.fb.group({
    titulo: '',
    descricao: '',
    cor: '#673ab7',
    secoes: new FormArray<SecaoForm>([]),
  });

  get secoes() {
    return this.form.controls.secoes;
  }

  ngOnInit() {
    this.api.buscar(this.id()).subscribe({
      next: (dados) => {
        this.config.set(dados.config);
        this.form.patchValue({ titulo: dados.titulo, descricao: dados.descricao, cor: dados.cor }, { emitEvent: false });
        for (const secao of dados.secoes) this.secoes.push(criarSecao(secao), { emitEvent: false });
        this.atualizarDestinos();
        this.status.set('salvo');
        this.ativarSalvamentoAutomatico();
      },
      error: () => this.status.set('nao-encontrado'),
    });
    this.api.listarRespostas(this.id()).subscribe({
      next: (lista) => this.totalRespostas.set(lista.length),
      error: () => {},
    });
    addEventListener('beforeunload', this.avisarSaida);
  }

  ngOnDestroy() {
    removeEventListener('beforeunload', this.avisarSaida);
    // Saiu da tela antes do salvamento automático disparar: salva agora.
    if (this.status() === 'pendente') this.api.salvar(this.id(), this.paraModelo()).subscribe();
  }

  private readonly avisarSaida = (evento: BeforeUnloadEvent) => {
    if (this.status() === 'pendente' || this.status() === 'salvando') evento.preventDefault();
  };

  private paraModelo(): ConteudoForm {
    const v = this.form.getRawValue();
    return { titulo: v.titulo, descricao: v.descricao, cor: v.cor, secoes: this.secoes.controls.map(paraSecao) };
  }

  // ---------- Salvamento automático ----------

  private ativarSalvamentoAutomatico() {
    this.form.valueChanges
      .pipe(
        tap(() => {
          this.status.set('pendente');
          this.atualizarDestinos();
        }),
        debounceTime(700),
        tap(() => this.status.set('salvando')),
        // concatMap: um salvamento por vez, na ordem em que aconteceram
        concatMap(() => this.api.salvar(this.id(), this.paraModelo())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          if (this.status() === 'salvando') this.status.set('salvo');
        },
        error: () => {
          this.status.set('erro');
          this.ativarSalvamentoAutomatico(); // o fluxo morre no erro; religa para as próximas edições
        },
      });
  }

  // ---------- Lógica condicional ----------

  private atualizarDestinos() {
    const secoes = this.secoes.controls.map((s, i) => ({ id: s.controls.id.value, nome: s.controls.titulo.value || `Seção ${i + 1}` }));
    this.destinos.set(
      secoes.map((_, i) => [
        { valor: '', rotulo: 'Seguir o padrão da seção' },
        ...secoes.slice(i + 1).map((s, k) => ({ valor: s.id, rotulo: `Ir para a seção ${i + k + 2} (${s.nome})` })),
        { valor: 'enviar', rotulo: 'Enviar formulário' },
      ]),
    );
  }

  /** Opções de "Após a seção N" (sem a opção "padrão", que aqui é "continuar"). */
  depoisDaSecao(i: number): Destino[] {
    return (this.destinos()[i] ?? []).map((d) => (d.valor === '' ? { valor: '', rotulo: 'Continuar para a próxima seção' } : d));
  }

  // ---------- Perguntas ----------

  perguntasDe(s: number) {
    return this.secoes.at(s).controls.perguntas;
  }

  adicionarPergunta(s: number) {
    const nova = criarPergunta(novaPergunta());
    this.perguntasDe(s).push(nova);
    this.focar(`p-${nova.controls.id.value}`);
  }

  duplicar(s: number, i: number) {
    const copia = criarPergunta({ ...paraPergunta(this.perguntasDe(s).at(i)), id: gerarId() });
    this.perguntasDe(s).insert(i + 1, copia);
    this.focar(`p-${copia.controls.id.value}`);
  }

  remover(s: number, i: number) {
    this.perguntasDe(s).removeAt(i);
  }

  mover(s: number, i: number, direcao: -1 | 1) {
    this.moverEntre(s, i, s, i + direcao);
  }

  /** Arrastar e soltar (inclusive de uma seção para outra). */
  soltar(evento: CdkDragDrop<number>) {
    this.moverEntre(evento.previousContainer.data, evento.previousIndex, evento.container.data, evento.currentIndex);
  }

  private moverEntre(deSecao: number, de: number, paraSecao: number, para: number) {
    const origem = this.perguntasDe(deSecao);
    const destino = this.perguntasDe(paraSecao);
    if (para < 0 || (deSecao === paraSecao && (para >= origem.length || para === de))) return;
    const item = origem.at(de);
    origem.removeAt(de, { emitEvent: false });
    // Desvios que apontariam para trás deixam de valer na seção nova.
    const validos = new Set((this.destinos()[paraSecao] ?? []).map((d) => d.valor));
    for (const opcao of item.controls.opcoes.controls) {
      if (!validos.has(opcao.controls.irPara.value)) opcao.controls.irPara.setValue('', { emitEvent: false });
    }
    destino.insert(Math.min(para, destino.length), item);
  }

  // ---------- Seções ----------

  adicionarSecao() {
    const secao = criarSecao(novaSecao());
    this.secoes.push(secao);
    this.focar(`s-${secao.controls.id.value}`);
  }

  /** Remove a seção e manda as perguntas dela para a seção anterior. */
  removerSecao(s: number) {
    if (s === 0) return;
    for (const p of this.perguntasDe(s).controls) this.perguntasDe(s - 1).push(p, { emitEvent: false });
    this.secoes.removeAt(s);
  }

  escolherCor(cor: string) {
    this.form.controls.cor.setValue(cor);
  }

  private focar(idElemento: string) {
    setTimeout(() => {
      const alvo = document.getElementById(idElemento);
      if (alvo instanceof HTMLInputElement) {
        alvo.focus();
        alvo.select();
      }
      alvo?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }
}
