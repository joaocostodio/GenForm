// Rotas de conta: /api/auth/...
import { Router } from 'express';
import { ler, salvar } from '../db.mjs';
import {
  bloqueado,
  conferirSenha,
  emailValido,
  encerrarOutrasSessoes,
  encerrarSessao,
  exigirLogin,
  gerarHash,
  hashFalso,
  iniciarSessao,
  limparFalhas,
  normalizarEmail,
  registrarFalha,
  usuarioPublico,
  validarSenha,
} from '../seguranca.mjs';
import { novoId } from '../validacao.mjs';

export const rotasAuth = Router();

// Quem está logado agora (ou null). Sempre 200 para não sujar o console.
rotasAuth.get('/eu', (req, res) => {
  res.json({ usuario: req.usuario ? usuarioPublico(req.usuario) : null });
});

rotasAuth.post('/cadastro', async (req, res) => {
  const nome = typeof req.body?.nome === 'string' ? req.body.nome.trim().slice(0, 80) : '';
  const email = normalizarEmail(req.body?.email);
  const senha = req.body?.senha;

  const erros = {};
  if (!nome) erros.nome = 'Informe seu nome';
  if (!emailValido(email)) erros.email = 'E-mail inválido';
  const erroSenha = validarSenha(senha);
  if (erroSenha) erros.senha = erroSenha;
  if (Object.keys(erros).length) return res.status(400).json({ erro: 'Verifique os campos', erros });

  const db = await ler();
  if (db.usuarios.some((u) => u.email === email)) {
    const msg = 'Já existe uma conta com este e-mail';
    return res.status(409).json({ erro: msg, erros: { email: msg } });
  }

  const usuario = { id: novoId(), nome, email, senhaHash: await gerarHash(senha), criadoEm: new Date().toISOString() };
  db.usuarios.push(usuario);
  await iniciarSessao(res, usuario.id);
  res.status(201).json({ usuario: usuarioPublico(usuario) });
});

rotasAuth.post('/login', async (req, res) => {
  const email = normalizarEmail(req.body?.email);
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  const chave = `${req.ip}|${email}`;

  if (bloqueado(chave)) {
    return res.status(429).json({ erro: 'Muitas tentativas. Espere 15 minutos e tente de novo.' });
  }

  const db = await ler();
  const usuario = db.usuarios.find((u) => u.email === email);
  const ok = await conferirSenha(senha, usuario?.senhaHash ?? hashFalso);
  if (!usuario || !ok) {
    registrarFalha(chave);
    // Mesma mensagem para e-mail inexistente e senha errada.
    return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
  }

  limparFalhas(chave);
  await iniciarSessao(res, usuario.id);
  res.json({ usuario: usuarioPublico(usuario) });
});

rotasAuth.post('/logout', async (req, res) => {
  await encerrarSessao(req, res);
  res.status(204).end();
});

// Alterar nome e/ou senha (a senha atual é obrigatória para trocar a senha).
rotasAuth.put('/eu', exigirLogin, async (req, res) => {
  const usuario = req.usuario;
  const { nome, senhaAtual, novaSenha } = req.body ?? {};

  if (typeof nome === 'string') {
    const limpo = nome.trim().slice(0, 80);
    if (!limpo) return res.status(400).json({ erro: 'Informe seu nome', erros: { nome: 'Informe seu nome' } });
    usuario.nome = limpo;
  }

  if (novaSenha !== undefined) {
    const atualOk = await conferirSenha(typeof senhaAtual === 'string' ? senhaAtual : '', usuario.senhaHash);
    if (!atualOk) {
      return res.status(400).json({ erro: 'Senha atual incorreta', erros: { senhaAtual: 'Senha atual incorreta' } });
    }
    const erroSenha = validarSenha(novaSenha);
    if (erroSenha) return res.status(400).json({ erro: erroSenha, erros: { novaSenha: erroSenha } });
    usuario.senhaHash = await gerarHash(novaSenha);
    await encerrarOutrasSessoes(usuario.id, req.chaveSessao);
  }

  await salvar();
  res.json({ usuario: usuarioPublico(usuario) });
});
