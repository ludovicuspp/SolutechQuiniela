-- ============================================
-- Migración: RPC get_email_by_phone
-- Permite al frontend buscar el email de un usuario por teléfono
-- para completar el flujo OTP propio (EnvíaTuSMS).
-- SECURITY DEFINER: corre como postgres, evita exponer la tabla auth.users
-- Ejecutar en Supabase SQL Editor
-- ============================================

create or replace function public.get_email_by_phone(p_telefono text)
returns text
language plpgsql security definer stable
as $$
declare
  v_email text;
  v_input_digits text;
begin
  -- 1) Dejar SOLO dígitos, sin importar qué formato tenga
  v_input_digits := regexp_replace(p_telefono, '\D', '', 'g');

  -- 2) Comparar los últimos 7 dígitos (móviles venezolanos: 4XX-XXXXXXX)
  --    Esto matchea con CUALQUIER formato en la DB:
  --      04246258204 → 4258204
  --      04246828939 → 4682939
  --      0414-1000714 → 1000714
  --      04146760320 → 6760320
  --      04146760320 → 6760320
  --      04246179492 → 6179492
  select au.email into v_email
  from public.users pu
  join auth.users   au on au.id = pu.id
  where pu.telefono is not null
    and pu.telefono <> ''
    and right(regexp_replace(pu.telefono, '\D', '', 'g'), 7) = right(v_input_digits, 7)
  limit 1;

  return v_email; -- NULL si no existe
end;
$$;

-- Exponer solo a anon/authenticated (no a service_role exclusivo)
grant execute on function public.get_email_by_phone(text) to anon, authenticated;
