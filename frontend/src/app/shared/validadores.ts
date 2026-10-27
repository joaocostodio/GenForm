// Validadores da tela de responder. Espelham as regras do backend
// (backend/src/validacao.mjs), que confere tudo de novo ao receber a resposta.
import { AbstractControl, FormControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Pergunta } from '../models/formulario';

/** Valor usado no controle quando a pessoa escolhe a opção "Outro". */
export const OUTRO = '__outro__';

const vazio = (v: unknown) =>
  v === null || v === undefined || v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function urlValida(v: string) {
  try {
    return ['http:', 'https:'].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

/** Obrigatória (na grade, todas as linhas precisam de resposta). */
function obrigatorio(p: Pergunta): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    if (vazio(c.value)) return { obrigatorio: true };
    if (p.tipo === 'grade' && p.grade!.linhas.some((l) => !(l in (c.value as Record<string, string>)))) {
      return { obrigatorio: 'Responda todas as linhas' };
    }
    return null;
  };
}

/** Escolheu "Outro" mas não escreveu nada. */
function outroPreenchido(outro: FormControl<string>): ValidatorFn {
  return (c) => {
    const escolheu = c.value === OUTRO || (Array.isArray(c.value) && c.value.includes(OUTRO));
    return escolheu && !outro.value.trim() ? { outroVazio: true } : null;
  };
}

/** Regras de "Validação de resposta" configuradas no editor. */
function regra(p: Pergunta): ValidatorFn {
  return (c) => {
    const r = p.validacao;
    if (!r || vazio(c.value)) return null;
    const falha = (padrao: string) => ({ regra: r.mensagem || padrao });
    const v = c.value;
    switch (r.regra) {
      case 'email':
        return REGEX_EMAIL.test(String(v).trim()) ? null : falha('Informe um e-mail válido');
      case 'url':
        return urlValida(String(v).trim()) ? null : falha('Informe um link válido (http:// ou https://)');
      case 'numero': {
        const n = Number(String(v).replace(',', '.'));
        if (!Number.isFinite(n)) return falha('Informe um número');
        if (r.min !== null && n < r.min) return falha(`O número deve ser no mínimo ${r.min}`);
        if (r.max !== null && n > r.max) return falha(`O número deve ser no máximo ${r.max}`);
        return null;
      }
      case 'tamanho': {
        const t = String(v).trim().length;
        if (r.min !== null && t < r.min) return falha(`Escreva pelo menos ${r.min} caracteres`);
        if (r.max !== null && t > r.max) return falha(`Escreva no máximo ${r.max} caracteres`);
        return null;
      }
      case 'selecao': {
        const t = (v as string[]).length;
        if (r.min !== null && t < r.min) return falha(`Marque pelo menos ${r.min} opções`);
        if (r.max !== null && t > r.max) return falha(`Marque no máximo ${r.max} opções`);
        return null;
      }
    }
    return null;
  };
}

export function validadoresDa(p: Pergunta, outro: FormControl<string> | null): ValidatorFn[] {
  const lista: ValidatorFn[] = [regra(p)];
  if (p.obrigatoria) lista.push(obrigatorio(p));
  if (outro) lista.push(outroPreenchido(outro));
  return lista;
}

/** Texto do erro a mostrar embaixo da pergunta. */
export function textoDoErro(erros: ValidationErrors | null): string {
  if (!erros) return '';
  if (erros['servidor']) return erros['servidor'];
  if (erros['obrigatorio']) return typeof erros['obrigatorio'] === 'string' ? erros['obrigatorio'] : 'Esta pergunta é obrigatória';
  if (erros['outroVazio']) return 'Preencha o campo "Outro"';
  if (erros['regra']) return erros['regra'];
  return 'Resposta inválida';
}
