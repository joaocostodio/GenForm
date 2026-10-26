# Projeto Aula Angular — nosso "Google Forms"

Clone do Google Forms feito com **Angular 22** (frontend) e **Node.js + Express** (backend).

## O que dá pra fazer

- **Painel**: lista os formulários, cria em branco ou a partir de modelos, copia o link, exclui.
- **Editor** (salva sozinho): título, descrição, cor do tema, seções e perguntas.
  - Tipos: resposta curta, parágrafo, múltipla escolha, caixas de seleção, lista suspensa e escala linear.
  - Obrigatória, duplicar, excluir, mover para cima/baixo, adicionar/remover opções.
- **Responder** (`/f/:id`): o link que vai para os colegas. Uma página por seção, validação de obrigatórias.
- **Respostas**: resumo com gráficos de barra, respostas individuais, abrir/fechar o formulário, exportar CSV, excluir.

## Como rodar

```bash
npm install
npm run dev
```

Abra **http://localhost:4200**. O `npm run dev` sobe dois processos juntos:

| Processo | Porta | O que é |
|---|---|---|
| `api` | 3000 | Express em `server/server.mjs` |
| `web` | 4200 | `ng serve` (repassa `/api` para a porta 3000 via `proxy.conf.json`) |

Os dados ficam em `server/data/db.json` (criado sozinho, fora do Git).

## Estrutura

```
server/
  server.mjs        rotas da API + serve o Angular compilado em produção
  validacao.mjs     limpa o formulário e valida as respostas
  db.mjs            leitura/gravação do db.json
src/app/
  models/           tipos (Formulario, Pergunta, Resposta...) e modelos prontos
  services/         FormulariosService (HttpClient -> /api)
  pages/painel      lista de formulários
  pages/editor      editor com Reactive Forms (FormArray de seções/perguntas/opções)
  pages/responder   formulário dinâmico gerado a partir das perguntas
  pages/respostas   resumo, individual, CSV
  shared/           cabeçalho, avisos, CSV
```

## API

| Método | Rota | Faz |
|---|---|---|
| GET | `/api/forms` | lista (com total de respostas) |
| POST | `/api/forms` | cria |
| GET / PUT / DELETE | `/api/forms/:id` | busca / salva / exclui |
| GET / POST / DELETE | `/api/forms/:id/respostas` | lista / envia / exclui todas |
| DELETE | `/api/forms/:id/respostas/:respostaId` | exclui uma |

## Publicar (produção)

```bash
npm run build       # gera dist/aula1/browser
npm run start:prod  # Express serve o site e a API na mesma porta (PORT, padrão 3000)
```

Funciona em qualquer hospedagem Node (ex: Render): build command `npm install && npm run build`,
start command `npm run start:prod`.

> Atenção: não há login. Quem tiver o link de edição consegue editar. Em hospedagens gratuitas o
> `db.json` pode ser apagado quando o servidor reinicia.

## Testes

```bash
npm test
```
