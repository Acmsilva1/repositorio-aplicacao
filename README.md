# repositorio-aplicacao

Aplicacao com backend Express, Supabase e frontend React/Vite.

## Autenticacao

O acesso ao sistema agora exige senha.

### Configuracao inicial

1. Execute o SQL em [api/sql/001_app_security.sql](./api/sql/001_app_security.sql) no banco do Supabase.
2. Garanta que exista a linha `id = 1` na tabela `public.app_security`.
3. A senha inicial cadastrada no projeto e `123.med`.

### Como trocar a senha

Como a senha fica salva no banco, voce pode alterar direto no Supabase e a aplicacao passa a usar a nova senha na proxima autenticacao.

1. Atualize o campo `password_hash` da linha `id = 1` na tabela `public.app_security`.
2. Se a senha for alterada, a sessao atual expira e o usuario precisa entrar de novo.

### Fluxo do backend

- `POST /api/auth/login` valida a senha informada.
- `GET /api/auth/status` confirma se o token atual continua valido.
- Todas as demais rotas em `/api` exigem token Bearer.

### Variaveis de ambiente

- `APP_AUTH_SECRET`: chave usada para assinar o token de sessao.
- `APP_INITIAL_PASSWORD`: opcional, usado apenas para bootstrap caso a tabela esteja vazia.

### Observacao

O hash de senha usado no banco segue o formato `scrypt$1$<salt>$<derived-key>`.
