// Testes das regras do formulário (funções puras, sem servidor).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { atualizarForm, caminho, corrigir, novoForm, validarResposta } from '../src/validacao.mjs';

function formDeTeste() {
  return novoForm({
    config: { modoTeste: true },
    secoes: [
      {
        id: 's1',
        perguntas: [
          { id: 'curso', tipo: 'multipla', titulo: 'Curso', obrigatoria: true, opcoes: ['ADS', 'Outro curso'],
            usarDesvios: true, desvios: ['s2', 'enviar'], quiz: { corretas: ['ADS'], pontos: 2 } },
          { id: 'email', tipo: 'curta', titulo: 'E-mail', validacao: { regra: 'email' } },
        ],
      },
      { id: 's2', perguntas: [{ id: 'nota', tipo: 'escala', titulo: 'Nota', obrigatoria: true }] },
    ],
  });
}

describe('caminho (lógica condicional)', () => {
  it('segue o desvio da opção escolhida', () => {
    const form = formDeTeste();
    assert.deepEqual(caminho(form, { curso: 'ADS' }), [0, 1]);
    assert.deepEqual(caminho(form, { curso: 'Outro curso' }), [0]);
  });

  it('remove desvios para trás (evita caminho em círculo)', () => {
    const form = novoForm({ secoes: [{ id: 'a' }, { id: 'b', depois: 'a' }] });
    assert.equal(form.secoes[1].depois, '');
  });
});

describe('validarResposta', () => {
  it('não cobra perguntas de seções que a pessoa pulou', () => {
    const r = validarResposta(formDeTeste(), { valores: { curso: 'Outro curso' } });
    assert.deepEqual(r, { valores: { curso: 'Outro curso' } });
  });

  it('cobra obrigatória das seções visitadas e aplica a validação de e-mail', () => {
    const r = validarResposta(formDeTeste(), { valores: { curso: 'ADS', email: 'nao-e-email' } });
    assert.ok(r.erros.nota);
    assert.ok(r.erros.email);
  });

  it('aceita "Outro" só quando a pergunta permite', () => {
    const form = novoForm({ secoes: [{ perguntas: [{ id: 'p', tipo: 'caixas', opcoes: ['A'], permitirOutro: true }] }] });
    assert.deepEqual(validarResposta(form, { valores: { p: ['A', 'Meu texto'] } }).valores.p, ['A', 'Meu texto']);
    assert.ok(validarResposta(form, { valores: { p: ['X', 'Y'] } }).erros.p);
  });

  it('valida grade e data', () => {
    const form = novoForm({
      secoes: [{ perguntas: [
        { id: 'g', tipo: 'grade', obrigatoria: true, grade: { linhas: ['L1', 'L2'], colunas: ['Sim', 'Não'] } },
        { id: 'd', tipo: 'data' },
      ] }],
    });
    assert.ok(validarResposta(form, { valores: { g: { L1: 'Sim' } } }).erros.g, 'falta a linha L2');
    assert.ok(validarResposta(form, { valores: { g: { L1: 'Sim', L2: 'Não' }, d: '2026-13-40' } }).erros.d);
    assert.ok(validarResposta(form, { valores: { g: { L1: 'Sim', L2: 'Não' }, d: '2026-10-26' } }).valores);
  });
});

describe('corrigir (modo teste)', () => {
  it('soma os pontos das perguntas com gabarito', () => {
    const nota = corrigir(formDeTeste(), { curso: 'ADS' });
    assert.equal(nota.pontos, 2);
    assert.equal(nota.total, 2);
  });
});

describe('atualizarForm', () => {
  it('só altera as partes enviadas', () => {
    const form = formDeTeste();
    atualizarForm(form, { config: { aceitandoRespostas: false } });
    assert.equal(form.config.aceitandoRespostas, false);
    assert.equal(form.config.modoTeste, true, 'o resto da configuração continua igual');
    assert.equal(form.secoes.length, 2);
  });
});
