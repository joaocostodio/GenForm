// Limpa o que chega do navegador. Nunca confiamos no corpo da requisição:
// só copiamos os campos conhecidos, com tipo e tamanho controlados.
import { randomBytes } from 'node:crypto';

export const TIPOS = ['curta', 'paragrafo', 'multipla', 'caixas', 'lista', 'escala'];
const TIPOS_COM_OPCOES = ['multipla', 'caixas', 'lista'];

export const novoId = () => randomBytes(6).toString('base64url');

const texto = (valor, max) => (typeof valor === 'string' ? valor.slice(0, max) : '');
const inteiro = (valor, min, max, padrao) => {
  const n = Number.parseInt(valor, 10);
  return Number.isNaN(n) ? padrao : Math.min(max, Math.max(min, n));
};
const lista = (valor, max) => (Array.isArray(valor) ? valor.slice(0, max) : []);
const corValida = (valor) => (typeof valor === 'string' && /^#[0-9a-f]{6}$/i.test(valor) ? valor : '#673ab7');

function normalizarPergunta(p = {}) {
  const tipo = TIPOS.includes(p.tipo) ? p.tipo : 'curta';
  const pergunta = {
    id: texto(p.id, 32) || novoId(),
    tipo,
    titulo: texto(p.titulo, 500),
    obrigatoria: p.obrigatoria === true,
    opcoes: [],
    escala: null,
  };
  if (TIPOS_COM_OPCOES.includes(tipo)) {
    pergunta.opcoes = lista(p.opcoes, 100).map((o) => texto(o, 300));
  }
  if (tipo === 'escala') {
    const e = p.escala ?? {};
    const min = inteiro(e.min, 0, 1, 1);
    pergunta.escala = {
      min,
      max: inteiro(e.max, min + 1, 10, 5),
      rotuloMin: texto(e.rotuloMin, 100),
      rotuloMax: texto(e.rotuloMax, 100),
    };
  }
  return pergunta;
}

function normalizarSecao(s = {}) {
  return {
    id: texto(s.id, 32) || novoId(),
    titulo: texto(s.titulo, 500),
    descricao: texto(s.descricao, 2000),
    perguntas: lista(s.perguntas, 200).map(normalizarPergunta),
  };
}

export function normalizarForm(corpo = {}) {
  const secoes = lista(corpo.secoes, 50).map(normalizarSecao);
  return {
    titulo: texto(corpo.titulo, 300) || 'Formulário sem título',
    descricao: texto(corpo.descricao, 5000),
    cor: corValida(corpo.cor),
    aceitandoRespostas: corpo.aceitandoRespostas !== false,
    secoes: secoes.length ? secoes : [normalizarSecao()],
  };
}

const vazio = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// Confere uma resposta contra as perguntas do formulário.
// Devolve { valores } limpos ou { erros } por id de pergunta.
export function validarResposta(form, corpo = {}) {
  const entrada = corpo.valores ?? {};
  const valores = {};
  const erros = {};

  for (const pergunta of form.secoes.flatMap((s) => s.perguntas)) {
    const v = entrada[pergunta.id];

    if (vazio(v)) {
      if (pergunta.obrigatoria) erros[pergunta.id] = 'Esta pergunta é obrigatória';
      continue;
    }

    switch (pergunta.tipo) {
      case 'curta':
      case 'paragrafo':
        if (typeof v !== 'string') erros[pergunta.id] = 'Resposta inválida';
        else valores[pergunta.id] = v.slice(0, pergunta.tipo === 'curta' ? 500 : 5000);
        break;
      case 'multipla':
      case 'lista':
        if (!pergunta.opcoes.includes(v)) erros[pergunta.id] = 'Opção inválida';
        else valores[pergunta.id] = v;
        break;
      case 'caixas':
        if (!Array.isArray(v) || !v.every((o) => pergunta.opcoes.includes(o))) {
          erros[pergunta.id] = 'Opção inválida';
        } else {
          // Mantém a ordem das opções e remove repetidas
          valores[pergunta.id] = pergunta.opcoes.filter((o) => v.includes(o));
        }
        break;
      case 'escala': {
        const n = Number(v);
        const { min, max } = pergunta.escala;
        if (!Number.isInteger(n) || n < min || n > max) erros[pergunta.id] = 'Valor fora da escala';
        else valores[pergunta.id] = n;
        break;
      }
    }
  }

  return Object.keys(erros).length ? { erros } : { valores };
}
