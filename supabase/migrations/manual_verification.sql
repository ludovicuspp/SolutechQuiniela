-- ============================================================
-- Manual verification requests for users who can't receive SMS
-- Run this in Supabase SQL Editor (single execution)
-- ============================================================

-- 1. Tabla de solicitudes de verificación manual
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  telefono text not null,
  rif text not null,
  nombre text not null,
  email_contacto text not null,
  alias text,
  zona text,
  vendedor text,
  empresa text,
  puntos_iniciales numeric(12,2) default 0,
  password text not null,
  estado text default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  admin_id uuid,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

alter table public.verification_requests enable row level security;

-- Solo admins pueden leer; cualquiera puede insertar
drop policy if exists "Anyone can insert verification requests" on public.verification_requests;
create policy "Anyone can insert verification requests" on public.verification_requests
  for insert with check (true);

drop policy if exists "Admins manage verification requests" on public.verification_requests;
create policy "Admins manage verification requests" on public.verification_requests
  for all using (true) with check (true);

-- 2. Enviar solicitud de verificación manual (pública)
create or replace function public.public_admin_submit_verification_request(
  p_telefono text,
  p_rif text,
  p_nombre text,
  p_email text,
  p_alias text,
  p_zona text default '',
  p_vendedor text default '',
  p_empresa text default '',
  p_puntos numeric default 0,
  p_password text default ''
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into public.verification_requests (
    telefono, rif, nombre, email_contacto, alias,
    zona, vendedor, empresa, puntos_iniciales, password, estado
  ) values (
    p_telefono, p_rif, p_nombre, p_email, p_alias,
    p_zona, p_vendedor, p_empresa, p_puntos, p_password, 'pendiente'
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.public_admin_submit_verification_request(text, text, text, text, text, text, text, text, numeric, text) to anon, authenticated;

-- 3. Obtener solicitudes pendientes (solo admins)
create or replace function public.public_admin_get_verification_requests()
returns table (
  id uuid, telefono text, rif text, nombre text,
  email_contacto text, alias text, zona text, vendedor text,
  empresa text, puntos_iniciales numeric, password text,
  created_at timestamptz
) language plpgsql security definer as $$
begin
  return query
  select r.id, r.telefono, r.rif, r.nombre,
         r.email_contacto, r.alias, r.zona, r.vendedor,
         r.empresa, r.puntos_iniciales, r.password, r.created_at
  from public.verification_requests r
  where r.estado = 'pendiente'
  order by r.created_at desc;
end;
$$;

grant execute on function public.public_admin_get_verification_requests() to anon, authenticated;

-- 4. Aprobar solicitud: crea el usuario con los datos almacenados
create or replace function public.public_admin_approve_verification_request(
  p_request_id uuid
) returns uuid language plpgsql security definer as $$
declare
  v_req record;
  v_user_id uuid;
begin
  select * into v_req from public.verification_requests where id = p_request_id and estado = 'pendiente';
  if not found then
    raise exception 'Solicitud no encontrada o ya procesada';
  end if;

  -- Crear usuario con public_admin_create_user
  select public.public_admin_create_user(
    v_req.email_contacto, v_req.password, v_req.rif, v_req.nombre,
    v_req.telefono, v_req.zona, v_req.vendedor, v_req.empresa,
    v_req.puntos_iniciales, false
  ) into v_user_id;

  -- Marcar solicitud como aprobada
  update public.verification_requests
  set estado = 'aprobado', admin_id = auth.uid(), resolved_at = now()
  where id = p_request_id;

  return v_user_id;
end;
$$;

grant execute on function public.public_admin_approve_verification_request(uuid) to anon, authenticated;

-- 5. Rechazar solicitud
create or replace function public.public_admin_reject_verification_request(
  p_request_id uuid
) returns void language plpgsql security definer as $$
begin
  update public.verification_requests
  set estado = 'rechazado', admin_id = auth.uid(), resolved_at = now()
  where id = p_request_id and estado = 'pendiente';
end;
$$;

grant execute on function public.public_admin_reject_verification_request(uuid) to anon, authenticated;
