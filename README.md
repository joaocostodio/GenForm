# GenForm

**GenForm** é um clone do Google Forms feito em aula: **crie formulários, compartilhe um link e veja as respostas**.

```bash
git clone https://github.com/joaocostodio/GenForm.git
cd GenForm
npm install
npm run dev     # abra http://localhost:4200
```

O repositório é dividido em duas partes independentes:

| Pasta | O que é | Tecnologia | Documentação |
|---|---|---|---|
| [`backend/`](backend/) | API REST: contas, formulários, respostas, regras e segurança | Node.js 20+ · Express 5 | [backend/README.md](backend/README.md) |
| [`frontend/`](frontend/) | Interface que roda no navegador | Angular 22 · TypeScript · Reactive Forms | [frontend/README.md](frontend/README.md) |

> ⚠️ **Projeto de aula:** ao criar conta, use um **e-mail fictício** (ex: `seunome@teste.com`).
> O sistema não envia e-mails e não confere se o endereço existe. Não use seu e-mail real.

---

## Como as partes conversam

```
 Navegador (Angular)                         Servidor (Node + Express)
┌──────────────────────────┐   HTTP + JSON  ┌──────────────────────────────┐
│ frontend/src/app         │ ─────────────► │ backend/src/server.mjs       │
│  pages/   (telas)        │   /api/...     │  rotas/auth.mjs    /api/auth │
│  services/ (HttpClient)  │ ◄───────────── │  rotas/forms.mjs   /api/forms│
│  core/    (guards)       │  cookie sessão │  rotas/publico.mjs /api/publico
└──────────────────────────┘                │  validacao.mjs  (regras)     │
                                            │  seguranca.mjs  (senha/sessão)│
                                            │  db.mjs → backend/data/db.json│
                                            └──────────────────────────────┘
```

- O **frontend** nunca acessa o banco: ele só chama a API em `/api/...`.
- O **backend** é a fonte da verdade: valida tudo de novo (obrigatórias, regras, nota do teste),
  mesmo que o frontend já tenha validado.
- **Desenvolvimento:** o Angular roda na porta 4200 e repassa `/api` para o backend na 3000
  (`frontend/proxy.conf.json`).
- **Produção:** o backend também entrega o Angular compilado, então tudo fica num endereço só.

## Funcionalidades

**Contas**
- Criar conta, entrar, sair, trocar nome e senha. Cada pessoa só vê e edita os próprios formulários.

**Editor** (salva sozinho)
- 9 tipos de pergunta: resposta curta, parágrafo, múltipla escolha, caixas de seleção, lista suspensa,
  escala linear, grade de múltipla escolha, data e hora.
- Descrição na pergunta, opção "Outro", obrigatória, duplicar, excluir, **arrastar e soltar** (inclusive entre seções).
- **Validação de resposta**: e-mail, link, número (mín./máx.), quantidade de caracteres, quantidade de caixas marcadas.
- **Seções** e **lógica condicional**: "ir para a seção X" conforme a resposta, ou "após a seção, enviar".
- Cor do tema e modelos prontos (pesquisa, inscrição, teste).

**Configurações**
- Aceitar respostas, **exigir login**, **1 resposta por pessoa**, **data limite**, **limite de respostas**,
  barra de progresso, embaralhar perguntas, mensagem de confirmação.
- **Modo teste (quiz)**: gabarito, pontos, explicação e nota automática para quem responde.

**Compartilhar**
- Link, **QR code** (com download) e código `<iframe>` para incorporar em outro site.

**Respostas**
- Resumo com gráficos, respostas individuais (com nome, e-mail e nota quando houver), média da turma,
  abrir/fechar o formulário, exportar CSV (abre no Excel) e excluir.

**Painel**
- Busca, filtro (abertos, fechados, testes), ordenação, duplicar e excluir formulários.

## Como rodar

Pré-requisito: **Node.js 20 ou mais novo**.

```bash
npm install     # instala raiz, backend e frontend (um só comando)
npm run dev     # sobe backend (3000) e frontend (4200) juntos
```

Abra **http://localhost:4200**, crie uma conta (e-mail fictício!) e comece um formulário.

Também dá para rodar cada parte separada, em dois terminais:

```bash
cd backend  && npm run dev     # API em http://localhost:3000
cd frontend && npm start       # site em http://localhost:4200
```

### Scripts da raiz

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências das três partes |
| `npm run dev` | Backend + frontend em modo desenvolvimento |
| `npm test` | Testes do backend (`node:test`) e do frontend (Vitest) |
| `npm run build` | Compila o Angular em `frontend/dist/` |
| `npm start` | Sobe o backend em modo produção (já servindo o Angular compilado) |

## Publicar para os colegas testarem

Qualquer hospedagem de Node serve (ex: Render, Railway). Configuração:

| Campo | Valor |
|---|---|
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Variável de ambiente | `NODE_ENV=production` |

Em produção o cookie de sessão só trafega em HTTPS. Em hospedagens gratuitas, o arquivo
`backend/data/db.json` pode ser apagado quando o servidor reinicia (contas e respostas somem).

## Segurança (resumo)

- Senhas guardadas com **scrypt + sal** (nunca em texto).
- Sessão em **cookie httpOnly** (o JavaScript da página não lê), `SameSite=Lax` e checagem de origem contra CSRF.
- **Limite de tentativas** de login (10 a cada 15 min por IP + e-mail).
- O link público **não entrega o gabarito** do teste.
- Um usuário recebe 404 ao tentar abrir o formulário de outro.
- CSV protegido contra fórmulas maliciosas no Excel.

Detalhes em [backend/README.md](backend/README.md#segurança).
