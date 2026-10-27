import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { CORRIGIVEL, REGRAS, TEM_DESVIO, TEM_OPCOES, TEM_OUTRO, TIPOS, TipoPergunta } from '../../models/formulario';
import { PerguntaForm, criarOpcao, textoControl } from './editor-forms';

export interface Destino {
  valor: string;
  rotulo: string;
}

/** Cartão de edição de UMA pergunta. O editor (pai) cuida da lista, este cuida do conteúdo. */
@Component({
  selector: 'app-pergunta-editor',
  imports: [ReactiveFormsModule, CdkDragHandle],
  templateUrl: './pergunta-editor.html',
  styleUrl: './pergunta-editor.css',
})
export class PerguntaEditor implements OnInit {
  readonly grupo = input.required<PerguntaForm>();
  /** Para onde as opções podem desviar (lógica condicional). */
  readonly destinos = input<Destino[]>([]);
  readonly modoTeste = input(false);
  readonly primeira = input(false);
  readonly ultima = input(false);

  readonly duplicar = output<void>();
  readonly remover = output<void>();
  readonly mover = output<-1 | 1>();

  protected readonly tipos = TIPOS;
  protected readonly maximos = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  protected readonly mostrarDescricao = signal(false);
  protected readonly mostrarGabarito = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  /** O tipo vira signal para os computed abaixo reagirem quando ele muda. */
  protected readonly tipo = signal<TipoPergunta>('curta');

  protected readonly temOpcoes = computed(() => TEM_OPCOES.includes(this.tipo()));
  protected readonly temOutro = computed(() => TEM_OUTRO.includes(this.tipo()));
  protected readonly temDesvio = computed(() => TEM_DESVIO.includes(this.tipo()));
  protected readonly corrigivel = computed(() => CORRIGIVEL.includes(this.tipo()));
  protected readonly regras = computed(() => REGRAS[this.tipo()] ?? []);

  ngOnInit() {
    const c = this.grupo().controls;
    this.tipo.set(c.tipo.value);
    c.tipo.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((t) => this.tipo.set(t));
    this.mostrarDescricao.set(c.descricao.value !== '');
  }

  get c() {
    return this.grupo().controls;
  }

  marcador(j: number) {
    return this.tipo() === 'multipla' ? '○' : this.tipo() === 'caixas' ? '☐' : `${j + 1}.`;
  }

  // ---------- Opções ----------

  adicionarOpcao() {
    this.c.opcoes.push(criarOpcao(`Opção ${this.c.opcoes.length + 1}`));
    focar(`o-${this.c.id.value}-${this.c.opcoes.length - 1}`);
  }

  removerOpcao(j: number) {
    if (this.c.opcoes.length > 1) this.c.opcoes.removeAt(j);
  }

  /** Gabarito: em múltipla escolha/lista só uma correta; em caixas, várias. */
  alternarCorreta(j: number) {
    const opcoes = this.c.opcoes.controls;
    const marcar = !opcoes[j].controls.correta.value;
    if (this.tipo() !== 'caixas') opcoes.forEach((o) => o.controls.correta.setValue(false, { emitEvent: false }));
    opcoes[j].controls.correta.setValue(marcar);
  }

  // ---------- Grade ----------

  adicionarItem(onde: 'linhas' | 'colunas') {
    const lista = this.c.grade.controls[onde];
    lista.push(textoControl(`${onde === 'linhas' ? 'Linha' : 'Coluna'} ${lista.length + 1}`));
    focar(`g-${this.c.id.value}-${onde}-${lista.length - 1}`);
  }

  removerItem(onde: 'linhas' | 'colunas', j: number) {
    const lista = this.c.grade.controls[onde];
    if (lista.length > 1) lista.removeAt(j);
  }

  // ---------- Menu "mais" ----------

  alternar(qual: 'descricao' | 'validacao' | 'desvios', evento: Event) {
    const ligado = (evento.target as HTMLInputElement).checked;
    if (qual === 'descricao') {
      this.mostrarDescricao.set(ligado);
      if (!ligado) this.c.descricao.setValue('');
    } else if (qual === 'validacao') {
      this.c.validacao.controls.ativa.setValue(ligado);
    } else {
      this.c.usarDesvios.setValue(ligado);
    }
  }
}

/** Coloca o cursor no campo recém-criado, depois que o Angular desenhar ele. */
function focar(idElemento: string) {
  setTimeout(() => {
    const alvo = document.getElementById(idElemento);
    if (alvo instanceof HTMLInputElement) {
      alvo.focus();
      alvo.select();
    }
  });
}
