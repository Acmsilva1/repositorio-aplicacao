# repositorio-aplicacao

Aplicacao com backend Express, Supabase e frontend React/Vite.

## Autenticacao

O acesso agora e protegido por senha.

1. Execute o SQL em [api/sql/001_app_security.sql](./api/sql/001_app_security.sql) no banco.
2. Configure `APP_AUTH_SECRET` no backend.
3. Opcionalmente, configure `APP_INITIAL_PASSWORD` para inicializar a primeira senha no banco se a tabela estiver vazia.

O backend expoe `POST /api/auth/login` e `GET /api/auth/status`, e todas as outras rotas em `/api` exigem token Bearer valido.
