# Backend — API em Node.js + Express

API REST do clone do Google Forms. Cuida de **contas, sessões, formulários, respostas e regras**.
É a fonte da verdade: tudo o que chega do navegador é limpo e validado aqui.

## Rodar

```bash
npm install
npm run dev     # reinicia sozinho ao salvar (node --watch), porta 3000
npm start       # modo normal
npm test        # testes (node:test): regras + API de verdade num banco temporário
```

## Estrutura

```
backend/
├── src/
│   ├── server.mjs        Monta o Express: middlewares, rotas, Angular compilado, erros
│   ├── rotas/
│   │   ├── auth.mjs      /api/auth     cadastro, login, logout, perfil
│   │   ├── forms.mjs     /api/forms    CRUD do dono, duplicar, QR code, respostas
│   │   └── publico.mjs   /api/publico  abrir e responder pelo link
│   ├── validacao.mjs     Regras: normalizar formulário, validar resposta,
│   │                     lógica condicional (caminho) e nota do teste
│   ├── seguranca.mjs     Senha (scrypt), sessão (cookie), middlewares, limite de tentativas
│   └── db.mjs            Lê/grava o banco em JSON (escrita atômica e em fila)
├── test/
│   ├── validacao.test.mjs   Testes das regras (funções puras)
│   └── api.test.mjs         Testes da API com servidor de verdade
└── data/db.json          Banco (criado sozinho, fora do Git)
```

## Variáveis de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `3000` | Porta do servidor |
| `NODE_ENV` | — | `production` liga cookie `secure` (só HTTPS) e `trust proxy` |
| `DB_FILE` | `backend/data/db.json` | Caminho do banco |
| `FRONTEND_DIST` | `../frontend/dist/frontend/browser` | Pasta do Angular compilado |

## Rotas

Todas recebem e devolvem JSON. Erros vêm como `{ "erro": "mensagem", "erros": { campo: "mensagem" } }`.

### Contas — `/api/auth`

| Método | Rota | Login? | Corpo | Resposta |
|---|---|---|---|---|
| GET | `/eu` | não | — | `{ usuario }` ou `{ usuario: null }` |
| POST | `/cadastro` | não | `{ nome, email, senha }` | `201 { usuario }` + cookie |
| POST | `/login` | não | `{ email, senha }` | `{ usuario }` + cookie · `401` · `429` |
| POST | `/logout` | não | — | `204` |
| PUT | `/eu` | sim | `{ nome?, senhaAtual?, novaSenha? }` | `{ usuario }` |

### Formulários do usuário — `/api/forms` (todas exigem login)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/` | Lista os formulários do usuário (com total de respostas) |
| POST | `/` | Cria (aceita um modelo no corpo) |
| GET | `/:id` | Formulário completo, com gabarito |
| PUT | `/:id` | **Atualização parcial**: só as chaves enviadas (`titulo`, `descricao`, `cor`, `secoes`, `config`) |
| DELETE | `/:id` | Exclui o formulário e as respostas |
| POST | `/:id/duplicar` | Cria uma cópia |
| GET | `/:id/qr?link=...` | QR code (SVG) do link de resposta |
| GET | `/:id/respostas` | Lista as respostas |
| DELETE | `/:id/respostas` | Exclui todas |
| DELETE | `/:id/respostas/:respostaId` | Exclui uma |

Formulário de outra pessoa responde **404** (não revela que existe).

### Responder pelo link — `/api/publico`

| Método | Rota | O que faz |
|---|---|---|
| GET | `/:id` | `{ status, form, usuario }`. As perguntas só vêm se `status` for `aberto`, e **sem gabarito** |
| POST | `/:id/respostas` | `{ valores }` → `201 { mensagemConfirmacao, permitirOutraResposta, nota }` |

`status`: `aberto` · `fechado` · `prazo` (passou da data limite) · `limite` (atingiu o máximo) ·
`precisa-login` · `ja-respondeu`.

## Modelo de dados (`db.json`)

```js
{
  usuarios: [{ id, nome, email, senhaHash, criadoEm }],
  sessoes:  { [sha256(token)]: { usuarioId, expiraEm } },
  forms: [{
    id, donoId, titulo, descricao, cor, criadoEm, atualizadoEm,
    config: { aceitandoRespostas, exigirLogin, umaRespostaPorPessoa, permitirOutraResposta,
              mensagemConfirmacao, dataLimite, limiteRespostas, embaralharPerguntas,
              barraProgresso, modoTeste, mostrarNota },
    secoes: [{
      id, titulo, descricao,
      depois,                      // '' (próxima) | 'enviar' | id de outra seção
      perguntas: [{
        id, tipo, titulo, descricao, obrigatoria,
        opcoes: [],                // multipla, caixas, lista
        permitirOutro,             // multipla, caixas
        usarDesvios, desvios: [],  // lógica condicional: desvios[i] é o destino da opção i
        escala: { min, max, rotuloMin, rotuloMax } | null,
        grade:  { linhas: [], colunas: [] } | null,
        validacao: { regra, min, max, mensagem } | null,   // email | url | numero | tamanho | selecao
        quiz: { pontos, corretas: [], feedback }
      }]
    }]
  }],
  respostas: { [formId]: [{ id, enviadoEm, valores, respondente, nota }] }
}
```

Tipos de pergunta: `curta`, `paragrafo`, `multipla`, `caixas`, `lista`, `escala`, `grade`, `data`, `hora`.

## Regras importantes (`validacao.mjs`)

- **Normalização:** só campos conhecidos são copiados, com tamanho máximo. Campos estranhos são descartados.
- **Lógica condicional:** desvios só podem apontar para a frente ou para "enviar", então nunca há caminho em círculo.
  A função `caminho()` refaz o trajeto da pessoa e **só valida as seções que ela visitou**.
- **"Outro":** aceita um texto livre além das opções, apenas se a pergunta permitir.
- **Nota:** curta compara sem diferenciar maiúsculas e espaços extras; caixas precisa acertar exatamente o conjunto.

## Segurança

| Ameaça | Proteção | Onde |
|---|---|---|
| Vazamento de senhas | `scrypt` com sal aleatório de 16 bytes; comparação em tempo constante | `seguranca.mjs` |
| Roubo de sessão por script | Cookie `httpOnly`; no banco fica só o hash SHA-256 do token | `seguranca.mjs` |
| CSRF | Cookie `SameSite=Lax` + recusa de `Origin` diferente do host | `mesmaOrigem` |
| Adivinhar senha | 10 tentativas a cada 15 min por IP + e-mail | `bloqueado/registrarFalha` |
| Descobrir e-mails cadastrados | Mesma mensagem e mesmo tempo para e-mail inexistente e senha errada | `rotas/auth.mjs` |
| Ver/editar formulário alheio | Filtro por `donoId`; responde 404 | `rotas/forms.mjs` |
| Colar respostas do teste | Link público não envia `corretas` nem `feedback` | `formPublico()` |
| Dados inválidos/gigantes | Normalização + limite de 500 kB no corpo | `validacao.mjs`, `server.mjs` |
| Clickjacking | `X-Frame-Options: SAMEORIGIN` (exceto `/f/...`, que pode ir em iframe) | `server.mjs` |
| Trocar a senha | Derruba as outras sessões abertas | `encerrarOutrasSessoes` |

Limitações conhecidas (aceitáveis para a aula): o banco é um arquivo JSON (um processo só) e não existe
recuperação de senha por e-mail, porque o sistema não envia e-mails.
