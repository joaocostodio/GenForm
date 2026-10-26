// Tipos compartilhados entre as telas. Espelham o que a API em server/ devolve.

export type TipoPergunta = 'curta' | 'paragrafo' | 'multipla' | 'caixas' | 'lista' | 'escala';

export interface Escala {
  min: number;
  max: number;
  rotuloMin: string;
  rotuloMax: string;
}

export interface Pergunta {
  id: string;
  tipo: TipoPergunta;
  titulo: string;
  obrigatoria: boolean;
  opcoes: string[];
  escala: Escala | null;
}

export interface Secao {
  id: string;
  titulo: string;
  descricao: string;
  perguntas: Pergunta[];
}

export interface Formulario {
  id: string;
  titulo: string;
  descricao: string;
  cor: string;
  aceitandoRespostas: boolean;
  criadoEm: string;
  atualizadoEm: string;
  secoes: Secao[];
}

export interface FormularioResumo
  extends Pick<Formulario, 'id' | 'titulo' | 'descricao' | 'cor' | 'aceitandoRespostas' | 'criadoEm' | 'atualizadoEm'> {
  totalRespostas: number;
}

export type ValorResposta = string | string[] | number;

export interface Resposta {
  id: string;
  enviadoEm: string;
  valores: Record<string, ValorResposta>;
}

/** O que mandamos para criar/salvar (o servidor cuida de id e datas). */
export type FormularioEntrada = Pick<Formulario, 'titulo' | 'descricao' | 'cor' | 'aceitandoRespostas' | 'secoes'>;

export const TIPOS: { valor: TipoPergunta; rotulo: string; icone: string }[] = [
  { valor: 'curta', rotulo: 'Resposta curta', icone: '—' },
  { valor: 'paragrafo', rotulo: 'Parágrafo', icone: '≡' },
  { valor: 'multipla', rotulo: 'Múltipla escolha', icone: '◉' },
  { valor: 'caixas', rotulo: 'Caixas de seleção', icone: '☑' },
  { valor: 'lista', rotulo: 'Lista suspensa', icone: '▾' },
  { valor: 'escala', rotulo: 'Escala linear', icone: '⋯' },
];

export const TEM_OPCOES: TipoPergunta[] = ['multipla', 'caixas', 'lista'];

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
    obrigatoria: false,
    opcoes: TEM_OPCOES.includes(tipo) ? ['Opção 1'] : [],
    escala: tipo === 'escala' ? { min: 1, max: 5, rotuloMin: '', rotuloMax: '' } : null,
  };
}

export function novaSecao(): Secao {
  return { id: gerarId(), titulo: '', descricao: '', perguntas: [] };
}

/** Modelos prontos que aparecem no painel, como no Google Forms. */
export const MODELOS: { nome: string; dados: Partial<FormularioEntrada> }[] = [
  {
    nome: 'Pesquisa de satisfação',
    dados: {
      titulo: 'Pesquisa de satisfação',
      descricao: 'Conte para a gente como foi a sua experiência.',
      cor: '#009688',
      secoes: [
        {
          id: gerarId(),
          titulo: '',
          descricao: '',
          perguntas: [
            { ...novaPergunta('escala'), titulo: 'De 1 a 5, quanto você ficou satisfeito?', obrigatoria: true,
              escala: { min: 1, max: 5, rotuloMin: 'Nada satisfeito', rotuloMax: 'Muito satisfeito' } },
            { ...novaPergunta('multipla'), titulo: 'Você indicaria para um amigo?', obrigatoria: true,
              opcoes: ['Sim', 'Talvez', 'Não'] },
            { ...novaPergunta('paragrafo'), titulo: 'O que podemos melhorar?' },
          ],
        },
      ],
    },
  },
  {
    nome: 'Inscrição em evento',
    dados: {
      titulo: 'Inscrição em evento',
      descricao: 'Preencha seus dados para garantir sua vaga.',
      cor: '#1e88e5',
      secoes: [
        {
          id: gerarId(),
          titulo: '',
          descricao: '',
          perguntas: [
            { ...novaPergunta('curta'), titulo: 'Nome completo', obrigatoria: true },
            { ...novaPergunta('curta'), titulo: 'E-mail', obrigatoria: true },
            { ...novaPergunta('lista'), titulo: 'Turno', obrigatoria: true, opcoes: ['Manhã', 'Tarde', 'Noite'] },
            { ...novaPergunta('caixas'), titulo: 'Quais oficinas te interessam?',
              opcoes: ['Angular', 'Node.js', 'Banco de dados', 'Git e GitHub'] },
          ],
        },
      ],
    },
  },
];
