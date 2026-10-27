import { Formulario, Resposta, novaPergunta } from '../models/formulario';
import { gerarCsv } from './csv';

function form(modoTeste = false): Formulario {
  return {
    id: 'f1',
    titulo: 'Teste',
    descricao: '',
    cor: '#673ab7',
    criadoEm: '',
    atualizadoEm: '',
    config: {
      aceitandoRespostas: true, exigirLogin: false, umaRespostaPorPessoa: false, permitirOutraResposta: true,
      mensagemConfirmacao: '', dataLimite: null, limiteRespostas: null, embaralharPerguntas: false,
      barraProgresso: true, modoTeste, mostrarNota: true,
    },
    secoes: [
      {
        id: 's1', titulo: '', descricao: '', depois: '',
        perguntas: [
          { ...novaPergunta('curta'), id: 'nome', titulo: 'Nome' },
          { ...novaPergunta('caixas'), id: 'temas', titulo: 'Temas', opcoes: ['A', 'B'] },
          { ...novaPergunta('grade'), id: 'g', titulo: 'Avalie', grade: { linhas: ['Aula', 'Prova'], colunas: ['Boa', 'Ruim'] } },
        ],
      },
    ],
  };
}

const resposta = (valores: Resposta['valores'], extra: Partial<Resposta> = {}): Resposta => ({
  id: 'r1', enviadoEm: '2026-10-26T12:00:00Z', valores, respondente: null, nota: null, ...extra,
});

describe('gerarCsv', () => {
  it('junta caixas com ";" e abre a grade em uma coluna por linha', () => {
    const [cabecalho, linha] = gerarCsv(form(), [resposta({ nome: 'Ana', temas: ['A', 'B'], g: { Aula: 'Boa', Prova: 'Ruim' } })]).split('\r\n');
    expect(cabecalho).toBe('"Data/hora";"Nome";"Temas";"Avalie [Aula]";"Avalie [Prova]"');
    expect(linha).toContain('"Ana";"A; B";"Boa";"Ruim"');
  });

  it('inclui nome, e-mail e nota quando existem', () => {
    const r = resposta({ nome: 'Ana' }, { respondente: { id: 'u', nome: 'Ana', email: 'ana@x.com' }, nota: { pontos: 3, total: 5 } });
    const [cabecalho, linha] = gerarCsv(form(true), [r]).split('\r\n');
    expect(cabecalho.startsWith('"Data/hora";"Nome";"E-mail";"Nota"')).toBe(true);
    expect(linha).toContain('"Ana";"ana@x.com";"3/5"');
  });

  it('escapa aspas e neutraliza fórmulas do Excel', () => {
    const linha = gerarCsv(form(), [resposta({ nome: '=SOMA(1) "x"' })]).split('\r\n')[1];
    expect(linha).toContain(`"'=SOMA(1) ""x"""`);
  });
});
