create table if not exists public.app_security (
  id bigint primary key,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_security disable row level security;

create or replace function public.set_app_security_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_security_updated_at on public.app_security;

create trigger trg_app_security_updated_at
before update on public.app_security
for each row
execute function public.set_app_security_updated_at();

-- A senha pode ser criada manualmente com um hash no formato:
-- scrypt$1$<salt>$<derived-key>
-- Se preferir, defina APP_INITIAL_PASSWORD no backend e faça o primeiro login para o servidor gravar a linha 1.

insert into public.app_security (id, password_hash)
values (
  1,
  'scrypt$1$9f3a1c2b4e5d6f708192a3b4c5d6e7f8$cb1f2ac2b177198cce9597b6c51229b700f52b4fa7bcf310eb36449ced293a616480f75742c583222b16fe23c9859b7b450bbf523e5e63f9a31ca3786cdcef76'
)
on conflict (id) do update
set password_hash = excluded.password_hash,
    updated_at = now();
