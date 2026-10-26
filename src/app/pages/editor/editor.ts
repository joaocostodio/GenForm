import { Component, DestroyRef, OnDestroy, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { concatMap, debounceTime, tap } from 'rxjs';
import {
  CORES,
  Formulario,
  FormularioEntrada,
  Pergunta,
  Secao,
  TEM_OPCOES,
  TIPOS,
  TipoPergunta,
  gerarId,
  novaPergunta,
  novaSecao,
} from '../../models/formulario';
import { FormulariosService } from '../../services/formularios.service';
import { CabecalhoForm } from '../../shared/cabecalho-form';

// Formulários tipados: cada pergunta/seção vira um FormGroup.
type EscalaForm = FormGroup<{
  min: FormControl<number>;
  max: FormControl<number>;
  rotuloMin: FormControl<string>;
  rotuloMax: FormControl<string>;
}>;

type PerguntaForm = FormGroup<{
  id: FormControl<string>;
  tipo: FormControl<TipoPergunta>;
  titulo: FormControl<string>;
  obrigatoria: FormControl<boolean>;
  opcoes: FormArray<FormControl<string>>;
  escala: EscalaForm;
}>;

type SecaoForm = FormGroup<{
  id: FormControl<string>;
  titulo: FormControl<string>;
  descricao: FormControl<string>;
  perguntas: FormArray<PerguntaForm>;
}>;

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
  imports: [ReactiveFormsModule, CabecalhoForm],
  templateUrl: './editor.html',
  styleUrl: './editor.css',
})
export class Editor implements OnInit, OnDestroy {
  private readonly api = inject(FormulariosService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);

  /** Vem da rota /forms/:id/editar */
  readonly id = input.required<string>();

  protected readonly tipos = TIPOS;
  protected readonly cores = CORES;
  protected readonly temOpcoes = (tipo: TipoPergunta) => TEM_OPCOES.includes(tipo);
  protected readonly status = signal<Status>('carregando');
  protected readonly textoStatus = TEXTO_STATUS;
  protected readonly totalRespostas = signal<number | null>(null);

  private aceitandoRespostas = true;

  protected readonly form = this.fb.group({
    titulo: '',
    descricao: '',
    cor: '#673ab7',
    secoes: this.fb.array<SecaoForm>([]),
  });

  get secoes() {
    return this.form.controls.secoes;
  }

  ngOnInit() {
    this.api.buscar(this.id()).subscribe({
      next: (dados) => {
        this.preencher(dados);
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

  // ---------- Montar o formulário a partir dos dados da API ----------

  private preencher(dados: Formulario) {
    this.aceitandoRespostas = dados.aceitandoRespostas;
    this.form.patchValue({ titulo: dados.titulo, descricao: dados.descricao, cor: dados.cor }, { emitEvent: false });
    this.secoes.clear({ emitEvent: false });
    for (const secao of dados.secoes) this.secoes.push(this.criarSecao(secao), { emitEvent: false });
  }

  private criarSecao(s: Secao): SecaoForm {
    return this.fb.group({
      id: s.id,
      titulo: s.titulo,
      descricao: s.descricao,
      perguntas: this.fb.array(s.perguntas.map((p) => this.criarPergunta(p))),
    });
  }

  private criarPergunta(p: Pergunta): PerguntaForm {
    const escala = p.escala ?? { min: 1, max: 5, rotuloMin: '', rotuloMax: '' };
    const grupo: PerguntaForm = this.fb.group({
      id: p.id,
      tipo: this.fb.control<TipoPergunta>(p.tipo),
      titulo: p.titulo,
      obrigatoria: p.obrigatoria,
      opcoes: this.fb.array(p.opcoes.map((o) => this.fb.control(o))),
      escala: this.fb.group({
        min: escala.min,
        max: escala.max,
        rotuloMin: escala.rotuloMin,
        rotuloMax: escala.rotuloMax,
      }),
    });
    // Ao virar um tipo com opções (ex: curta -> múltipla), garante pelo menos uma.
    grupo.controls.tipo.valueChanges.subscribe((tipo) => {
      if (this.temOpcoes(tipo) && grupo.controls.opcoes.length === 0) {
        grupo.controls.opcoes.push(this.fb.control('Opção 1'));
      }
    });
    return grupo;
  }

  /** Converte o FormGroup de volta para o formato da API. */
  private paraModelo(): FormularioEntrada {
    const v = this.form.getRawValue();
    return {
      titulo: v.titulo,
      descricao: v.descricao,
      cor: v.cor,
      aceitandoRespostas: this.aceitandoRespostas,
      secoes: v.secoes.map((s) => ({
        ...s,
        perguntas: s.perguntas.map((p) => ({
          ...p,
          opcoes: this.temOpcoes(p.tipo) ? p.opcoes : [],
          escala: p.tipo === 'escala' ? p.escala : null,
        })),
      })),
    };
  }

  // ---------- Salvamento automático ----------

  private ativarSalvamentoAutomatico() {
    this.form.valueChanges
      .pipe(
        tap(() => this.status.set('pendente')),
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
          // O fluxo morre no erro; religamos para continuar tentando nas próximas edições.
          this.ativarSalvamentoAutomatico();
        },
      });
  }

  // ---------- Ações das perguntas ----------

  perguntasDe(secaoIndex: number) {
    return this.secoes.at(secaoIndex).controls.perguntas;
  }

  adicionarPergunta(secaoIndex: number, posicao?: number) {
    const lista = this.perguntasDe(secaoIndex);
    const nova = this.criarPergunta(novaPergunta());
    lista.insert(posicao ?? lista.length, nova);
    this.focar(`p-${nova.controls.id.value}`);
  }

  duplicar(secaoIndex: number, i: number) {
    const original = this.perguntasDe(secaoIndex).at(i).getRawValue();
    const copia = this.criarPergunta({ ...original, id: gerarId() });
    this.perguntasDe(secaoIndex).insert(i + 1, copia);
    this.focar(`p-${copia.controls.id.value}`);
  }

  removerPergunta(secaoIndex: number, i: number) {
    this.perguntasDe(secaoIndex).removeAt(i);
  }

  mover(secaoIndex: number, i: number, direcao: -1 | 1) {
    const lista = this.perguntasDe(secaoIndex);
    const destino = i + direcao;
    if (destino < 0 || destino >= lista.length) return;
    const item = lista.at(i);
    lista.removeAt(i, { emitEvent: false });
    lista.insert(destino, item);
  }

  adicionarOpcao(p: PerguntaForm) {
    p.controls.opcoes.push(this.fb.control(`Opção ${p.controls.opcoes.length + 1}`));
    this.focar(`o-${p.controls.id.value}-${p.controls.opcoes.length - 1}`);
  }

  removerOpcao(p: PerguntaForm, j: number) {
    if (p.controls.opcoes.length > 1) p.controls.opcoes.removeAt(j);
  }

  /** Números possíveis para o "até" da escala linear (2..10). */
  readonly maximos = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  // ---------- Ações das seções ----------

  adicionarSecao() {
    const secao = this.criarSecao(novaSecao());
    this.secoes.push(secao);
    this.focar(`s-${secao.controls.id.value}`);
  }

  /** Remove a seção e manda as perguntas dela para a seção anterior. */
  removerSecao(i: number) {
    if (i === 0) return;
    const perguntas = this.perguntasDe(i).controls;
    for (const p of perguntas) this.perguntasDe(i - 1).push(p, { emitEvent: false });
    this.secoes.removeAt(i);
  }

  escolherCor(cor: string) {
    this.form.controls.cor.setValue(cor);
  }

  /** Coloca o cursor no campo recém-criado, depois que o Angular desenhar ele. */
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
