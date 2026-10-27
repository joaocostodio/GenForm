// Rotas de quem RESPONDE: /api/publico/...  (não exigem login, a não ser que o formulário peça)
import { Router } from 'express';
import { ler, salvar } from '../db.mjs';
import { usuarioPublico } from '../seguranca.mjs';
import { corrigir, formPublico, novoId, validarResposta } from '../validacao.mjs';

export const rotasPublico = Router();

/**
 * Situação do formulário para esta pessoa:
 * aberto | fechado | prazo | limite | precisa-login | ja-respondeu
 */
function situacao(db, form, usuario) {
  const c = form.config;
  const respostas = db.respostas[form.id] ?? [];
  if (!c.aceitandoRespostas) return 'fechado';
  if (c.dataLimite && Date.parse(c.dataLimite) <= Date.now()) return 'prazo';
  if (c.limiteRespostas && respostas.length >= c.limiteRespostas) return 'limite';
  if (c.exigirLogin && !usuario) return 'precisa-login';
  if (c.umaRespostaPorPessoa && respostas.some((r) => r.respondente?.id === usuario.id)) return 'ja-respondeu';
  return 'aberto';
}

async function carregarForm(req, res, next) {
  const db = await ler();
  const form = db.forms.find((f) => f.id === req.params.id);
  if (!form) return res.status(404).json({ erro: 'Formulário não encontrado' });
  req.db = db;
  req.form = form;
  next();
}

rotasPublico.get('/:id', carregarForm, (req, res) => {
  const status = situacao(req.db, req.form, req.usuario);
  res.json({
    status,
    // As perguntas só vão quando a pessoa pode responder.
    form: formPublico(req.form, status === 'aberto'),
    usuario: req.usuario ? usuarioPublico(req.usuario) : null,
  });
});

rotasPublico.post('/:id/respostas', carregarForm, async (req, res) => {
  const { db, form, usuario } = req;
  const status = situacao(db, form, usuario);
  if (status !== 'aberto') return res.status(403).json({ erro: 'Este formulário não pode receber sua resposta', status });

  const { valores, erros } = validarResposta(form, req.body);
  if (erros) return res.status(400).json({ erro: 'Resposta inválida', erros });

  const correcao = corrigir(form, valores);
  const resposta = {
    id: novoId(),
    enviadoEm: new Date().toISOString(),
    valores,
    // Só guardamos quem respondeu quando o formulário exige login.
    respondente: form.config.exigirLogin ? usuarioPublico(usuario) : null,
    nota: correcao ? { pontos: correcao.pontos, total: correcao.total } : null,
  };
  (db.respostas[form.id] ??= []).push(resposta);
  await salvar();

  res.status(201).json({
    mensagemConfirmacao: form.config.mensagemConfirmacao,
    permitirOutraResposta: form.config.permitirOutraResposta && !form.config.umaRespostaPorPessoa,
    nota: correcao && form.config.mostrarNota ? correcao : null,
  });
});
