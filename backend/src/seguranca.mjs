// Segurança: senhas, sessões, middlewares de login e limite de tentativas.
// - Senha: scrypt com sal aleatório (nunca guardamos a senha em si).
// - Sessão: token aleatório num cookie httpOnly; no banco fica só o hash do token.
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ler, salvar } from './db.mjs';

const scryptAsync = promisify(scrypt);
const COOKIE = 'sessao';
const DURACAO_SESSAO = 30 * 24 * 60 * 60 * 1000; // 30 dias
const producao = process.env.NODE_ENV === 'production';

// ---------- Senha ----------

export async function gerarHash(senha) {
  const sal = randomBytes(16);
  const hash = await scryptAsync(senha, sal, 64);
  return `scrypt$${sal.toString('base64')}$${hash.toString('base64')}`;
}

export async function conferirSenha(senha, guardado) {
  const [, sal64, hash64] = guardado.split('$');
  const esperado = Buffer.from(hash64, 'base64');
  const calculado = await scryptAsync(senha, Buffer.from(sal64, 'base64'), esperado.length);
  return timingSafeEqual(esperado, calculado);
}

// Hash usado quando o e-mail não existe, para o login demorar o mesmo tempo
// e não entregar quais e-mails têm conta.
export const hashFalso = await gerarHash(randomBytes(16).toString('hex'));

export function validarSenha(senha) {
  if (typeof senha !== 'string' || senha.length < 8) return 'A senha precisa ter pelo menos 8 caracteres';
  if (senha.length > 200) return 'Senha longa demais';
  return null;
}

export const emailValido = (e) => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const normalizarEmail = (e) => (typeof e === 'string' ? e.trim().toLowerCase() : '');
export const usuarioPublico = (u) => ({ id: u.id, nome: u.nome, email: u.email });

// ---------- Sessão ----------

const hashToken = (token) => createHash('sha256').update(token).digest('base64url');

function lerCookie(req, nome) {
  for (const parte of (req.headers.cookie ?? '').split(';')) {
    const [chave, ...resto] = parte.trim().split('=');
    if (chave === nome) return decodeURIComponent(resto.join('='));
  }
  return null;
}

export async function iniciarSessao(res, usuarioId) {
  const db = await ler();
  const token = randomBytes(32).toString('base64url');
  db.sessoes[hashToken(token)] = { usuarioId, expiraEm: Date.now() + DURACAO_SESSAO };
  await salvar();
  res.cookie(COOKIE, token, {
    httpOnly: true, // o JavaScript da página não consegue ler
    sameSite: 'lax', // não é enviado em POST vindo de outro site
    secure: producao, // só HTTPS em produção
    maxAge: DURACAO_SESSAO,
    path: '/',
  });
}

export async function encerrarSessao(req, res) {
  if (req.chaveSessao) {
    const db = await ler();
    delete db.sessoes[req.chaveSessao];
    await salvar();
  }
  res.clearCookie(COOKIE, { path: '/' });
}

/** Derruba as outras sessões do usuário (usado ao trocar a senha). */
export async function encerrarOutrasSessoes(usuarioId, chaveAtual) {
  const db = await ler();
  for (const [chave, sessao] of Object.entries(db.sessoes)) {
    if (sessao.usuarioId === usuarioId && chave !== chaveAtual) delete db.sessoes[chave];
  }
}

// ---------- Middlewares ----------

/** Coloca req.usuario se o cookie de sessão for válido. Não bloqueia ninguém. */
export async function carregarUsuario(req, _res, next) {
  const token = lerCookie(req, COOKIE);
  if (token) {
    const db = await ler();
    const chave = hashToken(token);
    const sessao = db.sessoes[chave];
    if (sessao && sessao.expiraEm > Date.now()) {
      req.usuario = db.usuarios.find((u) => u.id === sessao.usuarioId);
      req.chaveSessao = chave;
    }
  }
  next();
}

/** Bloqueia quem não está logado. */
export function exigirLogin(req, res, next) {
  if (!req.usuario) return res.status(401).json({ erro: 'Faça login para continuar' });
  next();
}

/**
 * Proteção extra contra CSRF: requisições que mudam dados (POST/PUT/DELETE)
 * vindas de outro site são recusadas. O cookie SameSite=Lax já ajuda; isto fecha o resto.
 */
export function mesmaOrigem(req, res, next) {
  const origem = req.headers.origin;
  if (req.method === 'GET' || !origem) return next();
  try {
    if (new URL(origem).host === req.headers.host) return next();
  } catch {
    // Origin inválido: cai no bloqueio abaixo
  }
  res.status(403).json({ erro: 'Origem não permitida' });
}

// ---------- Limite de tentativas de login ----------

const tentativas = new Map();
const JANELA = 15 * 60 * 1000;
const MAX_TENTATIVAS = 10;

export function bloqueado(chave) {
  const t = tentativas.get(chave);
  return Boolean(t && t.ate > Date.now() && t.qtd >= MAX_TENTATIVAS);
}

export function registrarFalha(chave) {
  const t = tentativas.get(chave);
  if (!t || t.ate < Date.now()) tentativas.set(chave, { qtd: 1, ate: Date.now() + JANELA });
  else t.qtd++;
}

export const limparFalhas = (chave) => tentativas.delete(chave);

// ---------- Faxina periódica ----------

export async function limparVencidos() {
  const db = await ler();
  let mudou = false;
  for (const [chave, sessao] of Object.entries(db.sessoes)) {
    if (sessao.expiraEm <= Date.now()) {
      delete db.sessoes[chave];
      mudou = true;
    }
  }
  if (mudou) await salvar();
  for (const [chave, t] of tentativas) if (t.ate < Date.now()) tentativas.delete(chave);
}
