import { Formulario, Resposta } from '../models/formulario';
import { gerarCsv } from './csv';

const form: Formulario = {
  id: 'f1',
  titulo: 'Teste',
  descricao: '',
  cor: '#673ab7',
  aceitandoRespostas: true,
  criadoEm: '',
  atualizadoEm: '',
  secoes: [
    {
      id: 's1',
      titulo: '',
      descricao: '',
      perguntas: [
        { id: 'nome', tipo: 'curta', titulo: 'Nome', obrigatoria: true, opcoes: [], escala: null },
        { id: 'temas', tipo: 'caixas', titulo: 'Temas', obrigatoria: false, opcoes: ['A', 'B'], escala: null },
      ],
    },
  ],
};

describe('gerarCsv', () => {
  it('monta cabeçalho e junta caixas de seleção com ";"', () => {
    const respostas: Resposta[] = [{ id: 'r1', enviadoEm: '2026-10-26T12:00:00Z', valores: { nome: 'Ana', temas: ['A', 'B'] } }];
    const [cabecalho, linha] = gerarCsv(form, respostas).split('\r\n');
    expect(cabecalho).toBe('"Data/hora";"Nome";"Temas"');
    expect(linha).toContain('"Ana";"A; B"');
  });

  it('escapa aspas e neutraliza fórmulas do Excel', () => {
    const respostas: Resposta[] = [{ id: 'r1', enviadoEm: '2026-10-26T12:00:00Z', valores: { nome: '=SOMA(1) "x"' } }];
    const linha = gerarCsv(form, respostas).split('\r\n')[1];
    expect(linha).toContain(`"'=SOMA(1) ""x"""`);
  });
});
