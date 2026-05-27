# Documentacao Tecnica

## Visao Geral

Esta aplicacao e um monorepo com duas partes principais:

- `api`: backend Express integrado ao Supabase.
- `web`: frontend React + Vite com React Flow.

O objetivo do sistema e gerenciar visoes, nos e conexoes de fluxos de arquitetura, com uma camada de autenticacao por senha antes de liberar o uso da interface.

## Estrutura do Projeto

- `api/server.js`: servidor HTTP e rotas da aplicacao.
- `api/sql/001_app_security.sql`: script para criar a tabela de autenticacao.
- `web/src/App.tsx`: interface principal, login e telas do hall/canvas.
- `web/src/index.css`: estilos globais e da interface.
- `README.md`: resumo operacional.
- `docs/documentacao.md`: documentacao tecnica detalhada.

## Stack Tecnologica

- Backend: Node.js, Express, CORS, dotenv, Supabase JS.
- Frontend: React 18, TypeScript, Vite, Axios, Framer Motion, React Flow.
- Banco: Supabase/PostgreSQL.

## Fluxo Geral da Aplicacao

1. O usuario abre a aplicacao.
2. A tela de login aparece primeiro.
3. O frontend chama `POST /api/auth/login`.
4. O backend valida a senha na tabela `public.app_security`.
5. Se a senha estiver correta, o backend retorna um token de sessao.
6. O frontend armazena o token em `localStorage` e passa a enviar `Authorization: Bearer <token>`.
7. Todas as rotas de negocio ficam protegidas pelo middleware `requireAuth`.

## Autenticacao

### Tabela de Senha

A tabela usada para armazenar a credencial e `public.app_security`.

Campos principais:

- `id`: chave primaria, usada com valor fixo `1`.
- `password_hash`: hash da senha.
- `created_at`: data de criacao.
- `updated_at`: data da ultima alteracao.

O script de criacao esta em [api/sql/001_app_security.sql](../api/sql/001_app_security.sql).

### Formato do Hash

A aplicacao usa hash no formato:

```text
scrypt$1$<salt>$<derived-key>
```

Isso permite guardar a senha de forma derivada, sem texto puro no banco.

### Senha Inicial

O projeto foi configurado com a senha inicial `123.med`.

Se essa senha for alterada diretamente no Supabase, o backend passa a usar a nova senha no proximo login.

### Invalidacao de Sessao

O token carregado pelo frontend e validado pelo backend.

Quando o `password_hash` da linha `id = 1` e alterado, o campo `updated_at` tambem muda. O backend compara esse valor com o token atual e invalida a sessao antiga. Isso obriga o usuario a autenticar novamente.

## Backend

### Responsabilidades

- Validar login.
- Assinar e verificar token de sessao.
- Proteger rotas da aplicacao.
- Servir dados de fluxos, visoes, nos e conexoes.

### Endpoints de Autenticacao

- `POST /api/auth/login`
  - Entrada: `{ "password": "..." }`
  - Saida: `{ "token": "..." }`

- `GET /api/auth/status`
  - Requer token Bearer.
  - Retorna se a sessao atual continua valida.

### Protecao das Rotas

Depois da rota de login, o backend aplica:

```text
app.use('/api', requireAuth)
```

Isso significa que todas as rotas de negocio em `/api/*` exigem autenticacao.

### Dependencia do Supabase

O backend usa o cliente Supabase para ler e escrever:

- `fluxos_visoes`
- `fluxo_nos_posicoes`
- `fluxo_conexoes`
- `catalogo_componentes`
- `app_security`

## Frontend

### Comportamento

O frontend tem dois estados principais:

- `unauthenticated`: mostra a tela de login.
- `authenticated`: libera o hall e o canvas.

### Persistencia

O token e guardado em `localStorage` sob a chave:

```text
linhagem.auth.token
```

Ao recarregar a pagina, o frontend verifica a sessao com `GET /api/auth/status`.

### Logout

O usuario pode sair da sessao pelo botao de logout. Nesse caso:

- o token e removido do `localStorage`;
- o estado local e limpo;
- a tela de login volta a ser exibida.

## Configuracao de Ambiente

### Backend

Variaveis esperadas:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `APP_AUTH_SECRET`
- `APP_INITIAL_PASSWORD` opcional
- `PORT` opcional
- `NODE_ENV` opcional

### Frontend

Variavel opcional:

- `VITE_API_URL`

Se nao for definida em desenvolvimento, o frontend usa `http://localhost:3001/api`.

## Banco de Dados

### Script de Inicializacao

O arquivo `api/sql/001_app_security.sql` cria:

- a tabela `app_security`;
- o trigger de atualizacao de `updated_at`;
- a estrutura para armazenar o hash da senha.

### Troca Manual de Senha

Como o acesso e baseado na linha `id = 1`, trocar a senha significa atualizar `password_hash` nessa linha no Supabase.

Exemplo de operacao:

```sql
update public.app_security
set password_hash = '<novo-hash>'
where id = 1;
```

## Rotas de Negocio

O backend expoe rotas para:

- listar visoes;
- criar visoes;
- editar visoes;
- remover visoes;
- carregar fluxo completo de uma visao;
- criar no;
- editar nome do no;
- atualizar posicao;
- criar conexao;
- remover conexao.

Todas essas rotas exigem token valido.

## Execucao Local

### Backend

```bash
cd api
npm install
npm start
```

### Frontend

```bash
cd web
npm install
npm run dev
```

## Build

No monorepo raiz:

```bash
npm run build
```

Esse comando executa o build do frontend e copia o resultado para `dist`.

## Observacoes Operacionais

- A aplicacao depende de acesso funcional ao Supabase.
- Se o hash da senha for alterado no banco, a sessao atual deixa de valer.
- O token nao e JWT; ele e um token assinado localmente pelo backend.
- O arquivo `linhagem.md` continua como documento funcional de mapeamento do dominio.

## Pontos de Manutencao

- Para ajustar a seguranca, mexa primeiro em `api/server.js` e `api/sql/001_app_security.sql`.
- Para mudar a experiencia da tela de login, ajuste `web/src/App.tsx` e `web/src/index.css`.
- Para alterar a base de dados da autenticacao, atualize o script SQL e a linha `id = 1`.
