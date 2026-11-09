// Rotas de quem RESPONDE: /api/publico/...  (não exigem login, a não ser que o formulário peça)
import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { ler, salvar } from '../db.mjs';
import { avisar } from '../eventos.mjs';
import { bloqueado, limparFalhas, registrarFalha, usuarioPublico } from '../seguranca.mjs';
import { corrigir, formPublico, novoId, validarResposta } from '../validacao.mjs';
import { enviarWebhook, montarAviso } from '../webhook.mjs';

export const rotasPublico = Router();

/** O código de acesso vem no cabeçalho, para não ficar no histórico nem nos logs de URL. */
const CABECALHO_CODIGO = 'x-codigo-acesso';

function mesmoTexto(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Situação do formulário para esta pessoa:
 * aberto | fechado | agendado | prazo | limite | precisa-login | precisa-codigo | ja-respondeu
 */
function situacao(db, form, usuario, codigoOk) {
  const c = form.config;
  const respostas = db.respostas[form.id] ?? [];
  if (!c.aceitandoRespostas) return 'fechado';
  if (c.dataAbertura && Date.parse(c.dataAbertura) > Date.now()) return 'agendado';
  if (c.dataLimite && Date.parse(c.dataLimite) <= Date.now()) return 'prazo';
  if (c.limiteRespostas && respostas.length >= c.limiteRespostas) return 'limite';
  if (c.exigirLogin && !usuario) return 'precisa-login';
  if (c.codigoAcesso && !codigoOk) return 'precisa-codigo';
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

/** Confere o código de acesso, com limite de tentativas (igual ao login). */
function conferirCodigo(req, res, next) {
  const codigo = req.form.config.codigoAcesso;
  req.codigoOk = !codigo;
  req.codigoErrado = false;
  if (!codigo) return next();
  const enviado = String(req.get(CABECALHO_CODIGO) ?? '').trim();
  if (!enviado) return next();
  const chave = `codigo:${req.ip}:${req.form.id}`;
  if (bloqueado(chave)) return res.status(429).json({ erro: 'Muitas tentativas. Espere 15 minutos e tente de novo.' });
  if (mesmoTexto(enviado, codigo)) {
    limparFalhas(chave);
    req.codigoOk = true;
  } else {
    registrarFalha(chave);
    req.codigoErrado = true;
  }
  next();
}

rotasPublico.get('/:id', carregarForm, conferirCodigo, (req, res) => {
  const status = situacao(req.db, req.form, req.usuario, req.codigoOk);
  res.json({
    status,
    codigoErrado: req.codigoErrado,
    // As perguntas só vão quando a pessoa pode responder.
    form: formPublico(req.form, status === 'aberto', req.db.respostas[req.form.id]),
    usuario: req.usuario ? usuarioPublico(req.usuario) : null,
  });
});

rotasPublico.post('/:id/respostas', carregarForm, conferirCodigo, async (req, res) => {
  const { db, form, usuario } = req;
  const status = situacao(db, form, usuario, req.codigoOk);
  if (status !== 'aberto') return res.status(403).json({ erro: 'Este formulário não pode receber sua resposta', status });

  const lista = (db.respostas[form.id] ??= []);
  const { valores, erros } = validarResposta(form, req.body, lista);
  if (erros) return res.status(400).json({ erro: 'Resposta inválida', erros });

  const duracao = Number(req.body?.duracaoSeg);
  const correcao = corrigir(form, valores);
  const resposta = {
    id: novoId(),
    enviadoEm: new Date().toISOString(),
    valores,
    // Só guardamos quem respondeu quando o formulário exige login.
    respondente: form.config.exigirLogin ? usuarioPublico(usuario) : null,
    nota: correcao ? { pontos: correcao.pontos, total: correcao.total } : null,
    // Tempo que a pessoa levou (informado pelo navegador; serve para o ranking e para estatística).
    duracaoSeg: Number.isFinite(duracao) && duracao >= 0 ? Math.min(86_400, Math.round(duracao)) : null,
  };
  lista.push(resposta);
  await salvar();
  avisar(form.id, { tipo: 'resposta', resposta });

  if (form.config.webhook) {
    // Não espera: quem respondeu não precisa aguardar o Discord/Slack.
    enviarWebhook(form.config.webhook, montarAviso(form, resposta, lista.length)).catch((erro) =>
      console.warn(`Webhook do formulário ${form.id} falhou: ${erro.message}`),
    );
  }

  res.status(201).json({
    mensagemConfirmacao: form.config.mensagemConfirmacao,
    permitirOutraResposta: form.config.permitirOutraResposta && !form.config.umaRespostaPorPessoa,
    nota: correcao && form.config.mostrarNota ? correcao : null,
  });
});
