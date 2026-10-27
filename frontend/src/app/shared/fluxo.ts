// Lógica condicional no navegador: para onde vai depois de cada seção.
// É a mesma regra de backend/src/validacao.mjs (caminho), que confere de novo no envio.
import { Secao, ValorResposta } from '../models/formulario';

/** Destino depois da seção: '' (próxima), 'enviar' ou id de outra seção. */
export function destinoDaSecao(secao: Secao, valores: Record<string, ValorResposta | null>): string {
  let destino = secao.depois;
  for (const p of secao.perguntas) {
    if (!p.usarDesvios) continue;
    const i = p.opcoes.indexOf(valores[p.id] as string);
    if (i >= 0 && p.desvios[i]) destino = p.desvios[i];
  }
  return destino;
}

/** Índice da próxima seção, ou null quando é hora de enviar. */
export function proximaSecao(secoes: Secao[], atual: number, valores: Record<string, ValorResposta | null>): number | null {
  const destino = destinoDaSecao(secoes[atual], valores);
  if (destino === 'enviar') return null;
  const alvo = destino ? secoes.findIndex((s) => s.id === destino) : atual + 1;
  const proxima = alvo > atual ? alvo : atual + 1;
  return proxima < secoes.length ? proxima : null;
}
