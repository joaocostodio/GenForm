// Rotas do dono do formulário: /api/forms/...  (todas exigem login)
// Cada usuário só enxerga e altera os próprios formulários.
import { Router } from 'express';
import QRCode from 'qrcode';
import { ler, salvar } from '../db.mjs';
import { atualizarForm, novoForm, novoId } from '../validacao.mjs';

export const rotasForms = Router();

const agora = () => new Date().toISOString();

/** Carrega o formulário da rota se ele for do usuário logado; senão 404 (não revela que existe). */
async function carregarForm(req, res, next) {
  const db = await ler();
  const form = db.forms.find((f) => f.id === req.params.id && f.donoId === req.usuario.id);
  if (!form) return res.status(404).json({ erro: 'Formulário não encontrado' });
  req.db = db;
  req.form = form;
  next();
}

// ---------- Formulários ----------

rotasForms.get('/', async (req, res) => {
  const db = await ler();
  const meus = db.forms
    .filter((f) => f.donoId === req.usuario.id)
    .map((f) => ({
      id: f.id,
      titulo: f.titulo,
      descricao: f.descricao,
      cor: f.cor,
      criadoEm: f.criadoEm,
      atualizadoEm: f.atualizadoEm,
      aceitandoRespostas: f.config.aceitandoRespostas,
      modoTeste: f.config.modoTeste,
      totalRespostas: db.respostas[f.id]?.length ?? 0,
    }))
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
  res.json(meus);
});

rotasForms.post('/', async (req, res) => {
  const db = await ler();
  const form = { id: novoId(), donoId: req.usuario.id, ...novoForm(req.body), criadoEm: agora(), atualizadoEm: agora() };
  db.forms.push(form);
  db.respostas[form.id] = [];
  await salvar();
  res.status(201).json(form);
});

rotasForms.get('/:id', carregarForm, (req, res) => res.json(req.form));

// Atualização parcial: o editor manda {titulo, descricao, cor, secoes}; a tela de configurações manda {config}.
rotasForms.put('/:id', carregarForm, async (req, res) => {
  atualizarForm(req.form, req.body);
  req.form.atualizadoEm = agora();
  await salvar();
  res.json(req.form);
});

rotasForms.delete('/:id', carregarForm, async (req, res) => {
  req.db.forms = req.db.forms.filter((f) => f.id !== req.form.id);
  delete req.db.respostas[req.form.id];
  await salvar();
  res.status(204).end();
});

rotasForms.post('/:id/duplicar', carregarForm, async (req, res) => {
  const copia = {
    ...structuredClone(req.form),
    id: novoId(),
    titulo: `Cópia de ${req.form.titulo}`.slice(0, 300),
    criadoEm: agora(),
    atualizadoEm: agora(),
  };
  copia.config.aceitandoRespostas = true;
  req.db.forms.push(copia);
  req.db.respostas[copia.id] = [];
  await salvar();
  res.status(201).json(copia);
});

// QR code (SVG) do link de resposta. O link vem do navegador porque só ele sabe
// o endereço público certo (localhost, IP da rede ou domínio da hospedagem).
rotasForms.get('/:id/qr', carregarForm, async (req, res) => {
  const link = String(req.query.link ?? '');
  let url;
  try {
    url = new URL(link);
  } catch {
    return res.status(400).json({ erro: 'Link inválido' });
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.pathname.endsWith(`/f/${req.form.id}`) || link.length > 500) {
    return res.status(400).json({ erro: 'Link inválido' });
  }
  const svg = await QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  res.type('image/svg+xml').send(svg);
});

// ---------- Respostas ----------

rotasForms.get('/:id/respostas', carregarForm, (req, res) => {
  res.json(req.db.respostas[req.form.id] ?? []);
});

rotasForms.delete('/:id/respostas', carregarForm, async (req, res) => {
  req.db.respostas[req.form.id] = [];
  await salvar();
  res.status(204).end();
});

rotasForms.delete('/:id/respostas/:respostaId', carregarForm, async (req, res) => {
  const todas = req.db.respostas[req.form.id] ?? [];
  req.db.respostas[req.form.id] = todas.filter((r) => r.id !== req.params.respostaId);
  await salvar();
  res.status(204).end();
});
