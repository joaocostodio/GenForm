import { Formulario, Pergunta, Resposta, ValorResposta } from '../models/formulario';

export function formatarValor(v: ValorResposta | undefined): string {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.join('; ');
  if (typeof v === 'object') return Object.entries(v).map(([linha, coluna]) => `${linha}: ${coluna}`).join('; ');
  return String(v);
}

// Aspas duplas viram "" e o campo vai entre aspas (padrão CSV).
// Prefixo ' evita que o Excel execute fórmulas digitadas por quem respondeu (=, +, -, @).
function celula(texto: string) {
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replaceAll('"', '""')}"`;
}

/** Colunas do CSV: grade vira uma coluna por linha, o resto uma coluna por pergunta. */
function colunas(perguntas: Pergunta[]) {
  return perguntas.flatMap((p) => {
    const titulo = p.titulo || 'Pergunta sem título';
    if (p.tipo === 'grade' && p.grade) {
      return p.grade.linhas.map((linha) => ({
        titulo: `${titulo} [${linha}]`,
        valor: (r: Resposta) => (r.valores[p.id] as Record<string, string> | undefined)?.[linha] ?? '',
      }));
    }
    return [{ titulo, valor: (r: Resposta) => formatarValor(r.valores[p.id]) }];
  });
}

export function gerarCsv(form: Formulario, respostas: Resposta[]): string {
  const cols = colunas(form.secoes.flatMap((s) => s.perguntas));
  const comQuem = respostas.some((r) => r.respondente);
  const comNota = form.config.modoTeste;

  const cabecalho = [
    'Data/hora',
    ...(comQuem ? ['Nome', 'E-mail'] : []),
    ...(comNota ? ['Nota'] : []),
    ...cols.map((c) => c.titulo),
  ];
  const linhas = respostas.map((r) => [
    new Date(r.enviadoEm).toLocaleString('pt-BR'),
    ...(comQuem ? [r.respondente?.nome ?? '', r.respondente?.email ?? ''] : []),
    ...(comNota ? [r.nota ? `${r.nota.pontos}/${r.nota.total}` : ''] : []),
    ...cols.map((c) => c.valor(r)),
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
