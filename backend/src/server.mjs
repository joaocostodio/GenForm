// Ponto de entrada do backend: monta o Express e liga as rotas.
//
//   /api/auth/...     conta (cadastro, login, logout, perfil)    -> rotas/auth.mjs
//   /api/forms/...    formulários do usuário logado             -> rotas/forms.mjs
//   /api/publico/...  ver e responder um formulário pelo link   -> rotas/publico.mjs
//
// Em produção também entrega o Angular compilado (frontend/dist), assim
// site e API ficam no mesmo endereço e o cookie de sessão funciona sem CORS.
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rotasAuth } from './rotas/auth.mjs';
import { rotasForms } from './rotas/forms.mjs';
import { rotasPublico } from './rotas/publico.mjs';
import { carregarUsuario, exigirLogin, limparVencidos, mesmaOrigem } from './seguranca.mjs';

const app = express();
const pasta = dirname(fileURLToPath(import.meta.url));

app.disable('x-powered-by');
// Atrás de um proxy (Render, Railway...) para req.ip e cookies "secure" funcionarem.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '500kb' }));

// ---------- API ----------

app.use('/api', mesmaOrigem, carregarUsuario);
app.use('/api/auth', rotasAuth);
app.use('/api/forms', exigirLogin, rotasForms);
app.use('/api/publico', rotasPublico);
app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// ---------- Frontend compilado (npm run build) ----------

const pastaFrontend = resolve(process.env.FRONTEND_DIST ?? join(pasta, '..', '..', 'frontend', 'dist', 'frontend', 'browser'));
if (existsSync(pastaFrontend)) {
  // Só a página de responder (/f/...) pode ser incorporada em outro site (iframe).
  app.use((req, res, next) => {
    if (!req.path.startsWith('/f/')) res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });
  app.use(express.static(pastaFrontend));
  // Qualquer outra rota (ex: /f/abc) devolve o index.html e o Angular Router resolve.
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(join(pastaFrontend, 'index.html'));
  });
}

// ---------- Erros ----------

app.use((erro, _req, res, _next) => {
  if (erro.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido' });
  if (erro.type === 'entity.too.large') return res.status(413).json({ erro: 'Conteúdo grande demais' });
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

const porta = Number(process.env.PORT) || 3000;
app.listen(porta, () => {
  console.log(`Backend rodando em http://localhost:${porta}`);
  console.log(existsSync(pastaFrontend) ? `Servindo o frontend de ${pastaFrontend}` : 'Frontend não compilado: só a API está no ar');
});

limparVencidos();
setInterval(limparVencidos, 60 * 60 * 1000).unref();
