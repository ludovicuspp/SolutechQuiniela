-- ============================================
-- add_get_email_by_rif.sql
-- RPC: resolver email de auth.users a partir de la cédula (rif)
-- SECURITY DEFINER: corre como postgres para acceder a auth.users
-- Normaliza el input igual que normalizarRif() en el cliente.
-- ============================================

create or replace function public.get_email_by_rif(p_rif text)
returns text
language plpgsql security definer stable
as $$
declare
  v_email text;
  v_normalized_input text;
begin
  -- Normalizar input: mayúsculas, solo alfanuméricos
  v_normalized_input := upper(regexp_replace(p_rif, '[^A-Za-z0-9]', '', 'g'));

  -- Si quedó solo dígitos, asumir tipo V (cédula venezolana)
  if v_normalized_input ~ '^[0-9]+$' THEN
    v_normalized_input := 'V' || v_normalized_input;
  end if;

  -- Buscar el rif normalizado en public.users → obtener email de auth.users
  select au.email into v_email
  from public.users pu
  join auth.users au on au.id = pu.id
  where upper(regexp_replace(pu.rif, '[^A-Za-z0-9]', '', 'g')) = v_normalized_input
  limit 1;

  return v_email; -- NULL si no existe
end;
$$;

grant execute on function public.get_email_by_rif(text) to anon, authenticated;

-- Forzar recarga del caché de PostgREST para que vea la nueva función inmediatamente
notify pgrst, 'reload schema';
