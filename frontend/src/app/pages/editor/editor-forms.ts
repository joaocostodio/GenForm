// Monta os Reactive Forms do editor a partir do modelo e converte de volta.
// Cada seção é um FormGroup com um FormArray de perguntas; cada pergunta tem
// um FormArray de opções (texto + se é a correta + para onde desviar).
import { FormArray, FormBuilder, FormControl, FormGroup } from '@angular/forms';
import {
  CORRIGIVEL,
  Pergunta,
  REGRAS,
  RegraValidacao,
  Secao,
  TEM_DESVIO,
  TEM_OPCOES,
  TEM_OUTRO,
  TipoPergunta,
} from '../../models/formulario';

const fb = new FormBuilder().nonNullable;

export type OpcaoForm = FormGroup<{
  texto: FormControl<string>;
  correta: FormControl<boolean>;
  irPara: FormControl<string>;
}>;

export type PerguntaForm = FormGroup<{
  id: FormControl<string>;
  tipo: FormControl<TipoPergunta>;
  titulo: FormControl<string>;
  descricao: FormControl<string>;
  obrigatoria: FormControl<boolean>;
  opcoes: FormArray<OpcaoForm>;
  permitirOutro: FormControl<boolean>;
  usarDesvios: FormControl<boolean>;
  escala: FormGroup<{
    min: FormControl<number>;
    max: FormControl<number>;
    rotuloMin: FormControl<string>;
    rotuloMax: FormControl<string>;
  }>;
  grade: FormGroup<{ linhas: FormArray<FormControl<string>>; colunas: FormArray<FormControl<string>> }>;
  validacao: FormGroup<{
    ativa: FormControl<boolean>;
    regra: FormControl<RegraValidacao>;
    min: FormControl<number | null>;
    max: FormControl<number | null>;
    mensagem: FormControl<string>;
  }>;
  quiz: FormGroup<{
    pontos: FormControl<number>;
    /** Respostas aceitas da resposta curta, uma por linha */
    aceitas: FormControl<string>;
    feedback: FormControl<string>;
  }>;
}>;

export type SecaoForm = FormGroup<{
  id: FormControl<string>;
  titulo: FormControl<string>;
  descricao: FormControl<string>;
  depois: FormControl<string>;
  perguntas: FormArray<PerguntaForm>;
}>;

export const criarOpcao = (texto: string, correta = false, irPara = '') =>
  fb.group({ texto, correta, irPara });

export const textoControl = (valor: string) => fb.control(valor);

export function criarPergunta(p: Pergunta): PerguntaForm {
  const escala = p.escala ?? { min: 1, max: 5, rotuloMin: '', rotuloMax: '' };
  const grade = p.grade ?? { linhas: ['Linha 1'], colunas: ['Coluna 1'] };
  const corretas = p.quiz.corretas ?? [];

  const grupo: PerguntaForm = fb.group({
    id: p.id,
    tipo: fb.control<TipoPergunta>(p.tipo),
    titulo: p.titulo,
    descricao: p.descricao,
    obrigatoria: p.obrigatoria,
    opcoes: fb.array(p.opcoes.map((texto, i) => criarOpcao(texto, corretas.includes(texto), p.desvios[i] ?? ''))),
    permitirOutro: p.permitirOutro,
    usarDesvios: p.usarDesvios,
    escala: fb.group({ min: escala.min, max: escala.max, rotuloMin: escala.rotuloMin, rotuloMax: escala.rotuloMax }),
    grade: fb.group({ linhas: fb.array(grade.linhas.map(textoControl)), colunas: fb.array(grade.colunas.map(textoControl)) }),
    validacao: fb.group({
      ativa: p.validacao !== null,
      regra: fb.control<RegraValidacao>(p.validacao?.regra ?? REGRAS[p.tipo]?.[0].valor ?? 'tamanho'),
      min: fb.control<number | null>(p.validacao?.min ?? null),
      max: fb.control<number | null>(p.validacao?.max ?? null),
      mensagem: p.validacao?.mensagem ?? '',
    }),
    quiz: fb.group({
      pontos: p.quiz.pontos,
      aceitas: p.tipo === 'curta' ? corretas.join('\n') : '',
      feedback: p.quiz.feedback ?? '',
    }),
  });

  // Ao trocar o tipo, deixa a pergunta coerente com o tipo novo.
  grupo.controls.tipo.valueChanges.subscribe((tipo) => {
    if (TEM_OPCOES.includes(tipo) && grupo.controls.opcoes.length === 0) {
      grupo.controls.opcoes.push(criarOpcao('Opção 1'));
    }
    const regras = REGRAS[tipo] ?? [];
    const v = grupo.controls.validacao.controls;
    if (!regras.some((r) => r.valor === v.regra.value)) {
      v.regra.setValue(regras[0]?.valor ?? 'tamanho');
      v.ativa.setValue(false);
    }
  });
  return grupo;
}

export function criarSecao(s: Secao): SecaoForm {
  return fb.group({
    id: s.id,
    titulo: s.titulo,
    descricao: s.descricao,
    depois: s.depois,
    perguntas: fb.array(s.perguntas.map(criarPergunta)),
  });
}

/** FormGroup da pergunta -> formato da API. */
export function paraPergunta(grupo: PerguntaForm): Pergunta {
  const v = grupo.getRawValue();
  const comOpcoes = TEM_OPCOES.includes(v.tipo);
  const comDesvio = TEM_DESVIO.includes(v.tipo) && v.usarDesvios;
  const temRegra = v.validacao.ativa && (REGRAS[v.tipo] ?? []).some((r) => r.valor === v.validacao.regra);

  let corretas: string[] = [];
  if (v.tipo === 'curta') corretas = v.quiz.aceitas.split('\n').map((t) => t.trim()).filter(Boolean);
  else if (comOpcoes) corretas = v.opcoes.filter((o) => o.correta).map((o) => o.texto);

  return {
    id: v.id,
    tipo: v.tipo,
    titulo: v.titulo,
    descricao: v.descricao,
    obrigatoria: v.obrigatoria,
    opcoes: comOpcoes ? v.opcoes.map((o) => o.texto) : [],
    permitirOutro: TEM_OUTRO.includes(v.tipo) && v.permitirOutro,
    usarDesvios: comDesvio,
    desvios: comDesvio ? v.opcoes.map((o) => o.irPara) : [],
    escala: v.tipo === 'escala' ? v.escala : null,
    grade: v.tipo === 'grade' ? v.grade : null,
    validacao: temRegra
      ? { regra: v.validacao.regra, min: v.validacao.min, max: v.validacao.max, mensagem: v.validacao.mensagem }
      : null,
    quiz: { pontos: v.quiz.pontos, corretas: CORRIGIVEL.includes(v.tipo) ? corretas : [], feedback: v.quiz.feedback },
  };
}

export function paraSecao(grupo: SecaoForm): Secao {
  const v = grupo.getRawValue();
  return {
    id: v.id,
    titulo: v.titulo,
    descricao: v.descricao,
    depois: v.depois,
    perguntas: grupo.controls.perguntas.controls.map(paraPergunta),
  };
}
