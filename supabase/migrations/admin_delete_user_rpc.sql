-- ============================================================
-- IronBet — Admin: eliminar usuario completo
-- Run this in Supabase SQL Editor
-- ============================================================

create or replace function public.admin_delete_user(p_user_id uuid) returns void as $$
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'No autorizado';
  end if;
  delete from public.users where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$ language plpgsql security definer;
