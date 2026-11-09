// Testes da API de verdade: sobe o servidor numa porta livre com um banco temporário.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

const PORTA = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORTA}`;
let servidor;
let pastaTemp;

before(async () => {
  pastaTemp = await mkdtemp(join(tmpdir(), 'forms-teste-'));
  servidor = spawn(process.execPath, ['src/server.mjs'], {
    env: { ...process.env, PORT: String(PORTA), DB_FILE: join(pastaTemp, 'db.json'), FRONTEND_DIST: join(pastaTemp, 'sem-frontend') },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((ok) => servidor.stdout.on('data', (d) => String(d).includes('rodando') && ok()));
});

after(async () => {
  servidor.kill();
  await rm(pastaTemp, { recursive: true, force: true });
});

/** Cliente que guarda o cookie de sessão, como um navegador. */
function cliente() {
  let cookie = '';
  return async (metodo, caminho, corpo) => {
    const res = await fetch(BASE + caminho, {
      method: metodo,
      headers: { 'content-type': 'application/json', cookie },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const novo = res.headers.get('set-cookie');
    if (novo) cookie = novo.split(';')[0];
    const texto = await res.text();
    return { status: res.status, corpo: texto ? JSON.parse(texto) : null };
  };
}

describe('contas', () => {
  it('cadastra, sai e entra de novo', async () => {
    const ana = cliente();
    const cad = await ana('POST', '/api/auth/cadastro', { nome: 'Ana', email: 'ANA@teste.com', senha: 'senha-forte-1' });
    assert.equal(cad.status, 201);
    assert.equal(cad.corpo.usuario.email, 'ana@teste.com');
    assert.equal(cad.corpo.usuario.senhaHash, undefined, 'nunca devolve o hash');

    assert.equal((await ana('GET', '/api/auth/eu')).corpo.usuario.nome, 'Ana');
    assert.equal((await ana('POST', '/api/auth/logout')).status, 204);
    assert.equal((await ana('GET', '/api/auth/eu')).corpo.usuario, null);

    assert.equal((await ana('POST', '/api/auth/login', { email: 'ana@teste.com', senha: 'errada123' })).status, 401);
    assert.equal((await ana('POST', '/api/auth/login', { email: 'ana@teste.com', senha: 'senha-forte-1' })).status, 200);
  });

  it('recusa e-mail repetido e senha curta', async () => {
    const c = cliente();
    assert.equal((await c('POST', '/api/auth/cadastro', { nome: 'X', email: 'ana@teste.com', senha: 'outra-senha' })).status, 409);
    assert.equal((await c('POST', '/api/auth/cadastro', { nome: 'X', email: 'x@teste.com', senha: '123' })).status, 400);
  });
});

describe('formulários e respostas', () => {
  const dono = cliente();
  const intruso = cliente();
  const visitante = cliente();
  let formId;

  before(async () => {
    await dono('POST', '/api/auth/cadastro', { nome: 'Dono', email: 'dono@teste.com', senha: 'senha-do-dono' });
    await intruso('POST', '/api/auth/cadastro', { nome: 'Intruso', email: 'intruso@teste.com', senha: 'senha-intruso' });
    const criado = await dono('POST', '/api/forms', {
      titulo: 'Prova',
      config: { modoTeste: true },
      secoes: [{ perguntas: [{ id: 'q1', tipo: 'multipla', titulo: '2+2?', obrigatoria: true, opcoes: ['3', '4'], quiz: { corretas: ['4'], pontos: 5 } }] }],
    });
    formId = criado.corpo.id;
  });

  it('exige login para gerenciar', async () => {
    assert.equal((await visitante('GET', '/api/forms')).status, 401);
  });

  it('um usuário não vê o formulário de outro', async () => {
    assert.equal((await intruso('GET', `/api/forms/${formId}`)).status, 404);
    assert.equal((await intruso('DELETE', `/api/forms/${formId}`)).status, 404);
    assert.equal((await intruso('GET', '/api/forms')).corpo.length, 0);
  });

  it('o link público não entrega o gabarito', async () => {
    const pub = await visitante('GET', `/api/publico/${formId}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.corpo.status, 'aberto');
    assert.deepEqual(pub.corpo.form.secoes[0].perguntas[0].quiz, { pontos: 5 });
  });

  it('corrige a resposta e devolve a nota', async () => {
    const r = await visitante('POST', `/api/publico/${formId}/respostas`, { valores: { q1: '4' } });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.nota.pontos, 5);
    const lista = await dono('GET', `/api/forms/${formId}/respostas`);
    assert.equal(lista.corpo.length, 1);
    assert.deepEqual(lista.corpo[0].nota, { pontos: 5, total: 5 });
  });

  it('exigir login + 1 resposta por pessoa', async () => {
    await dono('PUT', `/api/forms/${formId}`, { config: { exigirLogin: true, umaRespostaPorPessoa: true } });
    assert.equal((await visitante('GET', `/api/publico/${formId}`)).corpo.status, 'precisa-login');
    assert.equal((await visitante('POST', `/api/publico/${formId}/respostas`, { valores: { q1: '4' } })).status, 403);

    assert.equal((await intruso('POST', `/api/publico/${formId}/respostas`, { valores: { q1: '3' } })).status, 201);
    assert.equal((await intruso('GET', `/api/publico/${formId}`)).corpo.status, 'ja-respondeu');

    const lista = await dono('GET', `/api/forms/${formId}/respostas`);
    assert.equal(lista.corpo.at(-1).respondente.email, 'intruso@teste.com');
  });

  it('fecha por data limite', async () => {
    await dono('PUT', `/api/forms/${formId}`, { config: { exigirLogin: false, dataLimite: '2020-01-01T00:00:00Z' } });
    assert.equal((await visitante('GET', `/api/publico/${formId}`)).corpo.status, 'prazo');
  });

  it('bloqueia requisição vinda de outro site (CSRF)', async () => {
    const res = await fetch(`${BASE}/api/forms`, { method: 'POST', headers: { origin: 'https://site-malicioso.com', 'content-type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 403);
  });
});

describe('modo ao vivo e uma pergunta por vez', () => {
  let cookie = '';
  let formId;

  before(async () => {
    const res = await fetch(`${BASE}/api/auth/cadastro`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Prof', email: 'prof@teste.com', senha: 'senha-do-prof' }),
    });
    cookie = res.headers.get('set-cookie').split(';')[0];
    const criado = await fetch(`${BASE}/api/forms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ titulo: 'Ao vivo', config: { umaPorVez: true }, secoes: [{ perguntas: [{ id: 'p1', tipo: 'curta', titulo: 'Nome?' }] }] }),
    });
    formId = (await criado.json()).id;
  });

  it('o link público avisa que é uma pergunta por vez', async () => {
    const res = await fetch(`${BASE}/api/publico/${formId}`);
    assert.equal((await res.json()).form.config.umaPorVez, true);
  });

  it('só o dono abre o canal ao vivo', async () => {
    const res = await fetch(`${BASE}/api/forms/${formId}/ao-vivo`);
    assert.equal(res.status, 401);
    await res.body?.cancel();
  });

  it('manda a resposta nova na hora (SSE)', async () => {
    const controle = new AbortController();
    const res = await fetch(`${BASE}/api/forms/${formId}/ao-vivo`, { headers: { cookie }, signal: controle.signal });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/event-stream/);

    const leitor = res.body.getReader();
    const decodificador = new TextDecoder();
    let recebido = '';
    const esperar = async (trecho) => {
      while (!recebido.includes(trecho)) {
        const { value, done } = await leitor.read();
        if (done) throw new Error('conexão fechou antes de chegar: ' + trecho);
        recebido += decodificador.decode(value);
      }
    };

    await esperar('"conectado"');
    await fetch(`${BASE}/api/publico/${formId}/respostas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ valores: { p1: 'Maria' } }),
    });
    await esperar('"Maria"');
    assert.match(recebido, /"tipo":"resposta"/);
    controle.abort();
  });
});

describe('GenForm 2.0: vagas, código, agendamento e cronômetro', () => {
  let cookie = '';
  const criar = async (corpo) => {
    const res = await fetch(`${BASE}/api/forms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(corpo),
    });
    return (await res.json()).id;
  };
  const responder = (id, valores, extras = {}, cabecalhos = {}) =>
    fetch(`${BASE}/api/publico/${id}/respostas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...cabecalhos },
      body: JSON.stringify({ valores, ...extras }),
    });

  before(async () => {
    const res = await fetch(`${BASE}/api/auth/cadastro`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: 'Org', email: 'org@teste.com', senha: 'senha-do-org' }),
    });
    cookie = res.headers.get('set-cookie').split(';')[0];
  });

  it('fecha a opção quando as vagas acabam', async () => {
    const id = await criar({
      secoes: [{ perguntas: [{ id: 'of', tipo: 'multipla', titulo: 'Oficina', opcoes: ['A', 'B'], usarVagas: true, vagas: [1, null] }] }],
    });
    assert.equal((await responder(id, { of: 'A' })).status, 201);
    const publico = await (await fetch(`${BASE}/api/publico/${id}`)).json();
    assert.deepEqual(publico.form.secoes[0].perguntas[0].restantes, [0, null]);
    const lotada = await responder(id, { of: 'A' });
    assert.equal(lotada.status, 400);
    assert.match((await lotada.json()).erros.of, /vagas/);
    assert.equal((await responder(id, { of: 'B' })).status, 201, 'opção sem limite continua aberta');
  });

  it('pede o código de acesso e nunca o entrega no link público', async () => {
    const id = await criar({ config: { codigoAcesso: 'TURMA42' }, secoes: [{ perguntas: [{ id: 'n', tipo: 'curta', titulo: 'Nome' }] }] });
    const sem = await (await fetch(`${BASE}/api/publico/${id}`)).json();
    assert.equal(sem.status, 'precisa-codigo');
    assert.equal(JSON.stringify(sem).includes('TURMA42'), false);

    const errado = await (await fetch(`${BASE}/api/publico/${id}`, { headers: { 'x-codigo-acesso': 'outro' } })).json();
    assert.equal(errado.status, 'precisa-codigo');
    assert.equal(errado.codigoErrado, true);

    const certo = await (await fetch(`${BASE}/api/publico/${id}`, { headers: { 'x-codigo-acesso': 'TURMA42' } })).json();
    assert.equal(certo.status, 'aberto');
    assert.equal((await responder(id, { n: 'Ana' })).status, 403);
    assert.equal((await responder(id, { n: 'Ana' }, {}, { 'x-codigo-acesso': 'TURMA42' })).status, 201);
  });

  it('não abre antes da data agendada', async () => {
    const amanha = new Date(Date.now() + 86_400_000).toISOString();
    const id = await criar({ config: { dataAbertura: amanha }, secoes: [{ perguntas: [{ id: 'n', tipo: 'curta', titulo: 'Nome' }] }] });
    const publico = await (await fetch(`${BASE}/api/publico/${id}`)).json();
    assert.equal(publico.status, 'agendado');
    assert.equal(publico.form.config.dataAbertura, amanha);
    assert.deepEqual(publico.form.secoes, [], 'não mostra as perguntas antes de abrir');
    assert.equal((await responder(id, { n: 'Ana' })).status, 403);
  });

  it('com o tempo esgotado aceita a resposta incompleta', async () => {
    const id = await criar({
      config: { tempoLimite: 5 },
      secoes: [{ perguntas: [{ id: 'a', tipo: 'curta', titulo: 'A', obrigatoria: true }, { id: 'b', tipo: 'curta', titulo: 'B', obrigatoria: true }] }],
    });
    assert.equal((await responder(id, { a: 'só a primeira' })).status, 400, 'normalmente exige as obrigatórias');
    assert.equal((await responder(id, { a: 'só a primeira' }, { tempoEsgotado: true, duracaoSeg: 300 })).status, 201);
    const lista = await (await fetch(`${BASE}/api/forms/${id}/respostas`, { headers: { cookie } })).json();
    assert.equal(lista[0].duracaoSeg, 300);
  });

  it('NPS é sempre de 0 a 10 e webhook só aceita https público', async () => {
    const res = await fetch(`${BASE}/api/forms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        config: { webhook: 'http://127.0.0.1:3000/api' },
        secoes: [{ perguntas: [{ id: 'r', tipo: 'escala', escala: { estilo: 'nps', min: 1, max: 5 } }] }],
      }),
    });
    const form = await res.json();
    assert.deepEqual([form.secoes[0].perguntas[0].escala.min, form.secoes[0].perguntas[0].escala.max], [0, 10]);
    assert.equal(form.config.webhook, '', 'endereço interno é recusado');
  });
});
