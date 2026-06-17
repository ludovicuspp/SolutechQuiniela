-- pg_cron + pg_net para invocar sync-matches Edge Function cada 1 minuto.
-- Secrets: la URL de la función y service role key se almacenan en Vault.
--
-- Secrets requeridos (crear una sola vez en SQL Editor):
--   SELECT vault.create_secret(
--     'https://<PROJECT_REF>.supabase.co/functions/v1/sync-matches',
--     'sync_matches_function_url'
--   );
--   SELECT vault.create_secret(
--     '<SUPABASE_SERVICE_ROLE_KEY>',
--     'supabase_service_role_key'
--   );

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Función wrapper que pg_cron invoca cada minuto.
-- Lee URL y service key desde Vault (tabla vault.decrypted_secrets).
create or replace function public.cron_sync_matches()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  func_url   text;
  service_key text;
  headers    jsonb;
begin
  -- Obtener URL del Vault (decrypted_secrets, no current_secret)
  select decrypted_secret into func_url
  from vault.decrypted_secrets
  where name = 'sync_matches_function_url';

  -- Obtener service role key del Vault
  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'supabase_service_role_key';

  if func_url is null then
    raise warning 'cron_sync_matches: secret sync_matches_function_url no encontrado en Vault';
    return;
  end if;

  if service_key is null then
    raise warning 'cron_sync_matches: secret supabase_service_role_key no encontrado en Vault';
    return;
  end if;

  headers := jsonb_build_object(
    'Authorization', 'Bearer ' || service_key,
    'Content-Type', 'application/json'
  );

  -- Invocar la Edge Function (fire-and-forget)
  perform net.http_post(
    url := func_url,
    headers := headers,
    body := '{}'::jsonb
  );

exception when others then
  raise warning 'cron_sync_matches error: %', sqlerrm;
end;
$$;

-- Dar permisos a postgres para invocar la wrapper
grant execute on function public.cron_sync_matches() to postgres;
grant execute on function public.cron_sync_matches() to authenticated;

-- Programar: cada 1 minuto.
-- Usamos cron.schedule() directamente (idempotente: si ya existe, lo reemplaza).
-- Esto reemplaza el antiguo perform cron.unschedule(...) que era inválido a nivel SQL.
do $$
begin
  -- Eliminar schedule anterior si existe (evita error "event already scheduled")
  perform cron.unschedule('sync-matches-every-minute');
end;
$$;

select cron.schedule(
  'sync-matches-every-minute',
  '* * * * *',
  $$ select public.cron_sync_matches() $$
);

-- Verificar que quedó programado:
-- select * from cron.job where jobname = 'sync-matches-every-minute';
