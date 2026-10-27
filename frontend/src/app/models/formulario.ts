// Tipos compartilhados entre as telas. Espelham o que o backend devolve
// (ver backend/src/validacao.mjs, que é a fonte da verdade das regras).

export type TipoPergunta = 'curta' | 'paragrafo' | 'multipla' | 'caixas' | 'lista' | 'escala' | 'data' | 'hora' | 'grade';
export type RegraValidacao = 'email' | 'url' | 'numero' | 'tamanho' | 'selecao';

export interface Escala {
  min: number;
  max: number;
  rotuloMin: string;
  rotuloMax: string;
}

export interface Grade {
  linhas: string[];
  colunas: string[];
}

export interface Validacao {
  regra: RegraValidacao;
  min: number | null;
  max: number | null;
  mensagem: string;
}

export interface Quiz {
  pontos: number;
  /** Gabarito. Some no link público (o backend remove). */
  corretas?: string[];
  feedback?: string;
}

export interface Pergunta {
  id: string;
  tipo: TipoPergunta;
  titulo: string;
  descricao: string;
  obrigatoria: boolean;
  opcoes: string[];
  permitirOutro: boolean;
  /** Lógica condicional: desvios[i] é o destino da opção i ('' = padrão da seção, 'enviar' ou id da seção). */
  usarDesvios: boolean;
  desvios: string[];
  escala: Escala | null;
  grade: Grade | null;
  validacao: Validacao | null;
  quiz: Quiz;
}

export interface Secao {
  id: string;
  titulo: string;
  descricao: string;
  /** Para onde ir depois desta seção: '' (próxima), 'enviar' ou id de outra seção. */
  depois: string;
  perguntas: Pergunta[];
}

export interface ConfigForm {
  aceitandoRespostas: boolean;
  exigirLogin: boolean;
  umaRespostaPorPessoa: boolean;
  permitirOutraResposta: boolean;
  mensagemConfirmacao: string;
  dataLimite: string | null;
  limiteRespostas: number | null;
  embaralharPerguntas: boolean;
  barraProgresso: boolean;
  modoTeste: boolean;
  mostrarNota: boolean;
}

export interface Formulario {
  id: string;
  titulo: string;
  descricao: string;
  cor: string;
  criadoEm: string;
  atualizadoEm: string;
  config: ConfigForm;
  secoes: Secao[];
}

export interface FormularioResumo {
  id: string;
  titulo: string;
  descricao: string;
  cor: string;
  criadoEm: string;
  atualizadoEm: string;
  aceitandoRespostas: boolean;
  modoTeste: boolean;
  totalRespostas: number;
}

/** O que o editor salva. A tela de configurações salva { config } separado. */
export type ConteudoForm = Pick<Formulario, 'titulo' | 'descricao' | 'cor' | 'secoes'>;
export type NovoForm = Partial<ConteudoForm> & { config?: Partial<ConfigForm> };

// ---------- Responder ----------

export type StatusPublico = 'aberto' | 'fechado' | 'prazo' | 'limite' | 'precisa-login' | 'ja-respondeu';

export interface FormularioPublico {
  status: StatusPublico;
  usuario: Usuario | null;
  form: Pick<Formulario, 'id' | 'titulo' | 'descricao' | 'cor' | 'secoes'> & {
    config: Pick<ConfigForm, 'exigirLogin' | 'permitirOutraResposta' | 'embaralharPerguntas' | 'barraProgresso' | 'modoTeste'>;
  };
}

export type ValorResposta = string | string[] | number | Record<string, string>;

export interface DetalheNota {
  perguntaId: string;
  correta: boolean;
  corretas: string[];
  feedback: string;
}

export interface Nota {
  pontos: number;
  total: number;
}

export interface ResultadoEnvio {
  mensagemConfirmacao: string;
  permitirOutraResposta: boolean;
  nota: (Nota & { detalhes: DetalheNota[] }) | null;
}

export interface Resposta {
  id: string;
  enviadoEm: string;
  valores: Record<string, ValorResposta>;
  respondente: Usuario | null;
  nota: Nota | null;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
}

// ---------- Constantes e fábricas ----------

export const TIPOS: { valor: TipoPergunta; rotulo: string; icone: string }[] = [
  { valor: 'curta', rotulo: 'Resposta curta', icone: '—' },
  { valor: 'paragrafo', rotulo: 'Parágrafo', icone: '≡' },
  { valor: 'multipla', rotulo: 'Múltipla escolha', icone: '◉' },
  { valor: 'caixas', rotulo: 'Caixas de seleção', icone: '☑' },
  { valor: 'lista', rotulo: 'Lista suspensa', icone: '▾' },
  { valor: 'escala', rotulo: 'Escala linear', icone: '⋯' },
  { valor: 'grade', rotulo: 'Grade de múltipla escolha', icone: '▦' },
  { valor: 'data', rotulo: 'Data', icone: '📅' },
  { valor: 'hora', rotulo: 'Hora', icone: '🕒' },
];

export const TEM_OPCOES: TipoPergunta[] = ['multipla', 'caixas', 'lista'];
export const TEM_DESVIO: TipoPergunta[] = ['multipla', 'lista'];
export const TEM_OUTRO: TipoPergunta[] = ['multipla', 'caixas'];
export const CORRIGIVEL: TipoPergunta[] = ['curta', 'multipla', 'caixas', 'lista'];

export const REGRAS: Partial<Record<TipoPergunta, { valor: RegraValidacao; rotulo: string }[]>> = {
  curta: [
    { valor: 'email', rotulo: 'E-mail' },
    { valor: 'url', rotulo: 'Link (URL)' },
    { valor: 'numero', rotulo: 'Número' },
    { valor: 'tamanho', rotulo: 'Quantidade de caracteres' },
  ],
  paragrafo: [{ valor: 'tamanho', rotulo: 'Quantidade de caracteres' }],
  caixas: [{ valor: 'selecao', rotulo: 'Quantidade de opções marcadas' }],
};

export const CORES = ['#673ab7', '#3f51b5', '#1e88e5', '#009688', '#43a047', '#f4511e', '#e91e63', '#5f6368'];

// getRandomValues funciona mesmo fora de HTTPS (ex: colega acessando pelo IP da rede).
export function gerarId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function novaPergunta(tipo: TipoPergunta = 'multipla'): Pergunta {
  return {
    id: gerarId(),
    tipo,
    titulo: '',
    descricao: '',
    obrigatoria: false,
    opcoes: TEM_OPCOES.includes(tipo) ? ['Opção 1'] : [],
    permitirOutro: false,
    usarDesvios: false,
    desvios: [],
    escala: tipo === 'escala' ? { min: 1, max: 5, rotuloMin: '', rotuloMax: '' } : null,
    grade: tipo === 'grade' ? { linhas: ['Linha 1'], colunas: ['Coluna 1'] } : null,
    validacao: null,
    quiz: { pontos: 1, corretas: [], feedback: '' },
  };
}

export function novaSecao(): Secao {
  return { id: gerarId(), titulo: '', descricao: '', depois: '', perguntas: [] };
}

const pergunta = (base: Partial<Pergunta> & { tipo: TipoPergunta }): Pergunta => ({ ...novaPergunta(base.tipo), ...base });

/** Modelos prontos que aparecem no painel, como no Google Forms. */
export const MODELOS: { nome: string; dados: () => NovoForm }[] = [
  {
    nome: 'Pesquisa de satisfação',
    dados: () => ({
      titulo: 'Pesquisa de satisfação',
      descricao: 'Conte para a gente como foi a sua experiência.',
      cor: '#009688',
      secoes: [
        { ...novaSecao(), perguntas: [
          pergunta({ tipo: 'escala', titulo: 'De 1 a 5, quanto você ficou satisfeito?', obrigatoria: true,
            escala: { min: 1, max: 5, rotuloMin: 'Nada satisfeito', rotuloMax: 'Muito satisfeito' } }),
          pergunta({ tipo: 'multipla', titulo: 'Você indicaria para um amigo?', obrigatoria: true, opcoes: ['Sim', 'Talvez', 'Não'] }),
          pergunta({ tipo: 'paragrafo', titulo: 'O que podemos melhorar?' }),
        ] },
      ],
    }),
  },
  {
    nome: 'Inscrição em evento',
    dados: () => ({
      titulo: 'Inscrição em evento',
      descricao: 'Preencha seus dados para garantir sua vaga.',
      cor: '#1e88e5',
      secoes: [
        { ...novaSecao(), perguntas: [
          pergunta({ tipo: 'curta', titulo: 'Nome completo', obrigatoria: true }),
          pergunta({ tipo: 'curta', titulo: 'E-mail', obrigatoria: true,
            descricao: 'Projeto de aula: use um e-mail fictício (ex: seunome@teste.com), não o seu e-mail real.',
            validacao: { regra: 'email', min: null, max: null, mensagem: '' } }),
          pergunta({ tipo: 'lista', titulo: 'Turno', obrigatoria: true, opcoes: ['Manhã', 'Tarde', 'Noite'] }),
          pergunta({ tipo: 'caixas', titulo: 'Quais oficinas te interessam?', permitirOutro: true,
            opcoes: ['Angular', 'Node.js', 'Banco de dados', 'Git e GitHub'] }),
          pergunta({ tipo: 'data', titulo: 'Data de nascimento' }),
        ] },
      ],
    }),
  },
  {
    nome: 'Teste (quiz)',
    dados: () => ({
      titulo: 'Teste de conhecimentos',
      descricao: 'Responda e veja sua nota ao final.',
      cor: '#f4511e',
      config: { modoTeste: true, mostrarNota: true },
      secoes: [
        { ...novaSecao(), perguntas: [
          pergunta({ tipo: 'multipla', titulo: 'Qual comando cria um projeto Angular?', obrigatoria: true,
            opcoes: ['ng new', 'npm init', 'ng start'], quiz: { pontos: 2, corretas: ['ng new'], feedback: 'O Angular CLI cria projetos com ng new.' } }),
          pergunta({ tipo: 'caixas', titulo: 'Quais são frameworks/bibliotecas de frontend?', obrigatoria: true,
            opcoes: ['Angular', 'Express', 'React', 'PostgreSQL'], quiz: { pontos: 2, corretas: ['Angular', 'React'], feedback: '' } }),
          pergunta({ tipo: 'curta', titulo: 'Em que linguagem o Angular é escrito?', obrigatoria: true,
            quiz: { pontos: 1, corretas: ['TypeScript', 'TS'], feedback: '' } }),
        ] },
      ],
    }),
  },
];
