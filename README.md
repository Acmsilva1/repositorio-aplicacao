# repositorio-aplicacao

Aplicacao com backend Express, SQLite local e frontend React/Vite.

## Rodando localmente

1. Execute `npm install` na raiz do projeto.
2. Configure as variaveis de ambiente do backend, se necessario.
3. Rode `npm run dev` na raiz.

O comando sobe:
- o backend em `http://localhost:3001`
- o frontend em `http://localhost:5190`

O frontend usa `/api` e o Vite encaminha as chamadas para o backend local.
O banco local fica em `data/app.db` e e inicializado a partir dos CSVs em `data/` na primeira execucao.

### Lancador Windows

- `start-repositorio-aplicacao.bat`: backend `3000` e frontend `5190`

O arquivo abre uma unica janela de terminal com o nome da aplicacao e pode ser encerrado com `Ctrl+C`.

### Variaveis de ambiente

- `DATABASE_PATH`: opcional, caminho do snapshot do SQLite. Por padrao, usa `data/app.db`.
