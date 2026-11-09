import { CORRIGIVEL, Pergunta, Resposta, ValorResposta } from '../models/formulario';

// Contas do resumo das respostas, usadas na aba "Respostas" e no modo ao vivo.

export interface Barra {
  rotulo: string;
  qtd: number;
  pct: number;
  /** Vagas da opção (quando a pergunta limita vagas). */
  limite?: number | null;
}

export interface Nps {
  /** % promotores (9–10) menos % detratores (0–6): vai de -100 a 100. */
  nota: number;
  promotores: number;
  neutros: number;
  detratores: number;
}

export interface ResumoPergunta {
  pergunta: Pergunta;
  respondidas: number;
  barras: Barra[] | null; // opções e escala
  matriz: { linha: string; colunas: Barra[] }[] | null; // grade
  textos: string[]; // abertas, data e hora (mais recentes primeiro)
  acertos: number | null; // modo teste
  media: number | null; // escalas e estrelas
  nps: Nps | null; // escala no estilo NPS
}

export function corrigivel(p: Pergunta) {
  return CORRIGIVEL.includes(p.tipo) && (p.quiz.corretas?.length ?? 0) > 0;
}

/** Mesma regra do backend (respostaCorreta em backend/src/validacao.mjs). */
export function estaCerta(p: Pergunta, v: ValorResposta | undefined) {
  const corretas = p.quiz.corretas ?? [];
  if (v === undefined) return false;
  const norm = (t: unknown) => String(t).trim().toLowerCase().replace(/\s+/g, ' ');
  if (p.tipo === 'curta') return corretas.some((c) => norm(c) === norm(v));
  if (p.tipo === 'caixas') return Array.isArray(v) && v.length === corretas.length && corretas.every((c) => v.includes(c));
  return corretas.includes(v as string);
}

export function resumir(perguntas: Pergunta[], respostas: Resposta[], modoTeste: boolean): ResumoPergunta[] {
  return perguntas.map((pergunta) => {
    const valores = respostas.map((r) => r.valores[pergunta.id]).filter((v) => v !== undefined);
    const resumo: ResumoPergunta = { pergunta, respondidas: valores.length, barras: null, matriz: null, textos: [], acertos: null, media: null, nps: null };
    const pct = (qtd: number) => (valores.length ? Math.round((qtd / valores.length) * 100) : 0);

    if (modoTeste && corrigivel(pergunta)) {
      resumo.acertos = valores.filter((v) => estaCerta(pergunta, v)).length;
    }

    switch (pergunta.tipo) {
      case 'curta':
      case 'paragrafo':
      case 'data':
      case 'hora':
        resumo.textos = valores.map(String).reverse();
        break;
      case 'grade': {
        const g = pergunta.grade!;
        resumo.matriz = g.linhas.map((linha) => ({
          linha,
          colunas: g.colunas.map((coluna) => {
            const qtd = valores.filter((v) => (v as Record<string, string>)[linha] === coluna).length;
            return { rotulo: coluna, qtd, pct: pct(qtd) };
          }),
        }));
        break;
      }
      default: {
        const rotulos =
          pergunta.tipo === 'escala' && pergunta.escala
            ? Array.from({ length: pergunta.escala.max - pergunta.escala.min + 1 }, (_, i) => String(pergunta.escala!.min + i))
            : [...pergunta.opcoes];
        const contagem = new Map(rotulos.map((r) => [r, 0]));
        for (const v of valores) {
          for (const item of Array.isArray(v) ? v : [String(v)]) {
            // Respostas "Outro" e opções renomeadas depois aparecem como barras extras.
            const chave = pergunta.opcoes.includes(item) || pergunta.tipo === 'escala' ? item : `Outro: ${item}`;
            contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
          }
        }
        // Porcentagem sobre quem respondeu (em caixas a soma pode passar de 100%).
        resumo.barras = [...contagem].map(([rotulo, qtd]) => {
          const i = pergunta.opcoes.indexOf(rotulo);
          return { rotulo, qtd, pct: pct(qtd), limite: pergunta.usarVagas && i >= 0 ? (pergunta.vagas?.[i] ?? null) : null };
        });
        if (pergunta.tipo === 'escala' && valores.length) {
          const numeros = valores.map(Number).filter(Number.isFinite);
          resumo.media = numeros.reduce((s, n) => s + n, 0) / Math.max(1, numeros.length);
          if (pergunta.escala?.estilo === 'nps') resumo.nps = calcularNps(numeros);
        }
      }
    }
    return resumo;
  });
}

export function calcularNps(notas: number[]): Nps {
  const total = notas.length || 1;
  const promotores = notas.filter((n) => n >= 9).length;
  const detratores = notas.filter((n) => n <= 6).length;
  const neutros = notas.length - promotores - detratores;
  const pc = (q: number) => Math.round((q / total) * 100);
  return { nota: pc(promotores) - pc(detratores), promotores: pc(promotores), neutros: pc(neutros), detratores: pc(detratores) };
}
