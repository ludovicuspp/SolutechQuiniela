-- ============================================
-- Migración: columna email + RPCs phone_exists / email_exists
-- Agrega la columna email a public.users (no existía)
-- y crea los RPCs de validación de duplicados.
-- SECURITY DEFINER: corre como postgres, evita exponer la tabla users.
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1) Agregar columna email a public.users (es dato de contacto, no credencial Auth)
alter table public.users
  add column if not exists email text;

-- 2) RPC: ¿ya existe un usuario con este teléfono?
--    Compara últimos 7 dígitos para tolerar formatos:
--      0414-1000714 / 4141000714 / +584141000714 → matchean los 7 últimos
create or replace function public.phone_exists(p_telefono text)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.users pu
    where pu.telefono is not null
      and pu.telefono <> ''
      and right(regexp_replace(pu.telefono, '\D', '', 'g'), 7)
        = right(regexp_replace(p_telefono, '\D', '', 'g'), 7)
  );
$$;

grant execute on function public.phone_exists(text) to anon, authenticated;

-- 3) RPC: ¿ya existe un usuario con este email? (case-insensitive)
create or replace function public.email_exists(p_email text)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from public.users pu
    where pu.email is not null
      and pu.email <> ''
      and lower(trim(pu.email)) = lower(trim(p_email))
  );
$$;

grant execute on function public.email_exists(text) to anon, authenticated;
