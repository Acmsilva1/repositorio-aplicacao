# Documentacao Tecnica

## Visao Geral

Esta aplicacao e um monorepo com duas partes principais:

- `api`: backend Express com SQLite local e seed automatico.
- `web`: frontend React + Vite com React Flow.

O objetivo do sistema e gerenciar visoes, nos e conexoes de fluxos de arquitetura em modo local, sem dependencia de Supabase ou Vercel.

## Estrutura do Projeto

- `api/server.js`: servidor HTTP e rotas da aplicacao.
- `data/*.csv`: seed inicial importado na primeira execucao.
- `data/app.db`: snapshot local do banco SQLite.
- `web/src/App.tsx`: interface principal com hall e canvas.
- `web/src/index.css`: estilos globais e da interface.
- `README.md`: resumo operacional.

## Stack Tecnologica

- Backend: Node.js, Express, CORS, dotenv e SQLite nativo do Node.
- Frontend: React 18, TypeScript, Vite, Axios, Framer Motion e React Flow.
- Banco: SQLite local em `data/app.db`.

## Fluxo Geral da Aplicacao

1. O usuario abre a aplicacao.
2. O hall carrega automaticamente.
3. O frontend chama `GET /api/visoes`.
4. Ao abrir um item, o frontend chama `GET /api/fluxo/:visaoId`.
5. O usuario pode criar, editar e remover visoes, nos e conexoes.
6. O frontend atualiza o estado local da tela e persiste as alteracoes no backend.

## Persistencia Local

O backend usa as tabelas locais:

- `fluxos_visoes`
- `fluxo_nos_posicoes`
- `fluxo_conexoes`
- `catalogo_componentes`

Na primeira execucao, os CSVs em `data/` sao importados para o banco local.

### Banco local

- O arquivo do banco fica em `data/app.db` por padrao.
- Se `DATABASE_PATH` for definido, ele altera o caminho do snapshot do SQLite.
- As alteracoes feitas pela aplicacao sao espelhadas no snapshot local.

## Backend

### Responsabilidades

- Expor as rotas HTTP.
- Ler e gravar dados no SQLite local.
- Montar nodes e edges no formato esperado pelo React Flow.
- Atualizar o timestamp do hall quando o fluxo muda.

### Endpoints Principais

- `GET /api/visoes`
- `POST /api/visoes`
- `PATCH /api/visoes/:id`
- `DELETE /api/visoes/:id`
- `GET /api/fluxo/:visaoId`
- `POST /api/fluxo/no`
- `PATCH /api/fluxo/no/nome`
- `PATCH /api/fluxo/no/posicao`
- `DELETE /api/fluxo/no/:id`
- `POST /api/fluxo/conexao`
- `DELETE /api/fluxo/conexao/:id`

## Frontend

### Comportamento

O frontend tem dois estados principais:

- `hall`: lista as visoes disponiveis.
- `canvas`: permite editar nodes e conexoes da visao selecionada.

### Configuracao de API

- `VITE_API_URL` e opcional.
- Se nao for definida, o frontend usa `/api`.
- Em desenvolvimento, o Vite encaminha as chamadas para `http://localhost:3001`.

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

### Monorepo

```bash
npm run dev
```

## Observacoes Operacionais

- A aplicacao depende apenas do SQLite local e dos CSVs de seed em `data/`.
- O token de acesso foi removido.
- O arquivo `linhagem.md` continua como documento funcional de mapeamento do dominio.

## Pontos de Manutencao

- Para ajustar o schema ou a persistencia, mexa primeiro em `api/server.js`.
- Para mudar a experiencia do hall ou do canvas, ajuste `web/src/App.tsx` e `web/src/index.css`.
