// Regras do formulário. Nunca confiamos no que chega do navegador:
// só copiamos os campos conhecidos, com tipo e tamanho controlados.
import { randomBytes } from 'node:crypto';

export const TIPOS = ['curta', 'paragrafo', 'multipla', 'caixas', 'lista', 'escala', 'data', 'hora', 'grade'];
const TIPOS_COM_OPCOES = ['multipla', 'caixas', 'lista'];
const TIPOS_COM_DESVIO = ['multipla', 'lista'];
const TIPOS_COM_OUTRO = ['multipla', 'caixas'];
const TIPOS_CORRIGIVEIS = ['curta', 'multipla', 'caixas', 'lista'];
const REGRAS_POR_TIPO = { curta: ['email', 'url', 'numero', 'tamanho'], paragrafo: ['tamanho'], caixas: ['selecao'] };

export const novoId = () => randomBytes(6).toString('base64url');

const texto = (valor, max) => (typeof valor === 'string' ? valor.slice(0, max) : '');
const inteiro = (valor, min, max, padrao) => {
  const n = Number.parseInt(valor, 10);
  return Number.isNaN(n) ? padrao : Math.min(max, Math.max(min, n));
};
const numeroOuNulo = (valor) => (valor === null || valor === '' || !Number.isFinite(Number(valor)) ? null : Number(valor));
const lista = (valor, max) => (Array.isArray(valor) ? valor.slice(0, max) : []);
const corValida = (valor) => (typeof valor === 'string' && /^#[0-9a-f]{6}$/i.test(valor) ? valor : '#673ab7');
const bool = (valor, padrao = false) => (typeof valor === 'boolean' ? valor : padrao);

// ---------- Formulário ----------

function normalizarPergunta(p = {}) {
  const tipo = TIPOS.includes(p.tipo) ? p.tipo : 'curta';
  const opcoes = TIPOS_COM_OPCOES.includes(tipo) ? lista(p.opcoes, 100).map((o) => texto(o, 300)) : [];

  const pergunta = {
    id: texto(p.id, 32) || novoId(),
    tipo,
    titulo: texto(p.titulo, 500),
    descricao: texto(p.descricao, 2000),
    obrigatoria: p.obrigatoria === true,
    opcoes,
    permitirOutro: TIPOS_COM_OUTRO.includes(tipo) && p.permitirOutro === true,
    usarDesvios: TIPOS_COM_DESVIO.includes(tipo) && p.usarDesvios === true,
    desvios: [],
    escala: null,
    grade: null,
    validacao: null,
    quiz: { pontos: inteiro(p.quiz?.pontos, 0, 1000, 1), corretas: [], feedback: texto(p.quiz?.feedback, 1000) },
  };

  if (pergunta.usarDesvios) pergunta.desvios = opcoes.map((_, i) => texto(p.desvios?.[i], 32));

  if (tipo === 'escala') {
    const e = p.escala ?? {};
    const min = inteiro(e.min, 0, 1, 1);
    pergunta.escala = { min, max: inteiro(e.max, min + 1, 10, 5), rotuloMin: texto(e.rotuloMin, 100), rotuloMax: texto(e.rotuloMax, 100) };
  }

  if (tipo === 'grade') {
    const linhas = lista(p.grade?.linhas, 50).map((l) => texto(l, 200));
    const colunas = lista(p.grade?.colunas, 20).map((c) => texto(c, 200));
    pergunta.grade = { linhas: linhas.length ? linhas : ['Linha 1'], colunas: colunas.length ? colunas : ['Coluna 1'] };
  }

  const regra = p.validacao?.regra;
  if (REGRAS_POR_TIPO[tipo]?.includes(regra)) {
    pergunta.validacao = {
      regra,
      min: numeroOuNulo(p.validacao.min),
      max: numeroOuNulo(p.validacao.max),
      mensagem: texto(p.validacao.mensagem, 200),
    };
  }

  if (TIPOS_CORRIGIVEIS.includes(tipo)) {
    const corretas = lista(p.quiz?.corretas, 100).map((c) => texto(c, 300)).filter(Boolean);
    // Em perguntas de opção, o gabarito tem que ser uma das opções.
    pergunta.quiz.corretas = tipo === 'curta' ? corretas : corretas.filter((c) => opcoes.includes(c));
    if (tipo !== 'curta' && tipo !== 'caixas') pergunta.quiz.corretas = pergunta.quiz.corretas.slice(0, 1);
  }

  return pergunta;
}

function normalizarSecoes(valor) {
  const secoes = lista(valor, 50).map((s = {}) => ({
    id: texto(s.id, 32) || novoId(),
    titulo: texto(s.titulo, 500),
    descricao: texto(s.descricao, 2000),
    depois: texto(s.depois, 32),
    perguntas: lista(s.perguntas, 200).map(normalizarPergunta),
  }));
  if (!secoes.length) secoes.push({ id: novoId(), titulo: '', descricao: '', depois: '', perguntas: [] });

  // Desvios só podem ir para "enviar" ou para uma seção mais à frente.
  // Assim nunca existe um caminho em círculo.
  const posicao = new Map(secoes.map((s, i) => [s.id, i]));
  const destinoValido = (destino, i) => destino === 'enviar' || (posicao.get(destino) ?? -1) > i;
  secoes.forEach((s, i) => {
    if (!destinoValido(s.depois, i)) s.depois = '';
    for (const p of s.perguntas) p.desvios = p.desvios.map((d) => (destinoValido(d, i) ? d : ''));
  });
  return secoes;
}

export function normalizarConfig(c = {}) {
  const prazo = typeof c.dataLimite === 'string' && !Number.isNaN(Date.parse(c.dataLimite)) ? new Date(c.dataLimite).toISOString() : null;
  const limite = numeroOuNulo(c.limiteRespostas);
  const exigirLogin = bool(c.exigirLogin);
  return {
    aceitandoRespostas: bool(c.aceitandoRespostas, true),
    exigirLogin,
    umaRespostaPorPessoa: exigirLogin && bool(c.umaRespostaPorPessoa),
    permitirOutraResposta: bool(c.permitirOutraResposta, true),
    mensagemConfirmacao: texto(c.mensagemConfirmacao, 1000),
    dataLimite: prazo,
    limiteRespostas: limite !== null && limite >= 1 ? Math.floor(limite) : null,
    embaralharPerguntas: bool(c.embaralharPerguntas),
    barraProgresso: bool(c.barraProgresso, true),
    modoTeste: bool(c.modoTeste),
    mostrarNota: bool(c.mostrarNota, true),
  };
}

/** Formulário novo (POST): tudo com valores padrão. */
export function novoForm(corpo = {}) {
  return {
    titulo: texto(corpo.titulo, 300) || 'Formulário sem título',
    descricao: texto(corpo.descricao, 5000),
    cor: corValida(corpo.cor),
    config: normalizarConfig(corpo.config),
    secoes: normalizarSecoes(corpo.secoes),
  };
}

/** Atualização (PUT): só mexe nas partes enviadas, assim editor e configurações não se atropelam. */
export function atualizarForm(form, corpo = {}) {
  if ('titulo' in corpo) form.titulo = texto(corpo.titulo, 300) || 'Formulário sem título';
  if ('descricao' in corpo) form.descricao = texto(corpo.descricao, 5000);
  if ('cor' in corpo) form.cor = corValida(corpo.cor);
  if ('config' in corpo) form.config = normalizarConfig({ ...form.config, ...corpo.config });
  if ('secoes' in corpo) form.secoes = normalizarSecoes(corpo.secoes);
}

/** Versão para quem vai responder: sem gabarito nem feedback. */
export function formPublico(form, incluirPerguntas) {
  return {
    id: form.id,
    titulo: form.titulo,
    descricao: form.descricao,
    cor: form.cor,
    config: {
      exigirLogin: form.config.exigirLogin,
      permitirOutraResposta: form.config.permitirOutraResposta,
      embaralharPerguntas: form.config.embaralharPerguntas,
      barraProgresso: form.config.barraProgresso,
      modoTeste: form.config.modoTeste,
    },
    secoes: incluirPerguntas
      ? form.secoes.map((s) => ({
          ...s,
          perguntas: s.perguntas.map(({ quiz, ...p }) => ({ ...p, quiz: { pontos: quiz.pontos } })),
        }))
      : [],
  };
}

// ---------- Caminho pelas seções (lógica condicional) ----------

function destinoDaSecao(secao, valores) {
  let destino = secao.depois;
  for (const p of secao.perguntas) {
    if (!p.usarDesvios) continue;
    const i = p.opcoes.indexOf(valores[p.id]);
    if (i >= 0 && p.desvios[i]) destino = p.desvios[i];
  }
  return destino;
}

/** Índices das seções que a pessoa percorreu com essas respostas. */
export function caminho(form, valores) {
  const posicao = new Map(form.secoes.map((s, i) => [s.id, i]));
  const visitadas = [];
  let i = 0;
  while (i < form.secoes.length && !visitadas.includes(i)) {
    visitadas.push(i);
    const destino = destinoDaSecao(form.secoes[i], valores);
    if (destino === 'enviar') break;
    i = destino ? (posicao.get(destino) ?? i + 1) : i + 1;
  }
  return visitadas;
}

// ---------- Validação de cada resposta ----------

const vazio = (v) =>
  v === undefined || v === null || v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function urlValida(v) {
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

function conferirRegra(p, v) {
  const r = p.validacao;
  if (!r) return null;
  const falha = (padrao) => r.mensagem || padrao;
  switch (r.regra) {
    case 'email':
      return REGEX_EMAIL.test(v) ? null : falha('Informe um e-mail válido');
    case 'url':
      return urlValida(v) ? null : falha('Informe um link válido (http:// ou https://)');
    case 'numero': {
      const n = Number(String(v).replace(',', '.'));
      if (!Number.isFinite(n)) return falha('Informe um número');
      if (r.min !== null && n < r.min) return falha(`O número deve ser no mínimo ${r.min}`);
      if (r.max !== null && n > r.max) return falha(`O número deve ser no máximo ${r.max}`);
      return null;
    }
    case 'tamanho':
      if (r.min !== null && v.length < r.min) return falha(`Escreva pelo menos ${r.min} caracteres`);
      if (r.max !== null && v.length > r.max) return falha(`Escreva no máximo ${r.max} caracteres`);
      return null;
    case 'selecao':
      if (r.min !== null && v.length < r.min) return falha(`Marque pelo menos ${r.min} opções`);
      if (r.max !== null && v.length > r.max) return falha(`Marque no máximo ${r.max} opções`);
      return null;
  }
  return null;
}

/** Devolve { valor } limpo ou { erro }. */
function validarValor(p, v) {
  switch (p.tipo) {
    case 'curta':
    case 'paragrafo': {
      if (typeof v !== 'string') return { erro: 'Resposta inválida' };
      const valor = v.trim().slice(0, p.tipo === 'curta' ? 500 : 5000);
      const erro = conferirRegra(p, valor);
      return erro ? { erro } : { valor };
    }
    case 'multipla':
    case 'lista':
      if (p.opcoes.includes(v)) return { valor: v };
      // "Outro": texto livre digitado por quem respondeu
      if (p.permitirOutro && typeof v === 'string' && v.trim()) return { valor: v.trim().slice(0, 300) };
      return { erro: 'Opção inválida' };
    case 'caixas': {
      if (!Array.isArray(v) || !v.every((o) => typeof o === 'string')) return { erro: 'Opção inválida' };
      const extras = [...new Set(v.filter((o) => !p.opcoes.includes(o)).map((o) => o.trim()).filter(Boolean))];
      if (extras.length > (p.permitirOutro ? 1 : 0)) return { erro: 'Opção inválida' };
      const valor = [...p.opcoes.filter((o) => v.includes(o)), ...extras.map((o) => o.slice(0, 300))];
      const erro = conferirRegra(p, valor);
      return erro ? { erro } : { valor };
    }
    case 'escala': {
      const n = Number(v);
      const { min, max } = p.escala;
      return Number.isInteger(n) && n >= min && n <= max ? { valor: n } : { erro: 'Valor fora da escala' };
    }
    case 'data':
      return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
        ? { valor: v }
        : { erro: 'Data inválida' };
    case 'hora':
      return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? { valor: v } : { erro: 'Hora inválida' };
    case 'grade': {
      if (typeof v !== 'object' || Array.isArray(v)) return { erro: 'Resposta inválida' };
      const valor = {};
      for (const [linha, coluna] of Object.entries(v)) {
        if (!p.grade.linhas.includes(linha) || !p.grade.colunas.includes(coluna)) return { erro: 'Resposta inválida' };
        valor[linha] = coluna;
      }
      if (p.obrigatoria && p.grade.linhas.some((l) => !(l in valor))) return { erro: 'Responda todas as linhas' };
      return { valor };
    }
  }
  return { erro: 'Tipo desconhecido' };
}

/**
 * Confere uma resposta inteira. Só valida (e guarda) as seções que a pessoa
 * percorreu de verdade, seguindo a lógica condicional.
 * Devolve { valores } limpos ou { erros } por id de pergunta.
 */
export function validarResposta(form, corpo = {}) {
  const entrada = corpo.valores && typeof corpo.valores === 'object' ? corpo.valores : {};
  const valores = {};
  const erros = {};

  for (const i of caminho(form, entrada)) {
    for (const p of form.secoes[i].perguntas) {
      const v = entrada[p.id];
      if (vazio(v)) {
        if (p.obrigatoria) erros[p.id] = 'Esta pergunta é obrigatória';
        continue;
      }
      const { valor, erro } = validarValor(p, v);
      if (erro) erros[p.id] = erro;
      else valores[p.id] = valor;
    }
  }

  return Object.keys(erros).length ? { erros } : { valores };
}

// ---------- Modo teste ----------

const normalizarTexto = (t) => String(t).trim().toLowerCase().replace(/\s+/g, ' ');

export function respostaCorreta(p, v) {
  const corretas = p.quiz.corretas;
  if (v === undefined) return false;
  switch (p.tipo) {
    case 'curta':
      return corretas.some((c) => normalizarTexto(c) === normalizarTexto(v));
    case 'multipla':
    case 'lista':
      return corretas.includes(v);
    case 'caixas':
      return Array.isArray(v) && v.length === corretas.length && corretas.every((c) => v.includes(c));
  }
  return false;
}

/** Nota da resposta. Só contam perguntas que têm gabarito. */
export function corrigir(form, valores) {
  if (!form.config.modoTeste) return null;
  let pontos = 0;
  let total = 0;
  const detalhes = [];
  for (const p of form.secoes.flatMap((s) => s.perguntas)) {
    if (!TIPOS_CORRIGIVEIS.includes(p.tipo) || !p.quiz.corretas.length) continue;
    const certa = respostaCorreta(p, valores[p.id]);
    total += p.quiz.pontos;
    if (certa) pontos += p.quiz.pontos;
    detalhes.push({ perguntaId: p.id, correta: certa, corretas: p.quiz.corretas, feedback: p.quiz.feedback });
  }
  return { pontos, total, detalhes };
}
