# GenForm · Frontend (Angular)

Interface do GenForm, o clone do Google Forms. Criado com o **Angular CLI** (`ng new`), Angular 22,
componentes standalone, **signals**, **Reactive Forms** e o novo controle de fluxo (`@if`, `@for`, `@switch`).

O frontend **não tem banco de dados**: tudo vem da API do [backend](../backend/README.md) em `/api/...`.

## Rodar

```bash
npm install
npm start       # ng serve --host 0.0.0.0: http://localhost:4200 e também pelo IP do PC na rede
                # (precisa do backend rodando na 3000)
npm test        # testes com Vitest
npm run build   # gera dist/frontend/browser
```

Durante o desenvolvimento, o `proxy.conf.json` repassa `/api` para `http://localhost:3000`.
Assim o navegador acha que site e API são o mesmo endereço, e o cookie de sessão funciona sem CORS.

## Estrutura

```
src/app/
├── app.config.ts          Providers: rotas, HttpClient + interceptor, carga do usuário ao abrir
├── app.routes.ts          Rotas (lazy loading) e guards
├── core/
│   └── auth.ts            Guards exigeLogin / soVisitante e interceptor de sessão expirada (401)
├── models/
│   └── formulario.ts      Tipos (espelham o backend), constantes e modelos prontos
├── services/
│   ├── auth.service.ts         Login, cadastro, sair; signal `usuario`
│   └── formularios.service.ts  Todas as chamadas HTTP de formulários e respostas
├── shared/
│   ├── cabecalho-form.ts  Topo + abas Perguntas | Respostas | Configurações
│   ├── compartilhar.ts    Janela "Enviar": link, QR code, iframe
│   ├── endereco.service.ts Endereço do link: troca "localhost" pelo IP da rede quando roda no PC
│   ├── menu-usuario.ts    Avatar com menu (minha conta, sair)
│   ├── fluxo.ts           Lógica condicional (para qual seção ir)
│   ├── validadores.ts     Validadores da tela de responder
│   ├── csv.ts             Exportação para Excel
│   └── aviso.service.ts   Mensagem flutuante ("Link copiado")
└── pages/
    ├── entrar/            Login e criar conta (mesmo componente, dois modos)
    ├── conta/             Trocar nome e senha
    ├── painel/            Lista de formulários, busca, filtro, modelos
    ├── editor/            Editor de perguntas
    │   ├── editor.ts            Seções, arrastar e soltar, salvamento automático
    │   ├── pergunta-editor.ts   Cartão de uma pergunta (opções, grade, validação, gabarito)
    │   └── editor-forms.ts      Monta os FormGroup/FormArray e converte de volta para JSON
    ├── configuracoes/     Configurações do formulário (salva sozinho)
    ├── responder/         Tela pública /f/:id
    └── respostas/         Resumo, individual, CSV
```

## Rotas

| Rota | Tela | Precisa login |
|---|---|---|
| `/entrar`, `/criar-conta` | Login e cadastro (`?voltar=` volta para onde estava) | não |
| `/f/:id` | Responder o formulário | só se o formulário exigir |
| `/` | Painel | sim |
| `/conta` | Minha conta | sim |
| `/forms/:id/editar` | Editor | sim |
| `/forms/:id/respostas` | Respostas | sim |
| `/forms/:id/configuracoes` | Configurações | sim |

## Conceitos de Angular usados

- **Reactive Forms tipados:** o editor é um `FormGroup` com `FormArray` de seções → perguntas → opções
  (`editor-forms.ts`). A tela de responder cria um `FormControl` por pergunta, com validadores
  montados a partir da configuração da pergunta (`validadores.ts`).
- **Salvamento automático:** `valueChanges` + `debounceTime` + `concatMap` (um salvamento por vez, em ordem).
- **Signals e `computed`:** estado das telas (carregando, filtros, resumo das respostas).
- **Guards funcionais** (`CanActivateFn`) e **interceptor funcional** (`HttpInterceptorFn`).
- **`provideAppInitializer`:** pergunta ao backend quem está logado antes de abrir a primeira tela.
- **Angular CDK Drag & Drop:** reordenar perguntas e mover entre seções.
- **`withComponentInputBinding`:** o `:id` da rota chega direto como `input()` no componente.
- **Lazy loading:** cada tela é baixada só quando é aberta.

## Observações

- O frontend valida para dar resposta rápida, mas quem decide é o backend (que valida de novo).
- Ao criar conta, use **e-mail fictício**: a própria tela avisa, porque não há envio de e-mail.
