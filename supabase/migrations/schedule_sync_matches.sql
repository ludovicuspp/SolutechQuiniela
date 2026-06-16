-- pg_cron + pg_net para invocar sync-matches Edge Function cada 1 minuto.
-- Secrets: la URL de la función se storea en Vault (nombre: 'sync_matches_function_url').
-- La primera vez, ejecutar manualmente para configurar el schedule:
--   SELECT cron.schedule(...)  -- llamado abajo en modo 'drop'
--
-- El secret 'sync_matches_function_url' se crea asi (una sola vez):
--   SELECT vault.create_secret(
--     'https://<PROJECT_REF>.supabase.co/functions/v1/sync-matches',
--     'sync_matches_function_url'
--   );

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Función wrapper que pg_cron invoca cada minuto.
-- Lee la URL del Vault y hace POST con Bearer token del service role.
create or replace function public.cron_sync_matches()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  func_url text;
  service_key text;
  headers jsonb;
begin
  -- Obtener URL del Vault
  func_url := (select vault.current_secret('sync_matches_function_url'));

  -- Obtener service role key del Vault
  service_key := (select vault.current_secret('supabase_service_role_key'));

  if func_url is null then
    raise warning 'cron_sync_matches: secret sync_matches_function_url no encontrado en Vault';
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

-- Dar permisos a authenticated para invocar la wrapper (no necesario para cron,
-- pero queda disponible por si se quiere probar manualmente)
grant execute on function public.cron_sync_matches() to postgres;
grant execute on function public.cron_sync_matches() to authenticated;

-- Schedule: cada 1 minuto. Modo 'drop' para que sea idempotente.
-- Eliminar schedule anterior si existe (evita error "event already scheduled")
perform cron.unschedule('sync-matches-every-minute');

insert into cron.job (jobname, schedule, command, active, instanceid)
values (
  'sync-matches-every-minute',
  '* * * * *',
  $$ select public.cron_sync_matches() $$,
  true,
  (select oid from pg_database where datname = current_database())
)
on conflict (jobname) do update
  set schedule = excluded.schedule,
      command = excluded.command,
      active = excluded.active;
