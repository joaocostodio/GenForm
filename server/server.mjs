// API do nosso "Google Forms" + servidor do Angular compilado (em produção).
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ler, salvar } from './db.mjs';
import { normalizarForm, novoId, validarResposta } from './validacao.mjs';

const app = express();
app.use(express.json({ limit: '300kb' }));

const agora = () => new Date().toISOString();

// Encontra o formulário da rota ou responde 404.
async function carregarForm(req, res, next) {
  const db = await ler();
  const form = db.forms.find((f) => f.id === req.params.id);
  if (!form) return res.status(404).json({ erro: 'Formulário não encontrado' });
  req.db = db;
  req.form = form;
  next();
}

// ---------- Formulários ----------

app.get('/api/forms', async (_req, res) => {
  const db = await ler();
  const resumo = db.forms
    .map(({ id, titulo, descricao, cor, aceitandoRespostas, criadoEm, atualizadoEm }) => ({
      id, titulo, descricao, cor, aceitandoRespostas, criadoEm, atualizadoEm,
      totalRespostas: db.respostas[id]?.length ?? 0,
    }))
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
  res.json(resumo);
});

app.post('/api/forms', async (req, res) => {
  const db = await ler();
  const form = { id: novoId(), ...normalizarForm(req.body), criadoEm: agora(), atualizadoEm: agora() };
  db.forms.push(form);
  db.respostas[form.id] = [];
  await salvar();
  res.status(201).json(form);
});

app.get('/api/forms/:id', carregarForm, (req, res) => res.json(req.form));

app.put('/api/forms/:id', carregarForm, async (req, res) => {
  Object.assign(req.form, normalizarForm(req.body), { atualizadoEm: agora() });
  await salvar();
  res.json(req.form);
});

app.delete('/api/forms/:id', carregarForm, async (req, res) => {
  req.db.forms = req.db.forms.filter((f) => f.id !== req.form.id);
  delete req.db.respostas[req.form.id];
  await salvar();
  res.status(204).end();
});

// ---------- Respostas ----------

app.get('/api/forms/:id/respostas', carregarForm, (req, res) => {
  res.json(req.db.respostas[req.form.id] ?? []);
});

app.post('/api/forms/:id/respostas', carregarForm, async (req, res) => {
  if (!req.form.aceitandoRespostas) {
    return res.status(403).json({ erro: 'Este formulário não está aceitando respostas' });
  }
  const { valores, erros } = validarResposta(req.form, req.body);
  if (erros) return res.status(400).json({ erro: 'Resposta inválida', erros });

  const resposta = { id: novoId(), enviadoEm: agora(), valores };
  (req.db.respostas[req.form.id] ??= []).push(resposta);
  await salvar();
  res.status(201).json(resposta);
});

app.delete('/api/forms/:id/respostas', carregarForm, async (req, res) => {
  req.db.respostas[req.form.id] = [];
  await salvar();
  res.status(204).end();
});

app.delete('/api/forms/:id/respostas/:respostaId', carregarForm, async (req, res) => {
  const todas = req.db.respostas[req.form.id] ?? [];
  req.db.respostas[req.form.id] = todas.filter((r) => r.id !== req.params.respostaId);
  await salvar();
  res.status(204).end();
});

app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// ---------- Angular compilado (npm run build) ----------

const pastaAngular = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'aula1', 'browser');
if (existsSync(pastaAngular)) {
  app.use(express.static(pastaAngular));
  // Qualquer outra rota (ex: /f/abc) devolve o index.html e o Angular Router resolve.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(join(pastaAngular, 'index.html'));
  });
}

app.use((erro, _req, res, _next) => {
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

const porta = Number(process.env.PORT) || 3000;
app.listen(porta, () => console.log(`API rodando em http://localhost:${porta}`));
