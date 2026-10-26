import { Formulario, Resposta, ValorResposta } from '../models/formulario';

export function formatarValor(v: ValorResposta | undefined): string {
  if (v === undefined) return '';
  return Array.isArray(v) ? v.join('; ') : String(v);
}

// Aspas duplas viram "" e o campo vai entre aspas (padrão CSV).
// Prefixo ' evita que o Excel execute fórmulas digitadas por quem respondeu (=, +, -, @).
function celula(texto: string) {
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replaceAll('"', '""')}"`;
}

export function gerarCsv(form: Formulario, respostas: Resposta[]): string {
  const perguntas = form.secoes.flatMap((s) => s.perguntas);
  const cabecalho = ['Data/hora', ...perguntas.map((p) => p.titulo || 'Pergunta sem título')];
  const linhas = respostas.map((r) => [
    new Date(r.enviadoEm).toLocaleString('pt-BR'),
    ...perguntas.map((p) => formatarValor(r.valores[p.id])),
  ]);
  // Separador ";" é o que o Excel em português espera.
  return [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
}

export function baixarArquivo(nome: string, conteudo: string) {
  // ﻿ (BOM) faz o Excel ler os acentos corretamente.
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: nome });
  link.click();
  URL.revokeObjectURL(url);
}
